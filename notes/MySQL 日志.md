---
title: MySQL 日志
category: mysql
excerpt: 改一行不必整页落盘：undo log 记「怎么撤销」扛回滚与 MVCC，redo log 记「怎么重做」用 WAL 扛崩溃恢复，binlog 记「改了什么」扛复制与归档；提交时 redo 与 binlog 靠两阶段提交对齐。
---

# MySQL 日志

:::lede
MySQL 日志指 InnoDB 与 Server 层为「改动可回滚、崩溃可恢复、主从可复制」而顺序写下的几份日志（undo log、redo log、binlog），是 WAL 思路在 MySQL 里的落地；它们不存业务数据，只记录改动的过程与结果。
:::

## 思维链路速查

```chain
为什么有日志 | 随机整页写太贵·宕机要交代 | 起点
三大日志全景 | undo·redo·binlog 一张对比表 | 全景
三份日志逐个拆 | undo 反向操作 · redo WAL 循环写 · binlog 追加归档 | 核心
两阶段提交 | redo 与 binlog 对账 | 关键
落地与复盘 | 一条 UPDATE 全流程 + 面试 | 收尾
```

直接改内存页最省事，但两件事必须交代：**未提交的改动要能撤销**（原子性），**已提交的改动宕机不能丢**（持久性）。InnoDB 的解法是 WAL——undo log 记「怎么撤销」、redo log 记「怎么重做」，Server 层的 binlog 记「改了什么」供复制与归档；redo 与 binlog 谁先落盘都各留一个不一致的坑，于是提交时用两阶段提交把两份账本对齐。

## 为什么有日志

InnoDB 按 **16KB 页**为最小读写单位（页结构见 [[MySQL 索引]]）。改一行若立刻把所在页刷盘，三笔账都不划算：写放大（只改几十字节却要写整页 16KB）、随机 IO（页散在磁盘各处，寻址慢）、提交慢（「持久」被绑定在昂贵的整页落盘上）。日志换了个算法：事务路径上只做**小条日志的顺序写**，数据页攒成脏页（内存里改过、还没写回磁盘的页）交给后台线程批量刷。

## 三大日志全景

| | undo log | redo log | binlog |
|---|---|---|---|
| 归属 | InnoDB 引擎层 | InnoDB 引擎层 | Server 层（所有引擎共用） |
| 内容 | **逻辑日志**：反向操作 | **物理日志**：某页某处的字节改动 | **逻辑日志**：SQL 或行变更（看格式） |
| 写法 | 挂进版本链，随事务增长 | 循环写，写满从头覆盖 | 追加写，写满换下一个文件 |
| 解决 | 原子性（回滚）+ MVCC | 持久性（崩溃恢复） | 复制、备份恢复 |
| 与提交的关系 | 执行中随写随记 | 提交时按策略刷盘 | 提交时一次写入 |

redo 记的是「结果」——哪个页哪个偏移改成什么，所以只有它能做页级崩溃恢复；undo / binlog 记「操作」，反着做能撤销、原样重放能复现。

## undo log：记「怎么撤销」

undo log（回滚日志）在改动发生**之前**记下反向操作：

| 场景 | undo 里记什么 | 回滚动作 |
|---|---|---|
| INSERT | 新行的主键 | 按主键 DELETE |
| DELETE | 被删行的旧值 | 旧值插回去 |
| UPDATE | 修改前的旧值 | 反向 UPDATE 恢复旧值 |

一份旧值，两个用途：**回滚**（原子性）——ROLLBACK 或崩溃后按 undo 撤销未提交事务；**MVCC 版本链**——DB_ROLL_PTR 指向的旧版本就存在 undo 里，快照读沿链回溯靠它（见 [[MVCC]]）。

| 类型 | 覆盖 | 提交后 |
|---|---|---|
| insert undo | INSERT 产生的反向记录 | 可立即删——未提交的 INSERT 本来就对别人不可见，新行没有旧版本 |
| update undo | DELETE / UPDATE 记的旧值 | 必须留给版本链，等 purge（InnoDB 后台清理线程）确认没有 ReadView 可能引用后才删 |

> [!note] undo 自己也怕丢
> undo 的载体是回滚段里的 undo 页，也是数据页——改它同样要记 redo。崩溃恢复先靠 redo 把所有页（含 undo 页）追平，再用 undo 回滚未提交事务：**先重放，后回滚**。

## redo log：记「怎么重做」

redo log（重做日志）用 WAL（Write-Ahead Logging）：**改动先顺序写入 redo 并落盘，数据页的落盘延后**。提交时保证的正是 redo 落盘，而不是数据页落盘；一条 redo 只有几十字节（页号 + 偏移 + 改动），顺序写，而立刻刷数据页要写整页 16KB、随机放大。

### 循环写

redo 是一组固定个数的文件（如 ib_logfile0/1）从 tail 追着写：**write pos**（下一个写入位置）与 **checkpoint**（已刷脏到哪的边界）之间是已写未刷脏的部分，崩溃恢复要用；checkpoint 之前对应脏页已落盘、可覆盖。write pos 追上 checkpoint 就得停下刷脏——redo 太小会周期性卡顿。

### 刷盘策略：innodb_flush_log_at_trx_commit

fsync（把操作系统文件缓存强制刷进磁盘的系统调用）才是真正「落铁盘」的一步，策略控制它在事务路径上的频率：

| 值 | 提交时做什么 | 谁来 fsync | 宕机丢什么 |
|---|---|---|---|
| 0 | 只写 redo log buffer | 后台线程每秒 | 最多约 1 秒 |
| **1（默认）** | 写 buffer 并 fsync | 每次提交 | 不丢已提交事务 |
| 2 | 写到 OS 文件缓存 | 每秒一次 | MySQL 进程挂不丢；OS/整机挂丢约 1 秒 |

