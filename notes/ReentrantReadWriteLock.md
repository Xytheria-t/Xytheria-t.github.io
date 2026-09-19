---
title: ReentrantReadWriteLock
category: juc
aliases: [读写锁, 读写分离锁]
---

# ReentrantReadWriteLock

:::lede
ReentrantReadWriteLock 是一对配套的读写锁（读锁共享、写锁独占），基于 AQS 实现且可重入。它把「读」与「写」分开授权，只为读多写少的场景降低互斥成本，写多时并不比普通互斥锁划算。
:::

## 思维链路速查

```chain
锁结构 | 读锁+写锁 | 入口
互斥规则 | 读写/写写互斥 | 核心
锁降级 | 写→读 | 进阶
适用与局限 | 读多写少 | 实战
面试问答 | 高频考点 | 复盘
```

ReentrantReadWriteLock 维护一对锁(读共享/写独占) → 读读并发、读写/写写互斥 → 支持写锁降级为读锁 → 适合缓存等读多写少场景。

## 互斥规则

| 组合 | 是否互斥 |
|---|---|
| 读 — 读 | ❌ 并发(共享) |
| 读 — 写 | ✅ 互斥 |
| 写 — 写 | ✅ 互斥 |

读锁与写锁取自同一实例:`rw.readLock()` 可多线程同时持有,`rw.writeLock()` 独占。

> [!note] 谁有 Condition
> 只有**写锁**支持 `newCondition()`;对读锁调 `newCondition()` 抛 `UnsupportedOperationException`。这是与 [[ReentrantLock]] 的关键差异。

## 锁降级

> [!note] 写锁可降级,读锁不可升级
> 持有写锁时获取读锁,再释放写锁 → 写降级为读,保证降级过程数据可见。**读锁不能升级为写锁**——多个读线程互相等对方放读锁会死锁。

```java
writeLock.lock();
try {
    data = compute();
    readLock.lock();    // 先拿读锁
} finally {
    writeLock.unlock(); // 再放写锁 → 降级为读,此时仍持读锁
}
readLock.unlock();
```

## 适用与局限

| 维度 | 结论 |
|---|---|
| 读多写少 | ✅ 缓存、配置表,读操作远多于写 |
| 写多或读写均衡 | ❌ 写锁独占,优势消失,甚至不如普通互斥锁 |
| 临界区极小 | ⚠️ 读写锁获取/释放比互斥锁重,临界区太小反而更慢 |
| 公平性 | 构造器可选;非公平下连续到达的读锁会让写锁饥饿 |
| 极端读多 | 换 [[StampedLock]] 乐观读更优 |

完整对比见 [[Java 锁对比]]。

<details>
<summary>面试问答 (1题)</summary>

Q：为什么读锁不能升级为写锁？

A：多个读线程都尝试升级会互相等对方放读锁,形成死锁;故只允许写→读降级。

</details>

<details>
<summary>常见误区 (1条)</summary>

- 误区：读多就一定能提速。读写锁的获取/释放本身比互斥锁重,临界区极小(几行读)时可能反而更慢,要压测。

</details>
