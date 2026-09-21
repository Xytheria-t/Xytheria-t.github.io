---
title: MVCC
category: mysql
---

# MVCC

:::lede
MVCC（Multi-Version Concurrency Control，多版本并发控制）是通过保留数据历史版本实现并发控制的机制：读访问快照版本、写生成新版本，读写互不阻塞。
**边界：** 只拆读写冲突 · 写写仍靠锁 · 快照由 undo log 与 ReadView 构造
:::

## 思维链路速查

```chain
三大组件 | 隐藏列 · undo log 版本链 · ReadView | 基础
可见性判断 | 沿链回溯的四条规则 | 核心
落地：一行三次读取 | RR 与 RC 各读到什么 | 演示
幻读防线 | 快照读 vs 当前读 | 边界
面试问答 | 高频考点 | 复盘
```

写不覆盖、读不等待：InnoDB 把每次修改的旧版本挂进 undo log 串成的版本链，读方拿着 ReadView 沿链挑出「自己看得见」的那一版——读写互不阻塞，这是 RC / RR 两级隔离下不用纯锁也能并发读写的根基。行数据与它的版本链都长在聚簇索引的叶子页上，结构见 [[MySQL 索引]]。

## 解决什么问题

与纯锁方案的对比：

| 方案 | 读 | 写 | 代价 |
|---|---|---|---|
| 只用读写锁 | 加共享锁（S 锁），阻塞写 | 加排他锁（X 锁），阻塞读 | 读写互斥排队，并发度低 |
| **MVCC** | 读历史版本快照 | 追加新版本 | 多占存储 + 沿链回溯，换读写不互斥 |

> [!note] 适用边界
> MVCC 只在 InnoDB 且隔离级别为 RC（READ COMMITTED）或 RR（REPEATABLE READ）时生效：RU 直接读最新版本，SERIALIZABLE 一律退化为加锁。写与写的冲突仍靠锁，MVCC 只拆「读-写」这一对矛盾。

## 三大组件

| 组件 | 是什么 | 作用 |
|---|---|---|
| 隐藏列 DB_TRX_ID | 每行自带的隐藏列：最近一次插入 / 更新该行的事务 ID | 版本链上的「版本号」 |
| 隐藏列 DB_ROLL_PTR | 回滚指针：指向 undo log 中该行的上一个版本 | 把各版本串成链 |
| undo log | 回滚日志：修改前把旧版本记下来（日志体系全景见 [[MySQL 日志]]） | 版本链的节点，回滚与快照读共用 |
| ReadView | 读视图：快照读时生成的一份「当时谁还没提交」的记录 | 沿链挑版本的过滤器 |

ReadView 的四个字段：

| 字段 | 含义 |
|---|---|
| m_ids | 生成 ReadView 时仍未提交的**其他**事务 ID 集合 |
| min_trx_id | m_ids 中的最小值 |
| max_trx_id | 系统下一个将要分配的事务 ID（对活跃集合取上开区间） |
| creator_trx_id | 创建这份 ReadView 的事务，即「自己」 |

<details>
<summary>展开版本链示意</summary>

```mermaid
flowchart LR
  T2["当前行<br/>trx_id=30 · balance=200"] -->|"DB_ROLL_PTR"| U1["undo log 旧版本<br/>trx_id=10 · balance=100"]
  U1 -->|"DB_ROLL_PTR"| NULL["链尾"]
```

</details>

## 可见性判断

拿着 ReadView 去读某个版本时，只看该版本的 DB_TRX_ID 落在哪个区间：

| 版本的 trx_id | 判断 | 结论 |
|---|---|---|
| = creator_trx_id | 自己改的 | ✅ 可见 |
| < min_trx_id | 生成 ReadView 前就已提交 | ✅ 可见 |
| ≥ max_trx_id | 生成 ReadView 之后才开启的事务 | ❌ 不可见 |
| 其余（min ≤ trx < max） | 查 m_ids：在集合里 → 当时还没提交 | ❌ 不可见 |
| 〃 | 不在集合里 → 当时已提交 | ✅ 可见 |

当前版本不可见时，沿 DB_ROLL_PTR 找上一版本重复判断；整条链都没有可见版本，说明该行对本次读「不存在」（如未提交的 INSERT）。

## 落地：一行三次读取

同一行 balance，RR 与 RC 各走一遍，先摆时间线：

