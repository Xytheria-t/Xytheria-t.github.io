---
name: note-checkup
description: |
  Vinea 笔记唯一入口 skill：写/改笔记一次成型（分工 → 骨架 → 成稿 → 挂靠 → 校验）+ 写后体检（机器断言 → 正确性 → 完整性 → 表达）+ 全库审查（机械校验 → 四域代理 → 修复闭环）。
  响应「体检」「查一下这篇对不对/全不全」「核对内容质量」「全库审查/批量体检」。含骨架、chain/branch/mermaid/gantt/callout 组件语法、featured 用法、子类主题色、已裁决口径。
  文风规约在用户级记忆「写作与呈现」，结构分工在项目 AGENTS.md，本 skill 管动作与格式。只适用于 Vinea 仓库。
---

# 笔记写改与审查（note-checkup）

质量目标：**技术断言都站得住（正确性），该考的都讲了（完整性），复习时裸看这一页能恢复整个主题（表达兜底）**。
基准：原子笔记 `notes/ThreadPoolExecutor.md`，MOC `notes/线程池.md`。notes 只写 markdown + frontmatter，不碰 HTML/JS；重建 `node .build/build.mjs`。

## 写时流程（写/改一次成型）

1. **定位**：读同 MOC 相邻笔记，划清本篇分工——重复的收敛为双链指向主笔，缺口才由本篇讲。
2. **骨架**：frontmatter 三件套 → chain 速查 → 小节按因果排（为什么 → 是什么 → 推论 → 复盘），格式照下两节，别发明格式。
3. **成稿**：对照两级记忆的写作规约逐条自检——考点讲到机制层、结论性比喻配全边界、概念要么双链要么随文解释、callout/表格按规约。
4. **挂靠**：挂进对应 MOC；动 facet 则三处同步（正文双链 + `groups[].ids` + `traits`）。
5. **收尾**：`node .build/verify.mjs` + `node .build/vinea_check.mjs` 全绿。

## 骨架

````
---
title: <标题>
category: <子类>      # java-collection / javase / jvm / juc / spring / architecture / system-design / network / mysql / redis / mq / leetcode / projects
order: <位次>         # 可选：墙上显式排序 1..n，覆盖权重；同墙笔记要排学习路径时加
aliases: [旧名]       # 可选，兼容旧 [[双链]]
featured: <子笔记标题> # MOC 专属：锁定核心子卡在墙上置顶（pinned）
---

# <标题>

## 思维链路速查

```chain            # 或 branch：呈现「本笔记结构/阅读路线」，推荐但非强制
...                 # 章节/主题路线，4-5 节点，结尾通常是 面试问答
```

<叙事主线句>                              # 导语必在：写机制主线 / 阅读理由 / 一个钩子，禁止逐节复读 chain —— 链是目录，导语是主线，职责不同

## <内容节 1>

| 表格 | 列 | ... |       # 概览/对比用表格
| --- | --- | --- |

> [!note]/[!warning]/[!tip]/[!danger]   # 就近 callout，只承载单一提醒

## <内容节 2>
...

## 落地：<具体落点>             # 深入/落地锚点；H2 描述性具体术语；不强制末位，可多个；代码可选

> [!note] / [!danger]   # 代码前的提醒（有代码才用）

```java               # 代码可选：有就放，没有就不放
...
```

<details>                # 复盘块：0~N 个，标签自由
<summary>面试问答 (N题)</summary>
Q：...
A：...
</details>

<details>
<summary>常见误区 (N条)</summary>
- 误区：...
</details>
````

> 一个笔记可以有多个「深入节 / 复盘节」，复盘块（`<details>`）也能跟在对应内容节后，不必全塞进末尾深入节；H2 用描述性具体术语，如 `## 落地：构造示例`、`## 派生命题问答`。

## 组件语法

- **chain（线性流程 / 路线）**：`名称 | 位置/动作 | 状态` 三栏，4-5 节点，动词前置。例：
  ```` ```chain
  七大参数 | 7 个旋钮 | 配置
  执行路径决策 | 任务如何路由 | 核心
  面试问答 | 高频考点 | 复盘
  ````
- **branch（选型分流 / 决策）**：`01: 节点` / `02: 节点` 打头，接 `- 名称 | 行为 | 备注` 行。例：
  ```` ```branch
  01: 缓存异常
  02: 按现象分流
  - 穿透 | 查不存在 key 打 DB | 布隆过滤器
  - 击穿 | 热点 key 失效 | 互斥锁
  ````
