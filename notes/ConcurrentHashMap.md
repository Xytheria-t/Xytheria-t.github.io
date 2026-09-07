---
title: ConcurrentHashMap
category: juc
---

# ConcurrentHashMap

## 思维链路速查

```chain
结构演进 | 1.7 分段锁 → 1.8 桶级锁 | 入口
写路径 put | CAS / 桶锁 / 协助扩容 | 核心
读路径 get | volatile 撑起的无锁读 | 对照
计数与迭代 | LongAdder 式计数 + 弱一致 | 细节
面试问答 | 高频考点 | 复盘
```

线程安全终究要靠锁，但锁整张表就退回 Hashtable 了——ConcurrentHashMap 的设计主线是把锁一路缩小：1.7 锁一段，1.8 锁一个桶头，读路径干脆不加锁，由 volatile 兜住可见性。

## 结构演进：1.7 分段锁 → 1.8 桶级锁

先立结构再谈锁：Java 7 把整张表横向切成若干 **Segment（段）**，每段是一张独立的小哈希表、自带一把锁——写不同段互不阻塞，能同时写的线程数叫**并发度**；Java 8 抛掉分段，回到单张大表，把锁缩到每个桶的头节点。

| 维度 | Java 7：Segment 分段锁 | Java 8：CAS + synchronized |
|---|---|---|
| 外层结构 | Segment 数组，每段一张小表 | Node 数组一张大表 + 链表/红黑树 |
| 锁实现 | Segment 继承 ReentrantLock（state 靠 CAS，见 [[AQS]]） | CAS 写空桶 + synchronized 锁桶头 |
| 锁粒度 | 一段（并发度 = 段数，默认 16） | 一个桶（并发度 ≈ 桶数） |
| 哈希定位 | 先定位段、再定位桶，两次哈希 | spread(h) 一次定位桶 |

> [!tip] 为什么 1.8 弃用分段锁
> 锁已细到桶级，单桶冲突少、持锁极短，synchronized 经锁升级优化后的低竞争路径足够轻（见 [[synchronized]]）；而每段一把 ReentrantLock 要多养一份 AQS 队列对象，表越大这笔内存越不划算。

## 写路径：put 的五步决策

```chain
扰动寻址 | spread(h) 定位桶 | 无锁
空桶 | CAS 放入首节点 | 无锁
ForwardingNode | helpTransfer 协助迁移 | 扩容中
非空桶 | synchronized 锁头节点写入 | 桶级锁
写入后 | 树化判定 + addCount 触发扩容 | 收尾
```

<details>
<summary>展开 put 决策流程图</summary>

```mermaid
flowchart TD
  S([put(key, value)]) --> H["spread(h) 定位桶"]
  H --> E{"桶为空?"}
  E -->|是| CAS["CAS 放入首节点"]
  E -->|否| M{"头节点 hash == MOVED?"}
  M -->|是| HT["helpTransfer 协助扩容后重试"] --> H
  M -->|否| LK["synchronized 锁头节点"]
  LK --> W["遍历链表/红黑树：追加或覆盖"]
  W --> T{"链表 ≥ 8 且表长 ≥ 64?"}
  T -->|是| TREE["树化为红黑树"]
  T -->|否| AC["addCount 计数"]
  TREE --> AC
  AC --> X{"元素数达扩容阈值?"}
  X -->|是| RS["触发扩容 transfer"]
  X -->|否| D([结束])
  RS --> D
```

</details>

逐个解释流程里的专名：

- **spread(h)**：扰动函数，`(h ^ (h >>> 16)) & 0x7fffffff`——高低 16 位异或让高位参与寻址（与 HashMap 同思路），再抹掉符号位保证 hash 非负，因为负数被挪作特殊标记。
- **ForwardingNode**：hash = MOVED(-1) 的占位节点，插在「已迁走」的桶头上，读它转发去新表、写它先帮忙迁移。
- **树化**：链表长度 ≥ 8 且表长 ≥ 64 才转红黑树，否则优先扩容稀释冲突——阈值依据与 HashMap 相同（链表长度服从泊松分布，到 8 的概率极低）。
- **扩容并发**：transfer 按步长（stride，最小 16 个桶）把桶分段「承包」给线程，各迁各的；sizeCtl 负值编码参与线程数。

| sizeCtl 取值 | 含义 |
|---|---|
| 未初始化且 > 0 | 初始容量建议 |
| = -1 | 正在初始化（CAS 抢到 -1 的线程干活，其余让步） |
| < -1 | 正在扩容，负值编码参与迁移的线程数 |
| 初始化后 > 0 | 下次扩容阈值 ≈ 容量 × 0.75 |

> [!note] 初始化也要防并发
> 多线程同时 put 触发建表时，靠 CAS 把 sizeCtl 置 -1 抢初始化权，没抢到的线程让出 CPU 等表建好——整张表只会被建一次。

