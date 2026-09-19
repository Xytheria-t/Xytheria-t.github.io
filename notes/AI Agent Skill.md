---
title: AI Agent Skill
category: ai-tools
order: 2
---

# AI Agent Skill

:::lede
AI Agent Skill（智能体技能）是 agent 的能力扩展机制：把一项专业能力的说明书与配套资源打包成一个目录，核心是一份 SKILL.md，用到时才加载进上下文，解决「能力要多、常驻上下文要省」的矛盾。
:::

## 思维链路速查

```chain
技能是什么 | 定义与边界 | 概念
渐进式披露 | 三层加载与触发判定 | 核心
SKILL.md 规范 | 六字段与命名约束 | 落地
面试问答 | 高频辨析 | 复盘
```

skill 是 [[AI 工具]] 卷里 agent 的能力扩展机制：把专业能力的说明书放在磁盘上、用到才展开，所以知识可以写得很厚，而常驻上下文的只有一条元数据。

## 技能是什么

`SKILL.md` 由两部分组成：frontmatter 写元数据、Markdown 正文写执行指令（runbook）。格式由 Anthropic 提出并作为开放标准发布（agentskills.io），Claude Code、Microsoft Agent Framework、Copilot Studio 按同一份格式实现。

| 维度 | skill | agent | 提示词 |
|---|---|---|---|
| 形态 | 磁盘目录 + 资源 | 独立上下文与工具循环 | 上下文内文本 |
| 生效 | 描述命中或手动调用 | 主 agent 派发 | 写入即常驻 |
| 粒度 | 任务级能力 | 完整角色 | 单次指令 |
| 成本 | 正文按需加载 | 整套提示与工具常驻 | 全程常驻 |

skill 打包的是「怎么做」，工具「怎么接进来」归 [[MCP]]。

> [!tip] 何时抽成 skill
> 「多步、领域强、可复用」的任务适合抽成 skill；一次性、强上下文绑定的逻辑留在 prompt 或 agent 里。

## 渐进式披露

| 层 | 何时加载 | 预算 | 内容 |
|---|---|---|---|
| 元数据 | 启动即常驻 | 每 skill 约 100 tokens | `name` + `description` |
| 指令 | 命中触发时 | 建议 <5000 tokens | `SKILL.md` 正文 |
| 资源 | 用到才读 / 跑 | 读之前为 0 | `references/`、`scripts/`、`assets/` |

资源层分「读」与「跑」：`references/` 给模型读，`scripts/` 让它跑——脚本只把输出带回上下文，代码本身不占，所以能打包的体量实际无上限。正文另建议 ≤500 行，文件引用保持距 `SKILL.md` 一层深。

```chain
启动登记 | 只有 name+description 进上下文 | 轻量
请求到来 | 模型拿意图比对 description | 判定
命中触发 | 加载 SKILL.md 全文并照 runbook 执行 | 全量
手动调用 | 用户输入 /技能名 | 绕过匹配
```

> [!note] 同一机制，两种粒度
> 微软 Agent Framework 把同一标准写成四阶段：Advertise（约 100 tokens，名称与描述进系统提示）→ Load（<5000 tokens，调 `load_skill` 取全文）→ Read resources（调 `read_skill_resource`）→ Run scripts（调 `run_skill_script`）。后两阶段拆自规范里的同一层「资源」。

## 落地：SKILL.md 规范

| 字段 | 必填 | 约束与写法 |
|---|---|---|
| `name` | 是 | 1–64 字符，kebab-case，等于父目录名 |
| `description` | 是 | 1–1024 字符，「做什么 + 何时用」 |
| `license` | 否 | 许可证名或随包许可证文件名 |
| `compatibility` | 否 | ≤500 字符，声明运行环境要求 |
| `metadata` | 否 | 自定义键值对（字符串 → 字符串） |
| `allowed-tools` | 否 | 空格分隔的预授权工具（实验性） |

- **`name`**：首尾不能是 `-`，也不能有连续 `--`；目录与它必须同名（`pdf-processing/` ↔ `name: pdf-processing`）。
- **`description`**：触发判定的唯一依据，用第三人称写「当用户说 XX / 要做 XX 时调用」并带区分性关键词。

```yaml
---
name: pdf-processing
description: |
  提取 PDF 文本、拆分合并、填写表单。
  当用户处理 PDF 文件或提到表单填写时使用。
---
```

```text
skill-name/
├── SKILL.md           # 必需：frontmatter + 指令正文
├── references/        # 可选：知识文档
├── scripts/           # 可选：可执行代码
└── assets/            # 可选：模板与静态资源
```

<details>
<summary>面试问答 (3题)</summary>

Q：渐进式披露的三层各是什么，预算是多少？

A：元数据约 100 tokens 常驻、指令 <5000 tokens 触发才加载、资源按需且未读为 0。

Q：description 写不好会怎样？

A：它是触发判定的唯一依据，写不清「何时用」就不触发，或在与别的 skill 描述相近时误触发。

Q：skill 和 agent、MCP 怎么分工？

A：agent 是常驻的完整角色，MCP 管工具怎么接进来，skill 只管「这类任务怎么做」——按需加载，还能驱动宿主去调 MCP server。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：skill 越多越好。实际元数据也常驻，几十个 description 语义重叠会让触发判定变难。
- 误区：把全部步骤写进系统提示更稳。实际常驻拖慢推理，改一处要动全局。
- 误区：`allowed-tools` 列了就是权限沙箱。实际只是本轮预授权，未列的工具照样能调。

</details>