> [!tip] 组提交
> 并发事务提交时凑一批共用一次 fsync——「每事务一次刷盘」摊薄成「每批一次」，这是值 = 1 时性能仍可用的关键。

严格不丢要 redo 与 binlog 两侧都置 1（`innodb_flush_log_at_trx_commit=1` 且 `sync_binlog=1`），代价是每次提交最多两次 fsync；放宽任一侧就退化成「丢一秒 / 丢 N 笔」，订单、账务场景不要放。

## binlog：记「改了什么」

binlog（归档日志）在 Server 层，任何引擎都有一份；**追加写、永不覆盖**，所以能从头重放。三种格式：

| 格式 | 记什么 | 优点 | 坑 |
|---|---|---|---|
| statement | SQL 原文 | 体积小 | NOW() / UUID() / 无排序 LIMIT 的结果不确定，从库重放与主库执行结果不同 → 主从不一致 |
| **row（默认）** | 行变更的前后镜像 | 精确，能当变更流订阅 | 体积大：一条 UPDATE 命中十万行就是十万条 |
| mixed | 平时 statement，遇不确定函数切 row | 折中 | 切换判断是黑盒，难排查 |

写入流程：事务执行中先写**本线程私有的 binlog cache**，提交时一次写入 binlog 文件——单个事务的 binlog 连续完整，从库要么看到整个事务、要么看不到。落盘时机由 sync_binlog 控制：1（默认）每次提交 fsync；0 交给 OS；N 攒 N 个事务。

三个用途：**主从复制**（从库 IO 线程拉 binlog 存成 relay log，SQL 线程重放）、**备份恢复**（全量备份打底，再重放到指定时刻，point-in-time recovery）、**变更订阅**（canal 等伪装成从库拉 binlog 当变更流，驱动缓存失效、搜索索引更新）。

## 两阶段提交：让两份账本对上号

一条 UPDATE 提交要同时写 redo 和 binlog，两者独立落盘，先写谁都有缝：先 redo 后 binlog，崩在中间则主库有、从库没有（主多从少）；先 binlog 后 redo，则从库回放出、主库没有（从多主少）。解法是把 redo 的提交拆成两半，binlog 卡在中间——redo 先写并标 prepare，binlog 写入落盘后 redo 再标 commit。

崩溃恢复按 redo 的状态分三种情形判定（redo 与 binlog 靠共同的事务 XID 对账）：

| 崩溃在 | redo 状态 | binlog | 恢复动作 | 结果 |
|---|---|---|---|---|
| ① prepare 后，binlog 前 | prepare | 没有该事务 | 按 undo 回滚 | 两边都没有，一致 |
| ② binlog 落盘后，commit 前 | prepare | 完整 | 补提交该事务 | 两边都有，一致 |
| ③ commit 后 | commit | 完整 | 直接恢复 | 一致 |

一句话：恢复时 redo 处于 prepare 就按 XID 去 binlog 查——**binlog 完整则提交，否则回滚**。以 binlog 为准，因为它是复制与备份恢复的唯一依据，主从一致优先。

## 落地：一条 UPDATE 的日志全流程

```sql
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
```

| 步 | 位置 | 动作 |
|---|---|---|
| ①②③ | buffer pool / undo log | id=1 的页读进内存（已在则跳过）→ 记下 balance 旧值挂进版本链 → 内存中改 balance=900，该页成为脏页 |
| ④⑤ | redo log buffer / binlog cache | 记「某页某处 balance 由 1000 改 900」的物理改动 / 记这条行变更（row 格式的前后镜像） |
| ⑥ | 提交 | redo 刷盘标 prepare → binlog 写入并落盘 → redo 标 commit（两阶段提交） |
| ⑦ | 后台 | 某刻脏页刷盘；刷盘前该页的改动始终有 redo 兜底 |

## 引擎之外：运维侧日志

error log（启动失败、运行错误的第一现场）、slow query log（慢查询定位，治理入口在 [[MySQL 索引]]）、relay log（从库侧的 binlog 中转站）三类，排查时先看它们。

<details>
<summary>面试问答 (3题)</summary>

Q：redo log 和 binlog 的区别？

A：层次（InnoDB / Server，所有引擎都有 binlog）、内容（页级物理改动 / 逻辑的语句或行变更）、写法（固定文件组循环写会被覆盖 / 追加写永不覆盖）、用途（崩溃恢复 / 复制与按时间点恢复）。一句记：redo 答「某页某处怎么改的」，binlog 答「这行数据变成了什么」。

Q：两阶段提交解决什么问题，崩溃恢复怎么判？

A：redo 和 binlog 独立落盘，先后顺序都有崩溃缝，会造成主库与从库数据不一致。提交时 redo 先标 prepare，再写 binlog，最后 redo 标 commit；恢复时 redo 处于 prepare 就按 XID 查 binlog，完整则补提交、否则按 undo 回滚。

Q：undo log 会一直留着吗？

A：insert undo 提交即删；update undo 提交后要挂在版本链上供 ReadView 回溯，purge 确认没有活跃 ReadView 可能引用后才清理。长事务会把旧版本拖住，undo 膨胀、沿链回溯变慢。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：提交成功 = 数据已在磁盘上。提交保证的是 redo 落盘，数据页还是内存脏页，由后台延后刷。
- 误区：有 redo log 就不需要 binlog（或反过来）。redo 是物理日志且循环写会覆盖，只能崩溃恢复；binlog 是逻辑日志，做不了页级恢复。
- 误区：两阶段提交保证 redo 和 binlog 同时落盘。它保证的是「要么都有效、要么都无效」——binlog 已落盘而 redo 还在 prepare 是正常中间态，恢复时补提交。

</details>
