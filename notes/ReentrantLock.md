---
title: ReentrantLock
category: juc
aliases: [显式锁, 可重入锁]
---

# ReentrantLock

:::lede
ReentrantLock 是 JDK 提供的显式互斥锁，由 AQS 实现且可重入，加锁解锁都要自己写。它相对内置锁的增量在于可中断、可超时、可选公平与多条件队列，代价是锁的释放必须由调用方保证。
:::

ReentrantLock 是 JDK 显式互斥锁 → 手动 lock/unlock(必须 finally) → 支持中断/超时/公平/多 Condition → 底层基于 [[AQS]] → 功能强于 [[synchronized]]。

## 基本用法

```java
ReentrantLock lock = new ReentrantLock(); // 默认非公平
lock.lock();
try {
    // 临界区
} finally {
    lock.unlock();
}
```

> [!danger] 必须 finally unlock
> 忘记 unlock 且线程异常 → 锁永久不释放,其他线程全部饿死;这是显式锁相对 synchronized 自动释放的最大风险。

## 能力矩阵

| 能力 | 方法 | 说明 |
|---|---|---|
| 可中断 | `lockInterruptibly()` | 等待锁时响应中断,打破死锁 |
| 超时获取 | `tryLock(timeout)` | 拿不到超时返回 false,不死等 |
| 立即尝试 | `tryLock()` | 锁空闲就抢,否则立刻返回 false |
| 公平/非公平 | `new ReentrantLock(true)` | 公平按排队顺序,吞吐略低 |
| 多条件 | `newCondition()` | 可建多个等待队列,精准唤醒(见 [[AQS]] 条件队列) |

> [!warning] tryLock() 不守公平
> 即使是公平锁,无参 `tryLock()` 也会 barging——锁空闲就直接抢,不查队列;只有 `lock()` / `lockInterruptibly()` 遵守公平排队,`tryLock(timeout)` 在公平模式下也遵守。

## 与 synchronized 对比

| | synchronized | ReentrantLock |
|---|---|---|
| 释放 | 自动 | 手动 finally |
| 中断 | ❌ | ✅ |
| 超时 | ❌ | ✅ |
| 公平 | ❌ | 可选 |
| Condition | 单 | 多 |
| 底层 | JVM | AQS |

只需简单互斥用 [[synchronized]] 更省心;要中断/超时/公平/多条件才上 ReentrantLock。完整对比见 [[Java 锁对比]]。

<details>
<summary>面试问答 (2题)</summary>

Q：ReentrantLock 如何实现可重入？

A：AQS 的 `state` 记重入次数:同一线程再次 lock 计数+1,减到 0 才真正释放。

Q：公平锁一定更好吗？

A：公平锁避免饥饿但排队开销大、吞吐更低;默认非公平,只在确有饥饿风险时用公平。

</details>

<details>
<summary>常见误区 (2条)</summary>

- 误区：ReentrantLock 一定比 synchronized 快。JDK6 后两者差距很小,选它是为中断/超时/公平/多 Condition,不是为性能。
- 误区：`Condition.await()` 期间一直拿着锁。await 会**完全释放锁**并进入条件队列,被 signal 后要重新竞争锁才能返回,所以要用 `while` 循环重新检查条件。

</details>
