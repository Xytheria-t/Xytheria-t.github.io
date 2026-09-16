---
title: AI Agent Skill
category: ai-tools
order: 1
---

# AI Agent Skill

## 思维链路速查

```chain
技能是什么 | 定义与边界 | 概念
渐进式披露 | 为什么省上下文 | 核心
触发与加载 | 模型如何决定用 | 机制
组成结构 | SKILL.md+资源 | 落地
面试问答 | 高频辨析 | 复盘
```

skill 的本质是「渐进式披露」——平时只在上下文留个名字和描述，被需要时再加载整份 runbook，让 agent 干专业活也不撑爆系统提示。本篇属于 [[AI 工具]] 卷，讲 agent 的能力扩展机制。

## 技能是什么

**skill（智能体技能）** 是给 AI agent 用的「打包好的可复用能力单元」：一份 `SKILL.md`（指令 / runbook）外加可选的 `references/`（只读知识）与 `scripts/`（可执行代码）。它不是常驻逻辑，而是按需调用的「外挂手册」。

> [!note] 边界澄清
> skill ≠ agent ≠ 提示词。agent 是带工具、可自主长跑的子进程；prompt 是一次性塞进上下文的文字；skill 是「被触发才加载」的、可共享的能力包。

| 维度 | skill | agent | 提示词 |
|---|---|---|---|
| 存在形式 | 磁盘上的 SKILL.md + 资源 | 常驻子进程 | 上下文内文本 |
| 何时生效 | 被模型命中或手动 /调用 | 启动即运行 | 写入即生效 |
| 复用粒度 | 任务级能力 | 完整角色 | 单次指令 |

## 渐进式披露

直接把领域知识塞进系统提示，会**常驻占用上下文、拖慢推理、且难以维护**；skill 用「渐进式披露（progressive disclosure）」破解——启动时只把每个 skill 的 `name` + `description` 这类**元数据**登记进上下文，正文与资源留到被命中时才加载。

- **少占上下文**：常驻的只有轻量元数据，全文按需进场。
- **能力可组合**：加一个 skill 只是多一条元数据，不挤占现有提示。
- **易维护可共享**：逻辑落在磁盘文件，改 skill 不动全局提示。

> [!tip] 何时抽成 skill
> 凡是「多步、领域强、可复用」的任务都适合抽成 skill；一次性、强上下文绑定的逻辑则留在 prompt 或 agent 里。

## 触发与加载

skill 的「两段式」把上面的元数据与全文分开处理：

```chain
启动登记 | name+description 进上下文 | 轻量
请求到来 | 模型比对 description | 判定
命中触发 | 加载 SKILL.md 全文 | 全量
手动调用 | 用户输入 /技能名 | 直达
```

- **发现（discovery）**：agent 启动时只载入每个 skill 的 `name` 和 `description`，全文不进提示。
- **触发（invocation）**：模型判断用户意图与某条 `description` 匹配时自动加载全文；也可由用户以 `/技能名` 手动调用。

<details>
<summary>展开加载流程图</summary>

```mermaid
flowchart TD
  B([agent 启动]) --> R[载入所有 skill 的 name+description]
  R --> W{用户请求到达}
  W --> M[模型比对 description]
  M -->|命中| L[加载 SKILL.md 全文到上下文]
  M -->|未命中| W
  U[/用户手动 slash/] --> L
  L --> E[按 runbook 执行任务]
```

</details>

## 落地：组成结构

一份 skill 物理上由 `SKILL.md`（指令）+ 资源目录组成；重活下沉到 `references/` 与 `scripts/`，保持正文可读。

> [!note] 关键前提
> `description` 是模型决定「要不要调这个 skill」的唯一依据，必须写清「何时用」，而不是「它是什么」。

```yaml
---
name: note-checkup
description: |
  Vinea 笔记唯一入口 skill：写/改笔记、写后体检、全库审查。
  响应「体检」「查一下这篇对不对」「全库审查」。含骨架与组件语法基准。
---

# 笔记写改与审查（note-checkup）
## 流程
1. 定位分工 → 2. 骨架 → 3. 成稿 → 4. 挂靠 → 5. 校验
```

```text
skill-name/
├── SKILL.md          # 指令与流程（含 frontmatter）
├── references/       # 随加载带入的只读上下文
│   ├── api.md        # 接口 / 字段速查
│   └── schema.json   # 结构样例
└── scripts/          # 真正执行动作的代码
    └── run.sh        # skill 调用时跑
```

> [!warning] description 写法坑
> 只写「本技能用于 XX」等于没写触发条件；要写「当用户说 XX / 要做 XX 时调用」，否则模型要么不触发、要么误触发。

> [!note] 两类资源边界
> `references/` = 只读知识（API 文档、schema、示例），给模型**读**；`scripts/` = 可执行代码（bash/python/...），让模型**调**而不是现编。

> [!tip] 实用建议
> 凡是要「照着抄的规范 / 要精确执行的步骤」都下沉成 references 或 scripts——模型记不准的细节交给文件，稳定性远高于让它凭记忆生成。

<details>
<summary>面试问答 (3题)</summary>

Q：skill 和把知识写进系统提示有什么区别？

A：系统提示常驻、永远占上下文；skill 仅登记元数据，全文按需加载，省 token 且易维护、可共享。

Q：模型怎么决定调用哪个 skill？

A：比对用户意图与各 skill 的 `description`，命中即加载全文；也支持用户 `/技能名` 手动触发。

Q：为什么 description 比正文更关键？

A：description 是触发判定的唯一依据，写不清「何时用」会导致不触发或误触发，正文再好也加载不到。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：skill 越多越好、能塞就塞。实际元数据也占上下文，且 description 互相重叠会干扰触发判定。
- 误区：把全部步骤写进系统提示更稳。实际常驻拖慢推理，且改一次要动全局。
- 误区：description 写成功能介绍。实际要写触发条件（何时调用），模型靠它决策。

</details>
