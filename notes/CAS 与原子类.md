---
title: CAS 与原子类
category: juc
aliases: [CAS, 原子类, 无锁, Compare-And-Swap]
---

# CAS 与原子类

## 思维链路速查

```chain
CAS 原理 | 比较并交换 | 核心
原子类 | Unsafe/VarHandle+CAS | 用法
ABA | 版本戳解决 | 坑点
代价与优化 | 自旋/LongAdder | 优化
面试问答 | 高频考点 | 复盘
```

CAS 是比较并交换的 CPU 原子指令 → 原子类(AtomicInteger 等)封装 Unsafe+CAS → 存在 ABA 与自旋问题 → 高竞争用 LongAdder 等优化。

## CAS 原理

```
旧值 = 读; 新值 = f(旧值);
if (内存值 == 预期旧值) 内存值 = 新值; else 重试;
```

- 由 CPU 指令保证原子性(x86 是 `LOCK CMPXCHG`;ARM 靠 LL/SC 指令对 + 独占监视器)。
- 失败则自旋重试,直到成功或无界循环(实际代码要设重试上限或退避)。

## 原子类

| 类 | 用途 |
|---|---|
| AtomicInteger / AtomicLong | 原子计数 |
| AtomicReference<T> | 原子引用对象 |
| AtomicIntegerArray | 数组元素原子更新 |
| AtomicStampedReference | 带版本戳,解决 ABA |
| AtomicMarkableReference | 带布尔标记,只关心"是否被改过" |
| LongAdder / DoubleAdder | 分桶累加,高并发计数 |

```java
AtomicInteger c = new AtomicInteger(0);
c.incrementAndGet(); // i++ 的线程安全版
```

> [!note] 实现方式随 JDK 变化
> JDK 8 原子类基于 `Unsafe.compareAndSwapXxx`;JDK 9+ 改为 `VarHandle`(JEP 193 之后 `Unsafe` 逐步收敛)。语义不变,读源码时注意版本差异。

> [!warning] ABA 问题
> 值 A→B→A,CAS 校验「还是 A」便认为没变,但中间已被改过。解决：AtomicStampedReference 用版本戳,每次改戳+1,校验值+戳。

> [!note] ABA 实战场景
> 无锁栈：`top` 弹出 A → 压入 B → 又把 A 压回来,CAS 判定「top 仍是 A」通过,但 A 的 next 已指向被弹出的节点,结构被破坏。用 `AtomicStampedReference`(值 + 版本戳)或 `AtomicMarkableReference`(值 + 标记位)。

## 代价与优化

| 问题 | 表现 | 缓解 |
|---|---|---|
| 自旋开销 | 高竞争下 CPU 空转 | 控制竞争/减小临界区,必要时退回锁 |
| 单变量 | 只能保一个变量 | 用 AtomicReference 包不可变对象 |
| 高并发计数 | CAS 争用严重 | LongAdder 分桶累加 |
| 伪共享 | 相邻 cell 同缓存行互相失效 | `@Contended` 填充(JDK 8 起 LongAdder 内部已用) |

> [!warning] LongAdder 不是 AtomicLong 的平替
> `sum()` 只是各 cell 的**瞬时求和**,并发更新下不是原子快照;也不支持 `compareAndSet`、不支持「读到值再 CAS」这类依赖当前值的逻辑。适合监控计数这类高频自增统计,不适合精确读-改-写。

> [!note] 与锁的关系
> CAS 是无锁基石,[[AQS]] 与 [[ReentrantLock]] 的 state 修改也靠 CAS；原子类适合单变量原子更新,复杂临界区仍需锁。对比见 [[Java 锁对比]]。

<details>
<summary>面试问答 (2题)</summary>

Q：CAS 有什么缺点？

A：ABA 问题(用版本戳解决)、高竞争自旋耗 CPU、只能保证一个共享变量原子(可用引用对象变通)。

Q：LongAdder 为什么比 AtomicLong 快？

A：LongAdder 把计数分散到多个 cell,写时各加各的,读时汇总,降低 CAS 争用,高并发计数更优;代价是 sum() 非原子快照。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：CAS 无锁就无开销。高竞争下自旋空转,CPU 打满且延迟可能比阻塞锁更高,竞争大时该用锁。
- 误区：原子类能保证多个变量一起原子。只能保单个变量;多变量要包成不可变对象用 `AtomicReference`,或直接用锁。
- 误区：LongAdder 的 sum() 是精确值。并发更新时是瞬时近似值,做余额、限额这类强一致判断会出错。

</details>
