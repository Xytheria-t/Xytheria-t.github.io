---
title: JVM 运行时数据区
category: jvm
order: 5
aliases: [JVM 内存划分, JVM内存划分, JVM 内存区域, 运行时数据区]
---

# JVM 运行时数据区

JVM 运行时数据区是 JVM 执行 Java 程序时划分出的若干块内存区域的总称，每块各有固定的存放内容与生命周期。它划的是「内存分成哪几块」的边界，不涉及对象何时被回收（那属 [[JVM 垃圾回收]]）。

## 思维链路速查

```chain
区域全景 | 共享与私有两分 | 骨架
堆内布局 | 分代与对象流转 | 主体
栈与元空间 | 栈帧 · 类元数据 | 边界
堆外与排障 | 直接内存 · OOM 信号 | 收尾
面试问答 | 高频考点 | 复盘
```

以「随线程生灭还是随进程生灭」切开内存，再看堆内对象流转、栈帧与类元数据的归宿与堆外内存。

## 区域全景

| 区域 | 归属 | 存放内容 | 溢出信号 |
|---|---|---|---|
| 程序计数器 | 线程私有 | 当前字节码指令地址（native 方法时为空） | 唯一未规定 OOM 的区域 |
| 虚拟机栈 | 线程私有 | 栈帧：局部变量表 / 操作数栈 / 动态连接 / 返回地址 | `StackOverflowError`；扩栈失败转 OOM |
| 本地方法栈 | 线程私有 | native 方法调用栈 | 同上 |
| 堆 | 线程共享 | 对象实例、数组、字符串常量池、静态变量（JDK 7+） | `OOM: Java heap space` |
| 方法区（元空间） | 线程共享 | 类型信息、字段与方法字节码、运行时常量池 | `OOM: Metaspace` |
| 直接内存 | 堆外 | NIO `DirectByteBuffer`、`Unsafe` 分配 | `OOM: Direct buffer memory` |

判据是生命周期：堆虽大却共享，程序计数器只有一个字长却私有。这是 [[JVM]] 内存问题的第一刀；线程维度见 [[进程与线程]]，类元数据见 [[类加载过程]]。

> [!warning] HotSpot 两栈合一
> 虚拟机栈与本地方法栈是同一块内存，`-Xss` 同时决定两者大小与 native 调用深度。

## 堆内布局

| 分区 | 默认占比 | 作用 | 参数 |
|---|---|---|---|
| 新生代 | 堆的 1/3 | 对象出生与快速回收 | `-Xmn` / `-XX:NewRatio=2` |
| Eden | 新生代 8/10 | 绝大多数对象在此分配 | `-XX:SurvivorRatio=8` |
| Survivor From / To | 各 1/10 | 复制算法的中转，永远空一块 | 同上 |
| 老年代 | 堆的 2/3 | 长寿对象、大对象 | `-XX:NewRatio=2` |

对象从分配到晋升：

```chain
栈上分配 | 逃逸分析判定不出方法 | 免入堆
TLAB | Eden 内线程私有缓冲 | 无锁分配
Eden | 分配起点 | 朝生夕死
Survivor | Minor GC 后复制存活者 | 年龄 +1
老年代 | 阈值 15 / 动态年龄 / 大对象 | 长驻
```

- TLAB：每线程在 Eden 私有一小块，分配只挪指针不加锁（`-XX:+UseTLAB` 默认开，耗尽才走带锁 CAS）。
- 晋升两条出口：熬过 `-XX:MaxTenuringThreshold`（默认 15）次 GC，或 Survivor 同龄对象占比过半触发动态年龄判定、整批晋升。
- 大对象直入老年代：超 `G1HeapRegionSize` 一半（Serial / ParNew 是 `PretenureSizeThreshold`）免复制，短命则填满老年代。

## 元空间取代永久代

| 维度 | 永久代（≤ JDK 7） | 元空间（JDK 8+） |
|---|---|---|
| 位置 | JVM 堆内 | 本地内存 |
| 上限 | `-XX:MaxPermSize` 固定 | 默认受物理内存限制，`-XX:MaxMetaspaceSize` 封顶 |
| 内容 | 类元数据 + 字符串常量池 + 静态变量 | 仅类元数据（另含运行时常量池） |
| 回收时机 | 随 Full GC | 类加载器死亡即回收，独立于堆 GC |

JDK 7 把字符串常量池与静态变量搬到堆，JDK 8 再用元空间替掉永久代、只留类元数据，永久代 OOM 大减。不封顶不等于安全：反射、CGLib、热部署持续生成新类，不设 `-XX:MaxMetaspaceSize` 会吃光本地内存。

## String.intern() 与字符串驻留