| 时刻 | 事务 | 动作 |
|---|---|---|
| ① | trx 10 | INSERT balance=100，已提交（早于一切 ReadView） |
| ② | trx 30 | BEGIN; UPDATE balance=200，**未提交** |
| ③ | trx 20（RR） | BEGIN; SELECT balance → 生成 ReadView{m_ids={30}, min=30, max=31, creator=20} |
| ④ | trx 30 | COMMIT |
| ⑤ | trx 20 | 再 SELECT balance |

时刻 ③ 读到 100：当前版本 trx_id=30 落在 [min=30, max=31) 且在 m_ids 里 → 当时还没提交 → 不可见；沿 DB_ROLL_PTR 退到 trx_id=10 的版本，10 < min=30 → 可见。

时刻 ⑤ 的分岔：

| 隔离级别 | ReadView | 判 trx_id=30 | 读到 | 效果 |
|---|---|---|---|---|
| RR | 复用时刻 ③ 那份 | 仍在 m_ids 里 → 不可见 | 100 | 可重复读 |
| RC | 重新生成{m_ids={}，min=max=31}（30 已提交） | 30 < min → 可见 | 200 | 不可重复读 |

RC 重新生成时活跃集合为空，min_trx_id 约定取 max_trx_id（此处 31），于是「30 < min」直接判可见，不必为空集另记一条规则。

## RC 与 RR：只差 ReadView 的生成时机

| | RC | RR |
|---|---|---|
| 生成时机 | **每次**快照读都新生成一份 | 事务内**第一次**快照读生成，之后全程复用 |
| 能否读到别人新提交 | 能 → 不可重复读 | 不能 → 视图固定，可重复读 |
| 一句话 | 视图跟着最新提交走 | 视图冻结在第一次读 |

> [!warning] RR 复用视图的代价
> 旧版本只要还可能被某个在途 ReadView 引用就不能物理删除（purge 被阻塞）。长事务会把整条版本链拖住，undo log 膨胀、查询沿链回溯变慢——所以别让事务空挂。

## 幻读防线：快照读与当前读

| 读法 | 例子 | 读什么 | 防幻读靠 |
|---|---|---|---|
| 快照读 | 普通 SELECT | ReadView 挑出的历史版本 | MVCC：RR 复用视图，别人后插入的行 trx_id 不合法 → 不可见 |
| 当前读 | UPDATE / DELETE / SELECT … FOR UPDATE / LOCK IN SHARE MODE | 最新已提交版本，并加锁 | Next-Key Lock（记录锁 + 间隙锁）锁住区间，插入被阻塞 |

> [!danger] MVCC 只防住「快照读的幻读」
> 同一事务里先普通 SELECT（看不见新行），再 SELECT … FOR UPDATE（当前读，读最新提交）→ 幻影行出现。RR 也不是彻底防幻读：快照读靠 MVCC，当前读靠 Next-Key Lock，两套机制各管一半，混用就有缝。

<details>
<summary>面试问答 (4题)</summary>

Q：什么是 MVCC，解决了什么问题？

A：写不覆盖旧值而是把旧版本挂进 undo log 版本链，读按 ReadView 沿链挑可见版本，读写互不阻塞。它解决脏读和不可重复读，RR 下的快照读幻读也一并挡住；写写冲突仍靠锁。

Q：ReadView 里有什么，可见性怎么判断？

A：四个字段：活跃（未提交）事务集合 m_ids、其中最小值 min_trx_id、下一个待分配事务 ID max_trx_id、创建者 creator_trx_id。判断看版本的 trx_id：等于 creator 或小于 min 可见，大于等于 max 不可见，落在区间内则查 m_ids，在集合里不可见、不在则可见。

Q：RC 和 RR 在 MVCC 实现上差在哪？

A：只差 ReadView 的生成时机：RC 每次快照读都新生成，能读到别人刚提交的新值；RR 只在第一次快照读生成并复用，视图冻结。副作用是 RR 的长事务会拖住 purge，undo 膨胀。

Q：RR 下 MVCC 能完全防住幻读吗？

A：不能。快照读的幻读被复用的 ReadView 挡住了；当前读（UPDATE / DELETE / FOR UPDATE）读的是最新已提交版本，新插入的行看得见，这部分靠 Next-Key Lock 阻止插入。混用时仍可能看到幻影行。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：MVCC 可以不需要锁。写与写、当前读与写仍靠锁互斥，MVCC 只消除「读阻塞写、写阻塞读」。
- 误区：MVCC 在所有隔离级别生效。只有 RC 和 RR；RU 读最新版本无需版本链，SERIALIZABLE 全部退化为加锁。
- 误区：RR 靠 MVCC 彻底防住幻读。只防住快照读那一半，当前读靠 Next-Key Lock，混用仍有缝。

</details>
