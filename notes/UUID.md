---
title: UUID
category: system-design
---

# UUID

## 思维链路速查

```chain
定义与标准 | 128bit 全局唯一 | 基础
结构与版本 | 字段布局 + version | 核心
各版本对比 | v1/v3/v4/v5/v7 | 选型
优缺与场景 | 主键落地权衡 | 实战
面试问答 | 高频考点 | 复盘
```

UUID 是「无中心、本地生成」的全局唯一标识符：不依赖数据库、不抢锁、不通信，代价是 128bit 太长且 v1~v5 无序。先看标准结构，再按版本选型，最后和雪花算法比落点。

## 结构与版本

UUID 是 128bit（16 字节），标准文本为 32 个十六进制字符 + 4 个连字符，形如 `8-4-4-4-12`（`f81d4fae-7dec-11d0-a765-00a0c91e6bf6`）。

| 字段 | 长度 | 含义 |
|---|---|---|
| time_low | 32 bit | 时间戳低位 |
| time_mid | 16 bit | 时间戳中位 |
| time_hi_and_version | 16 bit | 高 4 bit 为**版本号** |
| clock_seq | 16 bit | 时钟序列（防时钟回拨/节点冲突） |
| node | 48 bit | 节点 MAC（v1）或随机数（v4） |

版本号藏在 `time_hi_and_version` 高 4 bit；variant（布局变种）藏在 `clock_seq` 高 2 bit（`10` 表示 RFC 4122）。

## 各版本对比

| 版本 | 生成方式 | 有序性 | 确定性 | 隐患 |
|---|---|---|---|---|
| v1 | 时间戳 + MAC 地址 | 时间有序 | 否 | 暴露 MAC 与生成时间 |
| v3 | 命名空间 + MD5 散列 | 无序 | 是（同名同值） | 已落伍 |
| v4 | 纯随机 | 无序 | 否 | 无（最常用） |
| v5 | 命名空间 + SHA-1 散列 | 无序 | 是（同名同值） | 比 v3 安全 |
| v7 | Unix 毫秒时间戳前缀 + 随机 | 大致时间有序 | 否 | RFC 9562（2024） |

> [!note] v4 的随机强度
> 128bit 中扣除 4 bit 版本 + 2 bit variant，可用随机位共 122 bit；需约 2^61 次生成才到 50% 碰撞概率（生日悖论），业务量级下可视为不碰撞。

> [!warning] v1 信息泄露
> node 字段直接编码 MAC 地址，可反推网卡与生成时间；内网/对外暴露的场景避免直接使用 v1。

## 优缺与场景

- 优点：本地生成、无中心节点、无网络往返、无时钟强依赖；天然全局唯一，是分布式主键的「零依赖」方案。
- 缺点：16 字节 / 36 字符过长，索引膨胀；v1~v5 无序，作为 InnoDB 聚簇主键会触发页分裂与随机磁盘 IO（代价见 [[MySQL索引为什么用B+树]]）。

> [!tip] 主键选型
> 分库分表需要全局唯一主键时，UUID 是零依赖的兜底方案；但若作为 MySQL 聚簇索引，无序写入的随机 IO 会成为瓶颈——更紧凑、时间有序的是 [[分库分表]] 里提到的雪花算法（64bit = 时间戳 + 机器 ID + 序列号）或号段模式。

## 落地：Java 生成

> [!note] 默认 v4
> `UUID.randomUUID()` 生成的是 v4（全部随机，仅合规置位版本位与 variant 位）。JDK 标准 API 不提供 v1/v3/v5，仅 `nameUUIDFromBytes` 可产 v3；v7 需第三方库或 JDK 21+ 的 `java.util` 扩展。

```java
UUID id = UUID.randomUUID();
String s = id.toString();              // 36 字符，含连字符
String compact = s.replace("-", "");   // 32 字符，去连字符
long hi = id.getMostSignificantBits(); // 高 64 bit（含版本/variant 位）
long lo = id.getLeastSignificantBits();// 低 64 bit
```

<details>
<summary>面试问答 (3题)</summary>

Q：UUID 能保证绝对不重复吗？

A：不能绝对，但 v4 的 122bit 随机在业务量级下碰撞概率可忽略；v1 靠时间戳 + MAC + 时钟序列，仅在 MAC 冲突或时钟回拨且序列耗尽时才可能重复。

Q：为什么 UUID 不适合直接当 MySQL 聚簇主键？

A：v1~v5 无序，InnoDB 按主键聚簇，新主键随机插入导致页分裂、随机磁盘 IO 与缓冲池命中率下降；且 16 字节比 BIGINT 大 8 倍，二级索引随之膨胀。

Q：v4 和 v7 有什么区别？

A：v4 纯随机无序；v7 以 Unix 毫秒时间戳为前缀、尾部补随机，保持时间大致有序，对数据库索引写入更友好（RFC 9562，2024 发布）。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：UUID 是 36 个字符。实际它是 128bit（16 字节），「36 字符」只是带连字符的十六进制文本表示。
- 误区：UUID 一定无序。v1 时间有序、v7 大致有序；只有 v3/v4/v5 无序。
- 误区：所有版本都随机。v3/v5 是命名空间散列，相同输入稳定产出相同 UUID（确定性），适合「按名寻址」而非「全局唯一随机」。

</details>
