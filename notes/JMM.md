---
title: JMM
category: juc
aliases: [happens-before, Java 内存模型, JMM 内存模型]
---

# JMM

## 思维链路速查

```chain
抽象结构 | 主内存 / 工作内存 | 模型
三大问题 | 可见 / 原子 / 有序 | 成因
happens-before | 8 条规则 | 核心
重排序 | 三类 + as-if-serial | 原理
面试问答 | 高频考点 | 复盘
```

JMM(Java Memory Model)是 JSR-133 定义的**规范**,不是某块内存 → 规定线程与主内存如何交互 → 用 happens-before 回答「A 的写对 B 是否可见」 → 用禁止特定重排序保证有序 → [[volatile]]、[[synchronized]] 的语义都由它背书。

## 抽象结构

| 概念 | 说明 |
|---|---|
| 主内存 | 所有共享变量的归属地(对应堆 / 方法区) |
| 工作内存 | 每个线程私有的变量副本(是抽象,不是区域) |
| 交互动作 | lock / unlock / read / load / use / assign / store / write,8 种各自原子 |

> [!warning] 工作内存不是内存区域
> 它是对 CPU 缓存、写缓冲区、寄存器以及 JIT 优化后变量驻留寄存器的**抽象**。别去 JVM 里找「工作内存在哪」——栈、TLAB 都不是它。内存**布局**看 [[JVM 运行时数据区]],两回事。

## 三大问题

| 问题 | 表现 | JMM 的承诺 |
|---|---|---|
| 可见性 | A 改了,B 读到旧副本 | volatile / 锁 / final 安全发布 |
| 有序性 | 代码顺序被重排,DCL 拿到半初始化对象 | 内存屏障 + happens-before |
| 原子性 | `i++` 三步被插空 | 锁 / [[CAS 与原子类]];JMM 只保 8 个交互动作**各自**原子 |

## happens-before（8 条）

> [!note] 它是可见性判据,不是时间先后
> A happens-before B ≠ A 在时间上先发生。它表示 **A 的结果对 B 可见,且 A 不会被重排到 B 之后**。时间上先发生、但无 hb 关系,读到的仍可能是旧值。

| 规则 | 内容 |
|---|---|
| 程序次序 | 单线程内,前面的操作 hb 后面的操作 |
| 管程锁定 | 对同一锁的 unlock hb 后续对同一锁的 lock |
| volatile 变量 | volatile 写 hb 后续对该变量的读 |
| 线程启动 | `Thread.start()` hb 该线程内的任何操作 |
| 线程终止 | 线程内任何操作 hb 其他线程 `join()` 返回 |
| 线程中断 | 调 `interrupt()` hb 被中断线程检测到中断 |
| 对象终结 | 构造器结束 hb `finalize()` 开始 |
| 传递性 | A hb B 且 B hb C ⇒ A hb C |

```chain
写线程 | x=1; flag=true(volatile) | ①
规则一 | 程序次序:x=1 hb flag=true | ②
规则二 | volatile 写 hb 后续 volatile 读 | ③
读线程 | 读到 flag 为 true ⇒ x 必为 1 | ④
```

> [!tip] 传递性是最实用的一条
> 写线程在 volatile 写**之前**的所有普通写,都跟着这条 volatile 写一起对读线程可见。这就是「借一个 volatile 变量发布一组成果」的原理(状态机结果、CopyOnWrite 快照发布都靠它)。

## 重排序

| 层次 | 谁做的 |
|---|---|
| 编译器优化重排 | javac / JIT(不改语义的前提下调换顺序) |
| 指令级并行重排 | CPU 乱序执行 |
| 内存系统重排 | 写缓冲区 / 缓存一致性导致的可见延迟(表现为「看起来乱序」) |

> [!note] as-if-serial 是底线
> 单线程内不管怎么重排,**执行结果必须与顺序执行一致**;有数据依赖的语句(`a=1; b=a;`)不会被重排。多线程没有这个兜底,得自己用 hb 关系建立。

> [!warning] 缺 hb 就是数据竞争
> 两个线程一读一写同一变量且之间没有 hb 关系 → 数据竞争 → 读到的值未定义(旧值、新值都可能,甚至看到撕裂的中间态)。

## 与各原语的落点

| 原语 | 在 JMM 里的落点 |
|---|---|
| [[volatile]] | volatile 变量规则 + 4 类内存屏障(StoreStore/StoreLoad/LoadLoad/LoadStore) |
| [[synchronized]] | 管程锁定规则:unlock 前的所有写,对后续 lock 全可见 |
| final 字段 | 构造器中正确初始化后无同步即可被其他线程看到(前提是 `this` 不逸出) |
| [[CAS 与原子类]] | volatile 读 + CAS 写,语义等价于 volatile 变量规则 |
| 线程协作 | [[进程与线程]] 的 start/join 对应线程启动 / 终止规则 |

<details>
<summary>面试问答 (4题)</summary>

Q：什么是 JMM？

A：Java 内存模型,JSR-133 定义的规范。它规定线程如何与主内存交互、一个线程的写何时对另一个线程可见,目的是屏蔽硬件与编译器差异,给 Java 程序一套跨平台一致的并发语义。

Q：happens-before 是时间上的先后吗？

A：不是。它是一组**偏序规则**:A hb B 表示 A 的结果对 B 可见且 A 不会被重排到 B 之后。时间上先发生但无 hb 关系,读到的仍可能是旧值。常用的是程序次序、管程锁定、volatile 变量与传递性。

Q：volatile 写之前的普通变量,读线程为什么也能看到？

A：三条串起来——程序次序让普通写 hb volatile 写;volatile 变量规则让 volatile 写 hb 读线程的 volatile 读;程序次序再传到读线程后续操作。由传递性,普通变量也就可见了。

Q：为什么双重检查单例在 JDK 5 之前不安全？

A：JSR-133 之前 volatile 不禁止重排序,`instance = new Singleton()` 的「赋值引用」可能排到「初始化」之前,其他线程拿到未初始化的对象。JDK 5 加强 volatile 语义后 DCL 才成立。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：happens-before = 先发生。它约束的是可见性与有序性,不是墙钟时间。
- 误区：JMM 描述堆和栈怎么放。它描述的是**访问协议**;内存布局属于 [[JVM 运行时数据区]]。
- 误区：单线程也有可见性问题。单线程内 as-if-serial 保证结果与顺序执行一致,可见性问题只在多线程共享时出现。

</details>
