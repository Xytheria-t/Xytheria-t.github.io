---
title: ReentrantLock
category: juc
aliases: [显式锁, 可重入锁]
---

# ReentrantLock

## 思维链路速查

```chain
加解锁 | lock/unlock | 入口
灵活能力 | 中断/超时/公平 | 核心
Condition | 多等待队列 | 进阶
底层 | AQS 实现 | 原理
面试问答 | 高频考点 | 复盘
```

ReentrantLock 是 JDK 显式互斥锁 → 手动 lock/unlock(必须 finally) → 支持中断/超时/公平/多 Condition → 底层基于 [[AQS]] → 功能强于 [[synchronized]]。

## 基本用法

```java
ReentrantLock lock = new ReentrantLock(); // 默认非公平
lock.lock();
try {
    // 临界区
} finally {
    lock.unlock(); // 必须放 finally,否则异常会永久持锁
}
```

> [!danger] 必须 finally unlock
> 忘记 unlock 且线程异常,锁永久不释放,其他线程全部饿死。这是显式锁相对 synchronized 自动释放的最大风险点。

## 能力矩阵

| 能力 | 方法 | 说明 |
|---|---|---|
| 可中断 | `lockInterruptibly()` | 等待锁时响应中断,打破死锁 |
| 超时获取 | `tryLock(timeout)` | 拿不到超时返回 false,不死等 |
| 立即尝试 | `tryLock()` | 锁空闲就抢,否则立刻返回 false |
| 公平/非公平 | `new ReentrantLock(true)` | 公平按排队顺序,吞吐略低 |
| 多条件 | `newCondition()` | 可建多个等待队列,精准唤醒 |
| 诊断 | `getHoldCount` / `isHeldByCurrentThread` / `hasQueuedThreads` | 排查持锁与排队情况 |

> [!warning] tryLock() 不守公平
> 即使是公平锁,无参 `tryLock()` 也会 barging——锁空闲就直接抢,不查队列;只有 `lock()` / `lockInterruptibly()` 遵守公平排队。要严格排队就别用无参 tryLock。

> [!tip] 多 Condition 优势
> synchronized 只有单一等待集(`wait/notifyAll` 唤醒全部)；ReentrantLock 可建多个 Condition,只唤醒特定条件的线程,避免无谓竞争。

## 与 synchronized 对比

| | synchronized | ReentrantLock |
|---|---|---|
| 释放 | 自动 | 手动 finally |
| 中断 | ❌ | ✅ |
| 超时 | ❌ | ✅ |
| 公平 | ❌ | 可选 |
| Condition | 单 | 多 |
| 底层 | JVM | AQS |

> [!note] 选型
> 只需简单互斥用 [[synchronized]] 更省心；要中断/超时/公平/多条件才上 ReentrantLock。完整对比见 [[Java 锁对比]]。

<details>
<summary>面试问答 (3题)</summary>

Q：ReentrantLock 如何实现可重入？

A：内部维护持有线程与重入计数,同一线程再次 lock 时计数+1,unlock 减到 0 才真正释放,基于 AQS state。

Q：公平锁一定更好吗？

A：公平锁避免饥饿但吞吐更低(排队开销),非公平锁吞吐高但可能饥饿；默认非公平,只在确有饥饿风险时用公平。

Q：公平锁下 tryLock() 会排队吗？

A：不会。无参 `tryLock()` 走非公平尝试,锁空闲直接抢(barging);要排队用 `lock()` / `lockInterruptibly()`,超时场景用 `tryLock(timeout)`(它在公平模式下遵守公平)。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：ReentrantLock 一定比 synchronized 快。JDK6 后两者差距很小,选它是为了中断/超时/公平/多 Condition 这些能力,不是为了性能。
- 误区：公平锁更"正确"所以该默认开。公平锁吞吐明显更低,默认非公平;只有出现真实饥饿才切公平。
- 误区：Condition.await() 期间一直拿着锁。await 会**完全释放锁**并进入条件队列,被 signal 后要重新竞争锁才能返回,所以 await 返回后通常需要重新检查条件(经典 while 循环写法)。

</details>