- **mermaid**：支持 8 类 —— `flowchart` / `sequenceDiagram` / `classDiagram` / `stateDiagram-v2` / `erDiagram` / `mindmap` / `quadrantChart` / `timeline`。默认包在 `<details>` 里折叠，打开后懒渲染、带入场动画。
  - `<summary>` 留空或写占位（图 / 图示 / 展开流程图…），build 按首关键字自动填「展开流程图 / 时序图 / 类图 / 状态图 / ER图 / 思维导图 / 象限图 / 时间线」；写了具体名字（如「线程状态迁移」）则原样保留。
  - **fence 语言一律写 `mermaid`**，图类型写在源码首行。build 只认 ` ```mermaid `（内部匹配 `language-mermaid`），写成 ` ```classDiagram ` / ` ```mindmap ` 会被当成普通代码块，图不渲染且不报错。
  - 例：
    ````
    <details>
    <summary>展开类图</summary>

    ```mermaid
    classDiagram
    class ThreadPoolExecutor
    ThreadPoolExecutor : - corePoolSize
    ThreadPoolExecutor : - maximumPoolSize
    ```

    </details>
    ````
- **gantt**：自定义 `` ```gantt `` 块（非 mermaid），由 build.mjs 渲染。
- **callout**：`> [!type] 标题` 后接正文/列表；`type` ∈ note/info/warning/tip/danger/caution/important/question，只承载单一提醒。
- **details（复盘块）**：`<details><summary>...</summary>` 包面试问答、常见误区、选型决策、速记、对比等；标签不限固定名，数量 0~N 自定。
- **双链**：`[[笔记标题]]` 行内穿插，散布全篇，不单独成节；链接指向 `notes/` 下对应 md 的 slug。

## featured（MOC 专属）

```yaml
---
type: moc
featured: ThreadPoolExecutor   # 核心子笔记的 title 或别名，build 自动 slugify 解析；解析不到只在末尾打 ⚠
---
```

- **何时加**：MOC 子卡里有一篇「核心入口」（最常被打开、最该先读）时写；**没有核心入口就别写**，挂了反而显得子卡排序被强行拔高。
- **效果**：该子笔记在 MOC 墙上 `pinned=true` 永远第一，首页卷带根墙也顶到卷内第 1 位。
- **当前在用**：`Java 锁` → Java 锁对比；`线程池` → ThreadPoolExecutor；`类加载` → 双亲委派模型。

## 红线（违反即返工）

1. **顶部「思维链路速查」= 笔记结构/阅读路线，不是机制流，且不与正文任何 chain 撞脸。** 机制类笔记顶部原为机制流的一律改结构路线（例：HashMap 底层结构→哈希计算→寻址查询→扩容→面试）。
2. **chain 第一栏 = 模块目录（有哪些模块）；导语 = 机制主线**（为什么这么读 / 这篇在讲什么），禁止把章节名按序用箭头串一遍。反例：「委派规则 → 源码实现 → 收益 → 面试复盘。」（报菜名）；合格例（同主题）：「一张加载请求先『向上问』、逐层落空才『向下装』——先立规则，再对照源码印证，随后回答为什么非这样设计不可」。导语允许机制结论、因果推进、概念钩子或双链，就是不许报菜名。
3. **导语句永远在**（chain 块之后、首个正文节之前；内容即步骤型可放 chain 前作比喻定位句）。chain/branch 块推荐但非强制：多节笔记必用；微型/线性笔记（内容即步骤）可用纯文本导语代替。
4. **流程/步骤序列一律用 `chain`**；`callout` 只承载单一提醒，**禁止用 callout 罗列步骤流**。
5. **callout 遍布全篇**，有需要就用、不堆一处；**双链 `[[…]]` 行内散布，不单独成节**。
6. **chain/branch 块内不写「思维链路」小标题**（build.mjs 已去重）。
7. **MOC 默认走 wall 渲染**；可按需加 chain / branch / 深入节（描述性 H2），不禁止。
8. **结构化优先、少散文**：能用表格、callout、mermaid 说清的不写段落；链表/树/哈希表这类结构优先画出来，而非文字描述。
9. **H2 描述性具体术语**，禁编号（`## 1. xxx`）与泛化占位（详节/总结/详解）；深入/落地节按内容落点命名。

**子类主题色**（与 `build.mjs` 的 `ACCENT` 对应，改色去那改，这里只读）：java-collection 青绿 / javase 翠绿 / jvm 珊瑚红 / juc 亮紫 / spring 亮青 / architecture·system-design 亮橙 / network 天蓝 / mysql 亮蓝 / redis 鲜红 / mq 品红 / leetcode 金黄 / projects 玫红

## 体检（写后，或被点名「体检/查一下这篇」时）

按层执行，正确性优先；已断言化的不再人审，每轮修改后重跑机器校验，红了先修再继续。

### 第 0 层：机器断言（先跑，全绿才进人审）

```
node .build/verify.mjs && node .build/vinea_check.mjs
```

- verify 覆盖：语法冒烟、DOM 固定件、孤儿笔记（in-degree=0）、根可达性、mastery、spans、features、groups。
- vinea_check 覆盖内容级：P0 = frontmatter/title 缺失、fence 配对偶数、title 重复；P1 = 死链（**别名感知**，与 build 双链解析同口径）、H1==title、order 冲突、顶部结构、chain 栏数/节点数、编号与泛化 H2、summary 占位/重名、callout 配色；WARN = 出链稀疏（≤1）仅提示。⚠️ 改这个脚本时，按行匹配的正则必须容忍 `\r?\n`——notes 全是 CRLF，写死 `\n` 会静默失配（检查形同虚设还不报错）。

### 第 1 层：正确性（主体，一票否决）