| 维度 | JDK 6（池在永久代） | JDK 7+（池在堆） |
|---|---|---|
| 池中没有该内容时 | 复制一份进池 | 把堆中该对象的引用记入池 |
| 对 new 出的串调用后拿到 | 池中副本 | 池中引用，即原对象本身 |
| `new String(x).intern() == 原串` | 恒 false | 池中此前无此内容时为 true |

判据只有一条：已驻池 → 返回池中引用，未驻池 → 入池后返回。入池是**惰性**的——字面量首次被 `ldc` 解析才进池（与 [[类加载过程]] 同源）；`"java"` 这类字面量在 HotSpot 启动阶段就已驻池，编译期可折叠的拼接（`"a"+"b"`、`final` 常量）也直接成字面量。字符串池是张哈希表（默认 60013 桶，JDK 7u40 起），只增不减：大批量 intern 在 JDK 6 会 `PermGen OOM`，JDK 7+ 拖慢查找本身；去重堆内串用 G1 的 `-XX:+UseStringDeduplication`。

> [!warning] 锁对象陷阱的根因
> 字面量驻池意味着 `"x"` 在任何模块写出都是同一引用——所以 [[synchronized]] 不能拿字符串字面量当锁（作用域变成全局共享表），要用 `new Object()` 私有常量。

## 栈帧结构

| 组成 | 内容 | 要点 |
|---|---|---|
| 局部变量表 | 方法参数 + 局部变量，以 slot 为单位 | `long` / `double` 占 2 个 slot；实例方法 slot 0 是 `this` |
| 操作数栈 | 字节码的运算现场 | `iadd` 弹两个、压一个 |
| 动态连接 | 指向运行时常量池的方法引用 | 支撑多态分派 |
| 返回地址 | 正常返回 / 异常出口 | 异常走异常表，不走返回地址 |

局部变量表与操作数栈的最大深度编译期就写进 Code 属性的 `max_locals` / `max_stack`，运行时不伸缩。`-Xss` 是每线程固定开销：1 MB × 1000 线程 ≈ 1 GB 虚拟内存，报 `unable to create native thread` 多半是栈吃光地址空间，降 `-Xss` 或换线程池。

## 直接内存

| 维度 | 堆内 `ByteBuffer` | 直接内存 `DirectByteBuffer` |
|---|---|---|
| 分配 | `ByteBuffer.allocate` | `allocateDirect` / `Unsafe.allocateMemory` |
| 位置 | 堆（GC 直接管） | 本地内存（GC 只管引用壳） |
| IO 拷贝 | 写 socket 多一次内核缓冲复制 | 零拷贝，省一次复制 |
| 回收 | 随 GC 一起走 | Cleaner（虚引用）触发 `Unsafe.freeMemory` |
| 上限 | `-Xmx` | `-XX:MaxDirectMemorySize` |

直接内存分配慢、回收不即时，只适合长期复用的大缓冲（Netty `PooledByteBufAllocator`）。

> [!danger] 堆还很空也能 OOM
> 壳对象只有几十字节，撑爆的是背后的本地内存；Cleaner 触发看老年代压力——堆使用率 30% 也可能 `OOM: Direct buffer memory`。

## 参数与排障

- `-Xms` 与 `-Xmx` 取同值：不等则堆按负载伸缩，扩容伴随 Full GC。
- OOM 现场靠 `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/data/dump` 留档。
- `GC overhead limit exceeded` = 回收量极少却不停 GC（接近死循环）；`unable to create native thread` 也可能是 `ulimit -u` 不足。

<details>
<summary>面试问答 (4题)</summary>

Q：哪些区域线程共享，哪些私有？

A：共享 = 堆 + 方法区（元空间）；私有 = 程序计数器与两个栈；按随进程 / 随线程生灭划分。

Q：一个对象从创建到进入老年代经历了什么？

A：逃逸分析判定不出方法才进堆 → Eden 的 TLAB 分配 → Minor GC 后进 Survivor、年龄 +1 → 年龄达 15、动态年龄判定或大对象才晋升老年代。

Q：为什么用元空间取代永久代？

A：永久代在堆内、大小固定、类回收靠 Full GC，易 `PermGen space` OOM；元空间在本地内存、随类加载器回收，代价是必须设 `-XX:MaxMetaspaceSize`。

Q：字符串常量池在哪个区？

A：JDK 6 在永久代；JDK 7 起随静态变量移到堆，此后一直在堆。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：堆就是 JVM 的全部内存。元空间、直接内存、代码缓存、线程栈都在堆外，`jstat` 看不到全貌，对齐 RSS 得用 NMT。
- 误区：Minor GC 频繁就是有问题。新生代本就小而对象朝生夕死，频繁且快是分代设计的预期，盯单次耗时与晋升量。
- 误区：`-Xss` 越大越稳。它是每线程固定开销，栈越大能开的线程越少。

</details>
