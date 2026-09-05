---
title: volatile
category: juc
aliases: [可见性, volatile 变量]
---

# volatile

## 思维链路速查

```chain
可见性 | 写回主存/读主存 | 核心
有序性 | 内存屏障禁重排 | 核心
原子性 | 单次读写 vs 复合 | 边界
适用场景 | 标志/双重检查 | 实战
面试问答 | 高频考点 | 复盘
```

volatile 是变量可见性原语(非锁),可见性与有序性语义由 [[JMM]] 定义 → 写立即刷主存、读不缓存 → 内存屏障禁止重排序 → 单次读写原子但复合操作不原子 → 只适合状态标志与双重检查。

## 它解决什么

| 问题 | 机制 |
|---|---|
| 可见性 | 写后强制刷主内存,读前强制从主内存取,跳过线程工作内存缓存 |
| 有序性 | 插入内存屏障(StoreStore/StoreLoad/LoadLoad/LoadStore),禁止编译/CPU 重排序,建立 happens-before |
| 原子性 | 单次读/写 ✅；复合操作(`i++`) ❌ |

> [!warning] 不保证复合操作原子性
> `i++` 是读-改-写三步,volatile 只保每步可见,不保三步之间不被插空,并发自增仍会丢更新。单变量原子更新用 [[CAS 与原子类]] 的 `AtomicInteger`。

> [!note] 内存屏障(JSR-133)
> volatile 写：前插 StoreStore、后插 StoreLoad;volatile 读：后插 LoadLoad + LoadStore。StoreLoad 是唯一能挡住「写后读」重排的屏障,也是 volatile 写开销的主要来源。

> [!warning] JDK 5 前后语义不同
> JSR-133(JDK 5)之前 volatile 不禁止重排序,**双重检查单例在 JDK 5 之前仍可能拿到半初始化对象**。谈 DCL 安全性默认 JDK 5+。

## 适用场景

- ✅ **状态标志**：`volatile boolean running`,一写多读的控制开关。
- ✅ **双重检查单例**：[[DCL]]——`private static volatile Singleton instance`,禁止「引用赋值」与「对象初始化」重排。
- ❌ **复合操作**：`i++`、先检查后更新(`if(x==0) x=1`)。
- ❌ **容器内容可见性**：volatile 只保**引用**可见,数组元素 / 对象字段的改动不跟着可见。

> [!note] 与 synchronized 的分工
> 要互斥/复合原子用 [[synchronized]] 或 [[ReentrantLock]]；只要可见性不要锁开销才用 volatile。横向对比见 [[Java 锁对比]]。

<details>
<summary>面试问答 (3题)</summary>

Q：volatile 能保证线程安全吗？

A：只保证可见性与有序性,以及单次读写的原子性;不保证复合操作原子性,`i++` 等仍不安全,需配合锁或原子类。

Q：为什么双重检查单例要 volatile？

A：new 对象分分配内存/初始化/赋值引用三步,重排序可能让引用先赋值后初始化,其他线程拿到半初始化对象；volatile 禁止该重排。前提是 JDK 5+。

Q：volatile 与 happens-before？

A：volatile 变量规则——对 volatile 变量的写 happens-before 后续对该变量的读;借助传递性,写线程在 volatile 写之前的普通变量写,也一起对读线程可见。

</details>

<details>
<summary>常见误区 (4条)</summary>

- 误区：volatile 完全不保证原子性。JDK 5+ 对 volatile 变量的**单次读/写**是原子的(含 long/double 不撕裂),不保证的只是 `i++` 这类复合操作。
- 误区：volatile 能替代锁。多变量一致性、先检查后更新这类不变式都守不住,该用 [[synchronized]] 还是要用。
- 误区：volatile 数组的元素改动也可见。只保数组引用可见,元素级要 `AtomicIntegerArray`。
- 误区：volatile 没有开销。写要插 StoreLoad 屏障,会挡住后续读的重排,频繁写的 hot path 比普通变量慢。

</details>
