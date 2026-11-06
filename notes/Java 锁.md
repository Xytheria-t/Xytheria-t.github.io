---
title: Java 锁
type: moc
category: juc
featured: Java 锁对比
---

# Java 锁

Java 并发同步原语总览:JMM(Java 内存模型)定语义,内置锁与可见性原语打底,显式锁/读写锁/乐观锁补能力,底层由 CAS / AQS 支撑,死锁排查兜住故障面;按场景选型。

## 阅读路线

```chain
基础语义 | volatile + synchronized | 入口
横评选型 | Java 锁对比 | 对比
显式锁族 | ReentrantLock → 读写锁 → StampedLock | 进阶
底层支撑 | CAS 与原子类 → AQS → LockSupport | 原理
故障排查 | 死锁四条件与定位 | 实战
```

语义(volatile/synchronized)打底 → 横评表给一把选型尺子 → 按需深入某把显式锁 → 落到 CAS/AQS 实现层与死锁排查;维度从「语义」下沉到「机制」,按场景回头挑最便宜的那把。共享同步器（Semaphore/CountDownLatch/CyclicBarrier）已并入 [[Java 锁对比]]，不单列。

- [[Java 锁对比]]
- [[synchronized]]
- [[volatile]]
- [[DCL]]
- [[ReentrantLock]]
- [[ReentrantReadWriteLock]]
- [[StampedLock]]
- [[CAS 与原子类]]
- [[AQS]]
- [[死锁]]
