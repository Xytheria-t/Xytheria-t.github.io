---
title: volatile
category: juc
aliases: [可见性, volatile 变量]
---

# volatile

:::lede
volatile 是 Java 的字段修饰符，使该字段的读写具备可见性与禁止重排序的语义：一次写入立即对所有线程可见，一次读取必看到最新的那次写入。
**边界：** 不保证复合操作原子 · 不保证容器内容可见 · 它不是锁
:::

volatile 是变量可见性原语(非锁),可见性与有序性语义由 [[JMM]] 定义 → 写立即刷主存、读不缓存 → 内存屏障禁止重排序 → 单次读写原子但复合操作不原子 → 只适合状态标志与双重检查。

## 它解决什么

| 问题 | 机制 |
|---|---|
| 可见性 | 写后强制刷主内存,读前强制从主内存取,跳过线程工作内存缓存 |
| 有序性 | 插入内存屏障,禁止编译/CPU 重排序,建立 happens-before(屏障种类见下) |
| 原子性 | 单次读/写 ✅；复合操作(`i++`) ❌ |

> [!note] 内存屏障(JSR-133)
> volatile 写：前插 StoreStore、后插 StoreLoad;volatile 读：后插 LoadLoad + LoadStore。StoreLoad 是唯一能挡住「写后读」重排的屏障,也是 volatile 写开销的主要来源。

JDK 5 前(JSR-133 之前)volatile 不禁止重排序,双重检查单例可能拿到半初始化对象,详见 [[DCL]]。

## 适用场景

- ✅ **状态标志**：`volatile boolean running`,一写多读的控制开关。
- ✅ **双重检查单例**：[[DCL]]——`private static volatile Singleton instance`,禁止「引用赋值」与「对象初始化」重排。
- ❌ **复合操作**：`i++`、先检查后更新(`if(x==0) x=1`);单变量原子更新用 [[CAS 与原子类]] 的 `AtomicInteger`。
- ❌ **容器内容可见性**：volatile 只保**引用**可见,数组元素 / 对象字段的改动不跟着可见。

要互斥/复合原子用 [[synchronized]] 或 [[ReentrantLock]];只要可见性不要锁开销才用 volatile。横向对比见 [[Java 锁对比]]。

<details>
<summary>面试问答 (1题)</summary>

Q：volatile 与 happens-before？

A：volatile 变量规则:对 volatile 的写 happens-before 后续对该变量的读;借传递性,写 volatile 之前的普通变量写也一起可见。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：volatile 完全不保证原子性。JDK 5+ 对 volatile 变量的**单次读/写**是原子的(含 long/double 不撕裂),不保证的只是 `i++` 这类复合操作。
- 误区：volatile 能替代锁。多变量一致性、先检查后更新这类不变式都守不住;数组元素级可见性要 `AtomicIntegerArray`,该用 [[synchronized]] 还是要用。
- 误区：volatile 没有开销。写要插 StoreLoad 屏障,频繁写的 hot path 比普通变量慢。

</details>