做法：把笔记里的技术断言**逐条提取成真命题清单**——每个因果句、每个表格单元格、每条 callout、每个代码注释里的断言都算——然后逐条核对，不放过任何一句。

- **断言核对**：与真实机制比对。拿不准的不凭印象判对错，用 WebSearch 查官方文档、源码、权威资料后再下结论，并注明依据。发现错误直接给修正版写法。
- **数字复算**：例子里出现的字节数、次数、大小、行号、数值亲手算一遍（先例：RESP 协议字节数曾错 25 应为 29）。算不出来的示例补中间步骤。
- **边界反例**：每条结论找至少一个边界条件自问是否仍成立（无泛型通配的原始类型、并发下的交错时序、空/单元素输入、极端参数）。
- **版本前提**：涉版本差异的断言（Java 8/17、MySQL 5.7/8.0、Redis 各版本）必须标明适用版本；没标的要么补标注，要么改成跨版本成立的表述。
- **因果链完整**：推论必须有前提支撑，「所以/因此/可见」处逐一回查前提是否真在前文立住；结论性比喻/口号检查是否当场配全边界（先例：泛型「半擦」callout 曾只抛口号）。

### 第 2 层：完整性（主体）

- **考点覆盖**：按项目记忆的考点基准盘点缺口，列「缺失考点清单」，每条注明是新增小节还是并入现有小节（例：Redis 持久化不能漏 AOF 重写；Java 泛型不能漏 PECS；MVCC 不能漏 RC 与 RR 的 ReadView 差异）。
- **深度匹配**：高频考点讲到机制层（为什么/怎么实现），不停在记忆型结论；低频点点到为止，不反向过度展开挤占篇幅。
- **相邻分工**：同 MOC 下相邻笔记有无重复讲或两边都没讲；跨笔记重复处收敛为双链指向主笔笔记；同一机制跨笔记口径要互证一致（先例：缓存穿透篇与 EasyOrange null 缓存口径曾正面矛盾）。
- **前置依赖闭环**：正文用到的概念，要么有对应笔记可 `[[双链]]`，要么随文一句话解释；两者都没有就是断链。

### 第 3 层：表达与结构（兜底，快速过）

写作规约在两级记忆（用户级「写作与呈现」+ 项目 AGENTS.md），此处不复制；对照逐条过即可，重点核对新落地条款有没有被老内容违反。

## 审稿产出格式

逐条列：`[P级] 位置（行号或引文）→ 问题 → 改法`。

- **P1** 技术错误：错误断言、算错的数字、缺版本前提导致误导、因果前提断裂
- **P2** 完整性缺口：缺失的高频考点、深度不够的机制点、与相邻笔记重复/断链
- **P3** 表达与结构：违反写作规约（散文块、排序乱、chain 超限、callout/表格不合规、漏挂 MOC）

P1/P2 逐条给出修正后内容，不确定的写明「待查证」及查证路径。
改完重跑 `node .build/verify.mjs && node .build/vinea_check.mjs`，全绿才算体检通过。

## 全库审查（被点名「全库审查/批量体检」时）

单篇走上面的体检；全库走「机械校验 → 四域代理 → 修复闭环」两段式：

1. **机械校验先行**：`node .build/vinea_check.mjs`（即第 0 层，秒级、零误报）。
2. **人工审查走 4 个并行 Explore 代理**（只报告不修改），按域分：
   - Java 卷：javase / collection / juc / jvm 及其子笔记
   - 存储 + 网络 + 项目：mysql / redis / 缓存系列 / EasyOrange / HTTP·TCP·UDP
   - 算法卷：leetcode MOC + Hot100 + 题解
   - MOC 骨架与简历项目：MOC.md 根、各卷 MOC 定位句、projects 类笔记；重点查跨笔记口径互证

   每个代理 prompt 里给：基准笔记路径（`notes/ThreadPoolExecutor.md` + `notes/线程池.md`）、审查维度（体检第 1~3 层）、输出格式（`[P级] 位置 → 问题 → 改法`）。
3. **代理报的断言类问题必须亲自 grep 核实再修**——代理会误报（先例：把 title 带空格的 `[[1. 两数之和]]` 误判断链；把待垦空壳 MOC 误判为缺子卡片）。
4. **修复后闭环**：`node .build/build.mjs && node .build/verify.mjs`，再跑一遍第 1 步，全绿收工。

## 已裁决口径（勿反复推翻）

- 红黑树千万行树高写「约 24~46 层」（最坏 2·log₂n），别只写理想 24。
- **Java 锁卷三条口径（跨笔记必须一致，勿改回去）**：
  1. 偏向锁 = JDK 15 默认禁用、JDK 18 实质移除；凡讲锁升级的笔记都要带这句版本注，不能只画「无锁→偏向→轻量→重量」四段。
  2. volatile 原子性 = 「单次读/写 ✅；复合操作（i++）❌」。写「volatile 完全不保证原子性」是错的。
  3. StampedLock **可中断**（`readLockInterruptibly`/`writeLockInterruptibly`）、**可超时**（`tryReadLock(t)`/`tryWriteLock(t)`），不可重入、无 Condition 才是它的限制。对比表别写「可中断 ❌」。
