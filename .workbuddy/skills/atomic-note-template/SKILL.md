---
name: atomic-note-template
description: 写/对齐 Vinea 原子笔记时加载。骨架、chain/branch/callout/details/mermaid 组件语法，含「顶部=结构」「结构化优先、少散文」两条铁律。原子笔记基准=notes/ThreadPoolExecutor.md，MOC 基准=notes/线程池.md。
description_zh: "Vinea 笔记模板：骨架 + 组件语法 + 铁律"
description_en: "Vinea note template: skeleton, component syntax, rules"
allowed-tools: Read,Write,Edit,Grep,Glob,Bash
display_name: "原子笔记模板"
display_name_en: "atomic-note-template"
visibility: "project"
---

# 原子笔记模板（Vinea reader 系统）

写新笔记 / 对齐旧笔记时加载，照基准结构写，别发明格式：

- **原子笔记基准 = `notes/ThreadPoolExecutor.md`**
- **MOC 基准 = `notes/线程池.md`**（正文 = 一句定位 + `- [[子卡片]]` 列表）

笔记只写 markdown + frontmatter，不碰 HTML / JS；重建跑 `node .build/build.mjs`（仓库根）→ `reader.html` + 同目录 `vendor/`（文件夹分发，双击即开）。

## 骨架

````
---
title: <标题>
category: <子类>      # java-collection / javase / jvm / juc / spring / architecture / system-design / network / mysql / redis / leetcode / projects
order: <位次>         # 可选：墙上显式排序 1..n，覆盖权重；同墙笔记要排学习路径时加
aliases: [旧名]       # 可选，兼容旧 [[双链]]
featured: <子笔记标题> # MOC 专属：锁定核心子卡在墙上置顶（pinned），可写原文标题或别名，build 自动 slugify
---

# <标题>

## 思维链路速查

```chain            # 或 branch：呈现「本笔记结构/阅读路线」，推荐但非强制
...                 # 章节/主题路线，4-5 节点，结尾通常是 面试问答
```

<叙事主线句>                              # 导语必在：写机制主线 / 阅读理由 / 一个钩子，**禁止**逐节复读 chain —— 链是目录，导语是主线，职责不同

## <内容节 1>

| 表格 | 列 | ... |       # 概览/对比用表格
| --- | --- | --- |

> [!note]/[!warning]/[!tip]/[!danger]   # 就近 callout，只承载单一提醒

## <内容节 2>
...

## 落地：<具体落点>             # 深入/落地锚点；H2 用描述性具体术语，禁用泛化「详节」；不强制末位，可多个；代码可选

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

> 一个笔记可以有多个「深入节 / 复盘节」，复盘块（`<details>`）也能跟在对应内容节后，不必全塞进末尾深入节（H2 用描述性具体术语，如 `## 落地：构造示例`、`## 派生命题问答`）。

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
featured: ThreadPoolExecutor   # 原文标题或别名，build 自动 slugify 解析；解析不到会打印 ⚠
---
```

- **何时加**：MOC 的子卡里有一篇是「核心入口」（最常被打开、最该先读）时，写一篇。
- **写谁**：填**核心子笔记的 title 或 alias**（build 用 `titleToSlug` 兜底，alias 也行）。
- **效果**：该子笔记在 MOC 墙上 `pinned=true`，永远排在第一；**首页卷带根墙**也会把它顶到卷内第 1 位。
- **写错时**：build 不抛错，只在末尾打 `⚠ featured "X" 未找到`，方便补正。
- **当前在用**：`Java 锁` → Java 锁对比；`线程池` → ThreadPoolExecutor；`类加载` → 双亲委派模型。
- **不要**：每篇 MOC 都挂一篇 featured —— 没核心入口就别写，挂了反而显得子卡排序被强行拔高。

## 原则（违反即返工）

1. **顶部「思维链路速查」= 笔记结构 / 阅读路线，绝不能是具体流程流，且不得与正文任何 chain 撞脸。** 机制类笔记顶部原为「机制流」的一律改结构路线（例：HashMap 底层结构→哈希计算→寻址查询→扩容→面试）。
   - **chain 第一栏 = 模块目录（有哪些模块）；导语 = 机制主线（为什么这么读 / 这篇在讲什么），禁止把章节名按序用箭头串一遍。** 反例：「委派规则 → 源码实现 → 收益 → 面试复盘。」（逐节复读链）；合格例（同主题）：「一张加载请求先『向上问』、逐层落空才『向下装』——先立规则，再对照源码印证，随后回答为什么非这样设计不可」。导语允许含机制结论、因果推进、概念钩子或双链，就是不许报菜名。
   - chain / branch 块推荐但非强制：多节笔记必用；微型 / 线性笔记（内容即步骤）可用纯文本导语代替，不逼它复读正文。导语句**永远在**（位置：chain 块之后、首个正文节之前；内容即步骤型可放在 chain 之前作比喻定位句）。
2. **流程/步骤序列一律用 `chain`**；`callout` 只承载单一提醒（warning/note/tip/danger…），**禁止用 callout 罗列步骤流**。
3. **callout 遍布全篇**，有需要就用、不堆一处；**双链 `[[…]]` 行内散布，不单独成节**。
4. **chain/branch 块内不写"思维链路"小标题**（build.mjs 已去重）。
5. **MOC（frontmatter `type: moc`，不限领域）默认走 wall 渲染**；**可按需加 chain / branch / 深入节（描述性 H2），不禁止**。
6. **子类主题色**映射（见下）保持，视觉一致性锚点。
7. **结构化优先、少散文**：能用有序 / 无序列表、表格、callout、mermaid 说清的，一律不写段落文字。长段落 = 先拆成列表或表，或改成图示；链表 / 树 / 哈希表这类结构优先画出来，而非用文字描述。
8. **H2 一律描述性具体术语，禁用泛化「详节」「总结」等占位标题**。深入 / 落地节按内容落点命名，如 `## 落地：构造示例`、`## 派生命题问答`、`## 挂根与泄漏排查`；含多主题的独立节各自给具体标题，不并回一个笼统「详节」。

## 子类主题色

与 `build.mjs` 的 `ACCENT` 对应（改色去那改，这里只读）：java-collection 青绿 / javase 翠绿 / jvm 珊瑚红 / juc 亮紫 / spring 亮青 / architecture·system-design 亮橙 / network 天蓝 / mysql 亮蓝 / redis 鲜红 / leetcode 金黄 / projects 玫红

## 收尾

跑 `node .build/build.mjs` 重建。校验 `notes/*.md` 的三反引号 fence 成对偶数（悬空 fence 会白屏 / 错位）。mermaid 的 `<summary>` 无需手填，build 自动按类型生成。
