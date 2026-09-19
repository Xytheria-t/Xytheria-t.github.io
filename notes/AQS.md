---
title: AQS
category: juc
aliases: [AbstractQueuedSynchronizer, AQS 框架]
---

# AQS

:::lede
AQS（AbstractQueuedSynchronizer，抽象队列同步器）是 JUC 中同步器共用的骨架基类，把「抢不到就排队阻塞、释放时唤醒后继」这套通用逻辑抽成模板方法供子类继承。它本身不是锁，state 代表什么（重入数、许可数还是计数）由子类定义。
:::

## 思维链路速查

```chain
核心结构 | state + CLH 队列变体 | 骨架
获取流程 | tryAcquire→入队→park | 核心
模板方法 | tryAcquire/Release | 扩展点
独占/共享 | 两种模式 | 模式
面试问答 | 高频考点 | 复盘
```

AQS(AbstractQueuedSynchronizer)是 JUC 同步器基石 → 用 volatile int state + CLH 队列变体 → 抢锁失败入队 park、释放时 unpark 后继 → 子类只重写 tryAcquire/tryRelease → 支撑 [[ReentrantLock]]、Semaphore、CountDownLatch。

## 核心结构

| 组件 | 作用 |
|---|---|
| `volatile int state` | 同步状态(0=未占用,>0=重入次数/许可数),CAS 修改 |
| 同步队列 | CLH 队列**变体**:双向 Node 队列,抢锁失败线程 park 入队 |
| head / tail | 队列头尾指针,head 是"当前持锁"的哨兵节点 |
| `Node.waitStatus` | CANCELLED(1 已取消) / SIGNAL(-1 需唤醒后继) / CONDITION(-2 在条件队列) / PROPAGATE(-3 共享传播) |

> [!note] 为什么是 CLH 变体
> 经典 CLH 是**单向 + 自旋**;AQS 改成**双向(加 prev 指针) + park/unpark**。加 prev 才能处理节点取消与中断出队,改 park 才不至于空烧 CPU。

## 获取流程

```chain
tryAcquire | 抢 state | 快路径
addWaiter | 失败包装 Node 入队尾 | 入队
acquireQueued | 前驱是 head 才再抢,否则 park | 阻塞
release | unpark 后继,被唤醒者接替 | 出队
```

<details>
<summary>展开获取流程图</summary>

```mermaid
flowchart TD
  A([acquire]) --> B{tryAcquire 成功}
  B -->|是| Z([持有锁返回])
  B -->|否| C[addWaiter 包装成 Node 入队尾]
  C --> D{前驱是 head 且 tryAcquire 成功}
  D -->|是| E[setHead 出队]
  E --> Z
  D -->|否| F[shouldParkAfterFailedAcquire 前驱置 SIGNAL]
  F --> G[LockSupport.park 挂起]
  G --> D
```

</details>

## 底层原语：LockSupport

AQS 的挂起/唤醒**全走 LockSupport**:能精确唤醒、脱离 monitor、可被中断。

- `park()` / `parkNanos` / `parkUntil`:有许可就消耗返回,否则阻塞;`park(Object blocker)` 让 `jstack` 看到阻塞对象
- `unpark(t)`:给指定线程补 1 个许可,许可**二元**——连 unpark 5 次再 park 只放行 1 次
- 会**虚假唤醒**,必须 `while (!canAcquire()) park(this)`(`acquireQueued` 即如此);被中断唤醒只置标记**不抛异常**,调用方自检,否则 `lockInterruptibly` 语义失效
- 落点:`shouldParkAfterFailedAcquire` 置前驱 SIGNAL → park;`unparkSuccessor` 唤醒 head 后继;`cancelAcquire` 修正指针后仍交 unpark 唤醒

### park vs wait vs suspend

| 维度 | LockSupport | Object.wait / notify | Thread.suspend / resume |
|---|---|---|---|
| 需不需要持锁 | ❌ | ✅ 必须在 synchronized 内 | ❌ |
| 唤醒目标 | 精确指定线程 | notify 随机 / notifyAll 全体 | 指定线程 |
| 可先于阻塞调用 | ✅ 先 unpark 不丢失 | ❌ 先 notify 后 wait 信号丢失 | ❌ 先 resume 永久挂起 |
| 中断响应 | 直接返回,**不抛异常** | 抛 `InterruptedException` | — |
| 现状 | 推荐 | 配合 [[synchronized]] 仍可用 | 已废弃(易死锁) |

## 模板方法（子类重写）

| 模式 | 方法 |
|---|---|
| 独占 | `tryAcquire` / `tryRelease` |
| 共享 | `tryAcquireShared` / `tryReleaseShared` |
| 判断 | `isHeldExclusively` |

入队、park/unpark、CAS 改 state、取消与中断处理都由 AQS 实现,子类只定义「如何获取/释放 state」。

## 两种模式

- **独占**:同一时刻一个线程持有。例：[[ReentrantLock]]、ReentrantReadWriteLock 的写锁。
- **共享**:多个线程可同时持有。例：[[ReentrantReadWriteLock]] 的读锁、共享同步器(见 [[Java 锁对比]])。

> [!tip] 共享模式会传播
> 共享释放走 `doReleaseShared` + `setHeadAndPropagate`,唤醒是**级联**的,多个等待者一起放行,而不是一次只放一个。

## Condition：第二条队列

> [!note] ConditionObject 是独立的条件队列
> `await()` 会**完全释放锁**并把节点移入条件队列;`signal()` 把节点移回同步队列重新排队抢锁。这就是 [[ReentrantLock]] 能有多个等待集、而 [[synchronized]] 只有一个等待集的原因。

## 依赖 AQS 的组件

| 组件 | 模式 | state 语义 |
|---|---|---|
| [[ReentrantLock]] | 独占 | 重入次数 |
| [[ReentrantReadWriteLock]](写) | 独占 | 读/写锁各占 16 位 |
| [[ReentrantReadWriteLock]](读) | 共享 | 同上 |
| 共享同步器(Semaphore / CountDownLatch / CyclicBarrier) | 共享 | 见 [[Java 锁对比]] 共享同步器一节 |

<details>
<summary>面试问答 (2题)</summary>

Q：AQS 怎么实现阻塞？

A：抢锁失败线程包装成 Node 入 CLH 队列变体,前驱置 SIGNAL 后 `LockSupport.park()` 挂起;持有者释放时 `unpark` 唤醒后继。

Q：state 为什么用 volatile？

A：保证可见性,并配合 CAS 实现无锁原子修改。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：AQS 队列就是经典 CLH。经典 CLH 单向自旋,AQS 是双向 + park 的变体,多了 prev 指针才能处理取消与中断。
- 误区：state 就是"锁重入次数"。语义由子类定义,可以是重入数、许可数、门闩计数。
- 误区：公平性由 AQS 保证。AQS 只提供 `hasQueuedPredecessors()`,查不查取决于子类——非公平实现故意不查,才能插队(barging)、吞吐更高。

</details>
