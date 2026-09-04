---
title: StampedLock
category: juc
aliases: [戳记锁, 乐观读锁]
---

# StampedLock

## 思维链路速查

```chain
四种获取 | 写/读/乐观读/尝试 | 入口
乐观读 | 无锁+戳校验 | 核心
模式转换 | 戳记升降级 | 进阶
不可重入 | 与 Reentrant 区别 | 边界
面试问答 | 高频考点 | 复盘
```

StampedLock(JDK8)用戳记(stamp)管理三种模式 → 乐观读无锁读后校验戳 → 戳记还能在持有锁时升降级 → 但不可重入、无原生 Condition → 适合极读多写少且读短。

## 获取方式

| 方式 | 方法 | 并发 | 说明 |
|---|---|---|---|
| 写锁 | `writeLock()` / `writeLockInterruptibly()` | 独占 | 返回 stamp,用 `unlockWrite(stamp)` 释放 |
| 读锁 | `readLock()` / `readLockInterruptibly()` | 共享 | 阻塞直到无写,用 `unlockRead(stamp)` 释放 |
| 乐观读 | `tryOptimisticRead()` | 无锁 | 返回 stamp,不阻塞;**返回 0 表示正被写锁持有** |
| 超时尝试 | `tryReadLock(t)` / `tryWriteLock(t)` | — | 拿不到就超时返回 0 |

## 乐观读用法

```java
StampedLock sl = new StampedLock();
long stamp = sl.tryOptimisticRead(); // 无锁拿戳
int v = data;                         // 读进局部变量
if (!sl.validate(stamp)) {            // 戳变了说明有写
    stamp = sl.readLock();            // 升级为读锁重读
    try { v = data; } finally { sl.unlockRead(stamp); }
}
```

> [!danger] 乐观读的两个陷阱
> 1. **先把值读进局部变量再 `validate`**：边校验边读共享字段,校验通过也可能读到被写线程改过的新值,前后不一致。
> 2. **`tryOptimisticRead()` 返回 0 = 已有写锁持有**,直接走 `readLock()` 悲观读,别拿 0 继续乐观读。

## 模式转换

> [!tip] 持锁状态下也能升降级
> `tryConvertToWriteLock(stamp)` / `tryConvertToReadLock(stamp)` / `tryConvertToOptimisticRead(stamp)`：在已持锁时尝试换模式,成功返回新 stamp(**不释放锁**),失败返回 0 再走常规获取。这是 [[ReentrantReadWriteLock]] 没有的能力。

## 不可重入与接口适配

> [!warning] 不可重入 & 无 Condition
> StampedLock **不可重入**,同一线程重入会死锁;也没有 Condition 原生支持。需要可重入/多条件时退回 [[ReentrantReadWriteLock]]。补偿手段：`asReadLock()` / `asWriteLock()` 把戳记包装成 `Lock` 视图,给只认 `Lock` 接口的 API 用。

## 与读写锁对比

| | ReentrantReadWriteLock | StampedLock |
|---|---|---|
| 读方式 | 读锁(阻塞) | 乐观读(无锁)+校验 |
| 可重入 | ✅ | ❌ |
| 可中断 | ✅ read/writeLockInterruptibly | ✅ read/writeLockInterruptibly |
| Condition | ✅(仅写锁) | ❌ |
| 锁降级 | ✅ 写→读 | ✅ tryConvertToReadLock |
| 极读多性能 | 中 | 优 |

> [!note] 选型
> 极端读多写少、读操作短 → StampedLock 乐观读；否则读写锁更稳。完整对比见 [[Java 锁对比]]。

<details>
<summary>面试问答 (3题)</summary>

Q：乐观读为什么快？

A：tryOptimisticRead 不加锁,只是读戳,无阻塞、无 CAS 争用；只有戳被写变更才升级为读锁重读,读多写少时几乎零竞争开销。

Q：StampedLock 能替代读写锁吗？

A：不能完全替代：不可重入、无 Condition,且在写稍多时乐观读频繁升级反而更慢；按读写比选型。

Q：乐观读期间要注意什么？

A：先把所有需要的字段读进局部变量,再 validate(stamp);读过程不能有副作用,否则校验失败重读时会重复执行。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：乐观读随便用。读期间不要调有副作用的方法,读多个字段必须先进局部变量,否则读到的是不一致快照。
- 误区：StampedLock 完全不可中断。`readLockInterruptibly()` / `writeLockInterruptibly()` 就是中断版,只是普通 `readLock()` 不响应中断。
- 误区：StampedLock 全面优于读写锁。写稍多时乐观读频繁校验失败 + 重读,开销反超读写锁;且不可重入,改造老代码风险高。

</details>
