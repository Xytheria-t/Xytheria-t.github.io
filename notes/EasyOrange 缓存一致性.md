---
title: EasyOrange 缓存一致性
category: projects
excerpt: EasyOrange 的统一缓存底座与三模式落地：单层 Redis + fail-open，订单 afterCommit、商品同步失效 + TTL 兜底，ViewCount 走 Write-Behind。
---

# EasyOrange 缓存一致性

:::lede
EasyOrange 缓存一致性是 EasyOrange 项目里「Redis 缓存与数据库如何同步」的落地方案：以单层 Redis + fail-open 为统一底座，按业务对一致性的要求分别落地 Cache-Aside 写失效与 Write-Behind，余下窗口交给 TTL 兜底。
:::

## 思维链路速查

```chain
全局底座 | 单层 Redis + fail-open | 框架
三模式落地 | Cache-Aside / Write-Behind / 取舍 | 核心
兜底与边界 | TTL · 分布式锁 · 正交项 | 收尾
```

一致性靠「分层取舍」收敛，不靠消灭窗口：先立单层 Redis + fail-open 的全局底座，再按一致性要求把业务拆进三种模式，余下的边界风险交给 TTL 与分布式锁。

> [!important] 简历口径
> - 设计统一缓存底座（RedisCacheConfig）：单层 Redis + 注解驱动 `@Cacheable`/`@CacheEvict`，业务近零缓存代码
> - 按数据一致性要求分三模式：Cache-Aside+写失效（强一致主数据）、Write-Behind（高频计数）、fail-open（缓存故障降级不阻塞）
> - 关键取舍：订单失效放 afterCommit 防并发回填，商品用同步事件 + TTL 兜底换简单；序列化统一防限流器失灵

通用机制见 [[缓存与数据库一致性]]，本篇只记 EasyOrange 的落地与取舍。

## 全局底座：统一 Redis 单层 + fail-open

所有「与 DB 一致」的缓存跑在同一底座（RedisCacheConfig）：

- **单层 Redis**：早期手写 L1 本地 + L2 Redis 多级缓存已移除——单层只靠「写路径显式失效 + TTL 兜底」，无需 L1/L2 配平与跨节点广播。
- **注解驱动**：业务侧只用 `@Cacheable` / `@CacheEvict`，几乎零缓存代码（适配层实现端口，方法体为空）。
- **统一短 TTL**：`default-ttl` 控制，最后防线是「TTL 过期自动重建」。
- **fail-open**：`CacheErrorHandler` 吞掉 Redis 异常——读直查 DB、写放弃缓存；Redis 挂了不阻塞业务，代价是降级期短暂不一致。
- **序列化统一**：key 用 `StringRedisSerializer`、value 用 `GenericJacksonJsonRedisSerializer`（带类型信息）；否则 Spring Boot 默认 `JdkSerializationRedisSerializer` 产出二进制，Redis CLI 不可读、Lua `tonumber()` 失败导致限流器失灵。

## 模式一：Cache-Aside + 写失效

适用：商品详情、分类列表、订单列表（写少读多、用户看到旧数据代价高）。

- **读路径**：商品 `@Cacheable(cacheNames="eo:product:info", key=productId)` + `unless="#result==null"`（空结果不落缓存，防占位污染，**不是防穿透**——穿透靠上游参数校验，见 [[缓存穿透]]）；订单列表 key 多维（userId+status+page）手写 get/put，TTL 30 分钟。
- **写路径（失效而非更新）**：商品在 `@Transactional` 内改完聚合 → 发领域事件 → 监听用 `@CacheEvict` 删缓存；分类同理（缓存未富化的原始列表，计数变化不触发失效风暴）；订单用 `evictOrderCacheAfterCommit` 删 `eo:order:list:<userId>:*`。

> [!warning] 失效时机：两处有意不同（面试/复盘最高频）
> - 订单列表：afterCommit 删（`TransactionSynchronizationManager.registerSynchronization`）——key 多维、回填成本高，提交前删会被并发读回填旧 DB 值。
> - 商品详情：`@EventListener` 同步、与发布者同事务同线程（提交前删）——失效后、提交前并发读可能回填旧值，靠短 TTL 容忍（商品可见性要求没订单严苛）；一致性要求变高时改 `@TransactionalEventListener(phase=AFTER_COMMIT)`。

## 模式二：Write-Behind（浏览量）

适用：商品浏览量（ViewCount）——高频写、允许短暂不一致、丢了影响极小。

用户访问 → Redis Hash `eo:product:views:pending` 做 increment（不碰 DB）；定时调度（每 5s，首启 15s）由 ViewCountFlushScheduler 触发 `ViewCountBatchProcessor.flush()`：读 pending → 批量 UPDATE DB → 成功删 pending（best-effort）。

- DB 是唯一真实来源，Redis 只是计数缓冲：Redis 丢数据不影响正确性。
- 顺序保证不丢：先「DB 写成功」再「删 Redis pending」，失败下轮重放。
- 多实例防重复 flush：`eo:product:views:lock` 的 `setIfAbsent` 保证单节点执行，锁 10s 超时防死锁。

## 与 DB 一致性无关的缓存

- **AI 语义缓存**（SemanticCacheService）：相似问题 → LLM 回答存 Redis Hash，按 embedding 余弦相似度命中复用，纯成本优化；Redis/embedding 不可用就 fail-open 不命中。
- **AI stale 缓存**（AiStaleCacheConfig，Caffeine 本地）：LLM 调用结果的本地 stale 降级副本，Redis 挂了用本地旧结果兜底——可用性设计，非 DB 一致性设计。

## 兜底与边界

- **SCAN 替代 KEYS**：订单按 pattern 批量失效用游标遍历，避免阻塞生产 Redis。
- **分布式锁防超卖 ≠ 缓存一致性**：库存扣减（`DistributedRedissonLockAdapter` + `Product.decrementStock`）走「Redis 锁串行扣库存 → DB 事务内校验并扣减 → 再走模式一缓存失效」，解决的是 DB 并发写，与缓存失效正交。
