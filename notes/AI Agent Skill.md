---
title: AI Agent Skill
category: ai-tools
order: 1
---

# AI Agent Skill

## 思维链路速查

```chain
技能是什么 | 定义与边界 | 概念
渐进式披露 | 三层加载与预算 | 核心
触发与加载 | 模型如何决定用 | 机制
SKILL.md 规范 | 字段与命名约束 | 落地
面试问答 | 高频辨析 | 复盘
```

skill 是 [[AI 工具]] 卷里 agent 的能力扩展机制，核心是渐进式披露：平时只在上下文留约 100 tokens 的元数据，命中才逐层加载正文与资源，所以往里塞多少知识都不撑爆系统提示。

## 技能是什么

**Agent Skill（智能体技能）** 是一个目录，至少含一份 `SKILL.md`——frontmatter 写元数据、Markdown 正文写执行指令（runbook）；另可带 `references/`（按需读取的知识文档）、`scripts/`（可执行代码）、`assets/`（模板与静态资源）。格式由 Anthropic 提出并作为开放标准发布（agentskills.io），Claude Code、Microsoft Agent Framework、Copilot Studio 等按同一份格式实现。

| 维度 | skill | agent | 提示词 |
|---|---|---|---|
| 形态 | 磁盘目录 + 资源 | 独立上下文与工具循环 | 上下文内文本 |
| 生效 | 描述命中或手动调用 | 主 agent 派发 | 写入即常驻 |
| 粒度 | 任务级能力 | 完整角色 | 单次指令 |
| 成本 | 正文按需加载 | 整套提示与工具常驻 | 全程常驻 |

边界：skill 管「能力怎么打包」，能力怎么接进来走 [[MCP]]。

> [!tip] 何时抽成 skill
> 「多步、领域强、可复用」的任务适合抽成 skill；一次性、强上下文绑定的逻辑留在 prompt 或 agent 里。

## 渐进式披露

把领域知识全塞进系统提示会常驻占上下文、拖慢推理、改一处动全局；skill 反过来按需逐层加载，官方口径分三层：

| 层 | 何时加载 | 预算 | 内容 |
|---|---|---|---|
| 元数据 | 启动即常驻 | 每 skill 约 100 tokens | `name` + `description` |
| 指令 | 命中触发时 | 建议 <5000 tokens | `SKILL.md` 正文 |
| 资源 | 用到才读 / 跑 | 读之前为 0 | `references/`、`scripts/`、`assets/` |

- `references/` 给模型**读**（文档、schema、示例），`scripts/` 让模型**跑**——脚本只把输出带回上下文，代码本身不占，所以能打包的体量实际无上限。
- 正文另建议 ≤500 行；文件引用保持距 `SKILL.md` 一层深，别套多层链。
- 收益：加 skill 不挤占现有提示，逻辑落在磁盘文件，改 skill 不动全局。

> [!note] 同一机制，两种粒度
> 微软 Agent Framework 把同一标准写成四阶段：Advertise（约 100 tokens，名称与描述进系统提示）→ Load（<5000 tokens，调 `load_skill` 取全文）→ Read resources（调 `read_skill_resource`）→ Run scripts（调 `run_skill_script`）。后两阶段拆自规范里的同一层「资源」。

## 触发与加载

启动只登记每个 skill 的 `name` 与 `description`，全文不进提示；请求到来后模型把用户意图与各条 `description` 比对，命中才加载 `SKILL.md` 全文并按 runbook 执行。用户也可 `/技能名` 手动直达，绕过描述匹配。

```chain
启动登记 | name+description 进上下文 | 轻量
请求到来 | 模型比对 description | 判定
命中触发 | 加载 SKILL.md 全文 | 全量
手动调用 | 用户输入 /技能名 | 直达
```

## 落地：SKILL.md 规范

frontmatter 六个字段，必填只有两个：

| 字段 | 必填 | 约束 |
|---|---|---|
| `name` | 是 | 1–64 字符，等于父目录名 |
| `description` | 是 | 1–1024 字符，「做什么 + 何时用」 |
| `license` | 否 | 许可证名或随包许可证文件名 |
| `compatibility` | 否 | ≤500 字符，声明运行环境要求 |
| `metadata` | 否 | 自定义键值对（字符串 → 字符串） |
| `allowed-tools` | 否 | 空格分隔的预授权工具，实验性 |

- **`name`**：kebab-case，只允许小写字母、数字、连字符；首尾不能是 `-`，不能有连续 `--`；**必须等于父目录名**——目录 `pdf-processing/` 里只能写 `name: pdf-processing`。
- **`description`**：触发判定的唯一依据，要写「当用户说 XX / 要做 XX 时调用」并带上区分性关键词，用第三人称陈述（如 "Processes PDF files…"）；写成「本技能用于 XX」等于没写触发条件。
- **`allowed-tools`**：给的是本轮**预授权**（如 `Bash(git:*) Read`），不是可用工具上限——没列的工具照样能调，别当权限沙箱。

```yaml
---
name: pdf-processing
description: |
  提取 PDF 文本、拆分合并、填写表单。
  当用户处理 PDF 文件或提到表单填写时使用。
---
```

```text
skill-name/            # 目录名 = name 字段
├── SKILL.md           # 必需：frontmatter + 指令正文
├── references/        # 可选：按需读取的知识文档
├── scripts/           # 可选：可执行代码，只回传输出
└── assets/            # 可选：模板与静态资源
```

<details>
<summary>面试问答 (4题)</summary>

Q：skill 和把知识写进系统提示有什么区别？

A：系统提示全程常驻；skill 只常驻约 100 tokens 元数据，正文与资源按需加载。

Q：模型怎么决定调用哪个 skill？

A：拿用户意图比对各条 `description`，命中即加载全文；也可 `/技能名` 手动绕过。

Q：为什么 `description` 比正文更关键？

A：它是第 1 层也是唯一触发依据；写不清「何时用」，正文再全也加载不进来。

Q：skill 和 agent 怎么选？

A：要独立上下文与工具循环的完整角色用 agent（整套常驻）；单点专业能力用 skill（按需加载）。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：skill 越多越好。实际元数据也常驻，description 语义重叠会让触发判定变难。
- 误区：把全部步骤写进系统提示更稳。实际常驻拖慢推理，改一处要动全局。
- 误区：`allowed-tools` 列了就是权限沙箱。实际只是本轮预授权，未列的工具仍可调用。

</details>
