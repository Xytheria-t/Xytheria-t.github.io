---
title: EasyOrange 缓存一致性
category: projects
excerpt: EasyOrange 的统一缓存底座与三模式落地：单层 Redis + fail-open，订单 afterCommit、商品同步失效 + TTL 兜底，ViewCount 走 Write-Behind。
---

# EasyOrange 缓存一致性

## 思维链路速查

```chain
全局底座 | 单层 Redis + fail-open | 框架
三模式落地 | Cache-Aside / Write-Behind / 取舍 | 核心
兜底与边界 | TTL · 分布式锁 · 正交项 | 收尾
```

一致性靠「分层取舍」收敛，不靠消灭窗口：先立单层 Redis + fail-open 的全局底座，再把业务按一致性要求拆进三种模式，余下的边界风险交给 TTL 与分布式锁兜底。

> [!important] 简历口径
> - 设计统一缓存底座（RedisCacheConfig）：单层 Redis + 注解驱动 `@Cacheable`/`@CacheEvict`，业务近零缓存代码
> - 按数据一致性要求分三模式：Cache-Aside+写失效（强一致主数据）、Write-Behind（高频计数）、fail-open（缓存故障降级不阻塞）
> - 关键取舍：订单失效放 afterCommit 防并发回填，商品用同步事件 + TTL 兜底换简单；序列化统一防限流器失灵

通用机制见 [[缓存与数据库一致性]]。本篇只记 EasyOrange 的落地与取舍。

## 全局底座：统一 Redis 单层 + fail-open

所有「与 DB 一致」的缓存跑在同一底座（RedisCacheConfig）：

- **单层 Redis**：早期手写多级缓存（L1 本地 + L2 Redis）已移除，改纯 Redis 单层。理由：单层一致性只靠「写路径显式失效 + TTL 兜底」，不需要 L1/L2 配平和跨节点广播。
- **注解驱动**：业务侧只用 `@Cacheable` / `@CacheEvict`，几乎零缓存代码（适配层实现端口，方法体为空）。
- **统一短 TTL**：`default-ttl` 控制，最后防线是「TTL 过期自动重建」。
- **fail-open（缓存故障降级）**：`CacheErrorHandler` 集中吞掉 Redis 异常——读 → 直查 DB；写 → 放弃本次缓存。Redis 挂了业务不阻塞，代价是降级期间缓存与 DB 短暂不一致（可接受）。
- **序列化统一**：强制 `StringRedisSerializer`（key）+ `GenericJacksonJsonRedisSerializer`（value，带类型信息），否则 Spring Boot 默认 `JdkSerializationRedisSerializer` 产出二进制，Redis CLI 不可读、Lua 脚本 `tonumber()` 失败导致限流器失灵。

## 模式一：Cache-Aside + 写失效

适用：商品详情、分类列表、订单列表（写少读多、用户看到旧数据代价高）。

- **读路径**：`@Cacheable`（如商品 `cacheNames="eo:product:info", key=productId`），`unless="#result==null"` 让空结果不落缓存——防的是无意义占位污染缓存，**不是防穿透**（穿透拦截靠上游参数校验，口径见 [[缓存穿透]]）；订单列表因 key 多维组合（userId+status+page）手写 get/put，整体存 30 分钟 TTL。
- **写路径（失效而非更新）**：商品在 `@Transactional` 内改完聚合 → 发领域事件 → 监听用 `@CacheEvict` 删缓存；分类同理（缓存未富化的原始列表，计数变化不触发失效风暴）；订单用 `evictOrderCacheAfterCommit` 删 `eo:order:list:<userId>:*`。

> [!warning] 时序细节（面试/复盘最高频）
> 经典坑是「先删缓存 vs 先改 DB」和「失效在提交前还是提交后」。本项目两处做法不同。

> [!note] 订单列表：afterCommit 正确范式
> - 实现：`TransactionSynchronizationManager.registerSynchronization(... afterCommit)`
> - 原因：事务提交后再删缓存，避免「提交前删缓存 → 并发读回填旧 DB 值」。
> - 背景：订单 key 多维（userId+status+page），回填成本高，必须提交后删。

> [!warning] 商品详情：同步同事务(提交前) — 有意取舍
> - 实现：`@EventListener` 同步监听，与发布者同事务同线程。
> - 风险：失效后、提交前并发读可能回填旧值。
> - 兜底：靠短 TTL 容忍（商品可见性要求没订单严苛）。
> - 升级：一致性要求变高时改为 afterCommit（或 `@TransactionalEventListener(phase=AFTER_COMMIT)`）。

> [!important] 笔记重点
> 订单用 afterCommit 是对的范式；商品用提交前同步失效是「TTL 兜底换实现简单」的有意取舍，不是没考虑到。

## 模式二：Write-Behind（浏览量）

适用：商品浏览量（ViewCount）——高频写、允许短暂不一致、丢了影响极小。

```
用户访问 → Redis Hash eo:product:views:pending 做 increment（不碰 DB）
                  │  定时调度（每 5s，首启 15s）
                  ▼
       ViewCountFlushScheduler（Redis 分布式锁 setIfAbsent 10s 防重复）
                  │
                  ▼
       ViewCountBatchProcessor.flush()：读 pending → 批量 UPDATE DB → 成功删 pending（best-effort）
```

- DB 唯一真实来源，Redis 只是计数缓冲：任何时刻 Redis 丢失都不影响正确性。
- 顺序保证不丢：先「DB 写成功」再「删 Redis pending」；失败下轮重放。
- 分布式锁防重复：多实例下 `eo:product:views:lock` 的 `setIfAbsent` 保证单节点 flush；锁 10s 超时防死锁。
- 最终一致性，业务完全可接受。

## 与 DB 一致性无关的缓存

- **AI 语义缓存**（SemanticCacheService）：相似问题 → LLM 回答存 Redis Hash，靠 embedding 余弦相似度命中复用，纯成本优化。Redis/embedding 不可用就 fail-open 不命中，不影响 DB 数据。
- **AI stale 缓存**（AiStaleCacheConfig，Caffeine 本地）：LLM 调用结果本地 stale 降级副本，Redis 挂了还能用本地旧结果兜底——可用性设计，非 DB 一致性设计。

## 兜底机制汇总

| 机制 | 作用 |
|---|---|
| 统一短 TTL | 遗漏失效 / 失败最终靠过期重建 |
| fail-open（CacheErrorHandler） | Redis 异常不抛业务异常；读降级直查 DB、写放弃缓存 |
| `unless="#result==null"` | 空结果不落缓存，防缓存污染（防穿透另靠参数校验，见 [[缓存穿透]]） |
| SCAN 替代 KEYS | 订单按 pattern 批量失效用游标遍历，避免阻塞生产 Redis |
| 分布式锁（浏览量/超卖） | 防多实例重复 flush、防超卖 |

## 易混淆：分布式锁防超卖 ≠ 缓存一致性

`DistributedRedissonLockAdapter` + 库存扣减（`Product.decrementStock`）解决 DB 并发写一致性（防超卖），不是缓存。链路：Redis 分布式锁保证扣库存串行 → DB 事务内校验并扣减 → 再走模式一缓存失效。与「缓存 vs DB 一致性」正交。

> [!important] 项目收束
> EasyOrange 的答案 = 底座统一（单层 Redis / fail-open / 短 TTL）+ 按一致性要求分三模式；所有取舍收敛到两个变量——**失效时机**（提交前 vs afterCommit）与 **TTL 兜底**。