## 读路径：get 为什么全程无锁

可见性由三个 volatile 兜住，读线程既不加锁也不 CAS 重试：

| 读线程要拿什么 | 靠什么保证可见 |
|---|---|
| 桶数组 table（扩容换表） | table 用 volatile 修饰 |
| 节点的值 Node.val | volatile 写 |
| 节点的后继 Node.next | volatile 写（链表追加/树化改链不丢节点） |

volatile 写 happens-before 后续的 volatile 读（语义见 [[volatile]] 与 [[JMM]]），所以写线程落盘的值读线程立刻可见；扩容期间读到 ForwardingNode 就顺着它去新表找——迁移中的桶读不丢、写不挡。

> [!warning] 无锁读 = 弱一致读
> get 保证「写完成后一定能读到」，但不保证「遍历瞬间看到全局精确快照」——这是设计语义，不是 bug。

## 计数：size() 为什么是近似值

所有写都往一个计数器上 CAS，高并发下会撞成热点（[[CAS 与原子类]] 里的自旋问题）。CHM 因此把 LongAdder 的**分桶计数**直接搬了进来：

```chain
写入计数 | 先 CAS baseCount | 冲突
冲突分流 | 散到 CounterCell[] 各加各的 | 分桶
读取 size | baseCount + Σ cells 求和 | 近似
```

- **baseCount** 是基数，**CounterCell[]** 是分桶数组（`@Contended` 填充防伪共享），写冲突越大、cell 越多。
- size() 是求和瞬间的近似值；并发修改中它不保证精确。要长整型防溢出用 mappingCount()；要精确计数就换外部同步或专门的计数结构。

## null 禁令与弱一致迭代

**为什么 key/value 都不许 null**：并发下 `get(k)` 返回 null 有**二义性**——分不清「键不存在」还是「存了 null」。单线程 HashMap 可以补一次 containsKey 确认，并发下这是 check-then-act：两次调用之间键可能被别的线程改掉，补判也不可靠，干脆禁止。

迭代器是**弱一致**（weakly consistent）：创建后先保证遍历到「创建时刻已存在」的元素，之后的增删可能看到可能看不到，但**不抛** ConcurrentModificationException（HashMap 是 fail-fast 快速失败，一改就抛）。

| 维度 | HashMap | Hashtable | ConcurrentHashMap |
|---|---|---|---|
| 线程安全 | 否 | 方法级 synchronized，锁全表 | 桶级锁 + CAS |
| null key/value | 允许 | 禁止 | 禁止 |
| 并发性能 | —— | 全表互斥，几乎串行 | 写锁单桶，读无锁 |
| 迭代语义 | fail-fast | fail-fast | 弱一致 |

## 落地：复合操作的正确写法

> [!danger] 单操作原子 ≠ 复合原子
> put/get 各自原子，但「先 get 判断、再 put」是两步，中间可能被插队。计数、去重这类逻辑必须用内部锁同一桶头的整段原子方法。

```java
// 反例：check-then-act，两步之间可能被其他线程改掉
if (!map.containsKey(k)) { map.put(k, v); }

// 正例：单调用原子
map.putIfAbsent(k, v);
map.computeIfAbsent(k, key -> expensiveLoad(key));
map.merge(k, 1, Integer::sum);          // 并发计数
```

<details>
<summary>面试问答 (4题)</summary>

Q：1.8 为什么用 synchronized 不用 ReentrantLock？

A：锁粒度已到桶级，冲突少、持锁短，synchronized 锁升级后的轻量路径足够；还省去每个桶头挂 AQS 结构的内存，JDK 6 后性能也不落后。

Q：多线程怎么一起扩容？

A：transfer 把桶按步长（最小 16）分段承包给线程，各迁各的；迁完的桶头放 ForwardingNode，其他线程读到它要么转发读、要么协助迁，sizeCtl 负值记录参与线程数。

Q：size() 准确吗？

A：不保证。它是 baseCount 加各 CounterCell 的瞬时求和（LongAdder 思路），并发写时是近似值；要精确需外部同步。

Q：ConcurrentHashMap 能替代 Hashtable 吗？

A：能。Hashtable 只为兼容旧 API 保留；Collections.synchronizedMap 也是全对象锁，性能远不如桶级锁。

</details>

<details>
<summary>常见误区 (4条)</summary>

- 误区：方法线程安全，组合起来也安全。check-then-act 复合操作不原子，要用 putIfAbsent / compute / merge。
- 误区：默认并发度 16 是 1.8 的概念。16 是 1.7 的段数；1.8 并发度取决于桶数，构造参数只当初始容量提示。
- 误区：无并发也该用 ConcurrentHashMap。单线程下 volatile 读和 CAS 有额外成本，HashMap 更快，按并发需求选。
- 误区：get 读到「旧一拍」的值是实现缺陷。弱一致是设计语义，可见性由 volatile 保证，写完成必可见。

</details>
