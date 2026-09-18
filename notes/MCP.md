---
title: MCP
category: ai-tools
order: 3
aliases: [模型上下文协议]
---

# MCP

## 思维链路速查

```chain
为什么需要 | M×N 收敛为 M+N | 动机
三个角色 | host / client / server | 架构
三类原语 | tools / resources / prompts | 能力
传输与生命周期 | stdio / Streamable HTTP | 通信
2026 修订 | 无状态化与 MRTR | 演进
```

模型要动手，先得知道「有哪些工具、怎么调」——MCP 把这件每家各写一遍的事变成一份协议：宿主实现一次 client、工具实现一次 server。2026-07-28 版把核心从有状态改成无状态，让 server 能像普通 HTTP 服务一样部署。

## 为什么需要 MCP

- 没有协议：M 宿主 × N 工具 = M×N 份适配，加一个工具要改 M 家宿主。
- 有协议：宿主实现 client、工具实现 server，集成量降到 M+N，一次实现多宿主复用。

版本线：2024-11 Anthropic 开源首版（规范 2024-11-05）→ 2025-03 Streamable HTTP 取代 HTTP+SSE → 2026-07-28 第五版核心无状态化（本篇基准版本）。

> [!note] 边界澄清
> skill 管「能力怎么打包」（见 [[AI Agent Skill]]），MCP 管「能力怎么接进来」；skill 可驱动宿主去调 MCP server。三者的位置：[[AI Agent]] 是那个循环调用工具的主体。

## 三个角色

| 角色 | 职责 | 例子 |
|---|---|---|
| host（宿主） | 跑模型、管会话、决定是否调工具 | 编码助手、桌面 Agent |
| client（客户端） | 与某个 server 一对一收发协议报文 | 每个 server 一个 client |
| server（服务端） | 暴露工具/资源/提示并执行动作 | 数据库、文件系统封装 |

> [!warning] MCP 不管「该不该调」
> 协议只规定怎么发现、怎么调用、怎么传；是否调用、要不要人审由宿主与业务侧决定——把权限判断寄托在协议上是最常见的认知错误。

## 三类服务端原语

| 原语 | 谁发起 | 语义 | 典型用途 |
|---|---|---|---|
| tools | 模型调用 | 可执行动作，带入参 schema | 查库、发请求、改文件 |
| resources | 宿主或用户读取 | 只读数据，按 URI 寻址 | 文档、日志、配置 |
| prompts | 用户选用 | 预置提示模板 | 代码评审、报告框架 |

客户端侧能力：elicitation（向用户追问）改由 MRTR 承载；sampling（请宿主代调模型）、roots（可访问目录）2026-07-28 起废弃。

## 传输与生命周期

| 传输 | 形态 | 适用 |
|---|---|---|
| stdio | 宿主拉起子进程，标准输入输出收发 JSON-RPC | 本地工具、单机 |
| Streamable HTTP | 单个 HTTP 端点，POST 发请求，响应为 JSON 或 SSE 流 | 远程服务、多客户端 |

报文一律 JSON-RPC 2.0（请求 / 响应 / 通知）；新旧版本是两套生命周期：

```chain
旧版握手 | initialize 协商版本与能力 | 有状态
分配会话 | 返回 Mcp-Session-Id | 粘性
带会话请求 | 每请求都带 session id | 绑定实例
反向请求 | 长连接让服务端问客户端 | 双向
新版自包含 | 版本与能力进 _meta | 无状态
```

> [!warning] 有状态设计的代价
> 会话把客户端钉在某个实例上：下一次调用可能被负载均衡分到没有该会话的实例，只能靠粘性会话或共享存储兜底，扩缩容、蓝绿发布、故障转移都被拖累。

## 2026-07-28 修订要点

| 变更 | 内容 |
|---|---|
| 无状态核心 | 移除 `initialize` 握手与 `Mcp-Session-Id`；每请求 `_meta` 带版本与客户端能力，版本不符报 `UnsupportedProtocolVersionError` |
| 能力发现 | 新增 `server/discover`（必须实现），公布版本、能力与身份 |
| MRTR | 服务端回 `input_required` 与 `inputRequests`，客户端补齐后重发原请求带 `inputResponses`；结果必带 `resultType` |
| 网关与缓存 | POST 带 `Mcp-Method`、`Mcp-Name` 头供网关路由、限流、鉴权；列表结果带 `ttlMs`、`cacheScope` |
| 扩展框架 | 核心小而稳，能力外挂为扩展：`tasks` 长任务、MCP Apps 界面、企业授权 |
| 移除 / 废弃 | 移除 `ping`、`logging/setLevel` 等旧端点；废弃 roots / sampling / logging 与 HTTP+SSE，订阅改用 `subscriptions/listen` 长流 |

- 状态没消失，只是换了位置：跨调用状态由工具发句柄（`browser_id`、`order_id`），模型当普通参数传回。
- 去会话的收益：请求可路由、可重试、可缓存；网关不解析 body 即可鉴权限流，工具目录不用每次重拉；废弃窗口 12 个月内，目录改走工具参数或资源 URI，模型调用改宿主直连 provider。

## 与 function calling 的区别

| 维度 | function calling | MCP |
|---|---|---|
| 定位 / 谁定义 | 模型侧「能调函数」，各厂商 API 参数 | 工具接入的开放协议（Linux 基金会） |
| 发现方式 | 随每次请求传 schema | `tools/list` 动态发现，可缓存 |
| 复用范围 | 宿主各自适配 | 一次实现，多宿主复用 |
| 传输 | 随 API 请求体 | stdio / Streamable HTTP |

## 落地：一次工具调用的往返

报文只留要点，字段以官方规范为准。

```json
// 1. 列工具（可缓存：ttlMs + cacheScope）
{"jsonrpc":"2.0","id":1,"method":"tools/list",
 "_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28"}}
// 2. 工具目录，结果必带 resultType
{"jsonrpc":"2.0","id":1,"result":{"resultType":"complete","ttlMs":60000,
 "cacheScope":"private","tools":[{"name":"query_order","inputSchema":
   {"type":"object"}}]}}
// 3. 需用户确认：不保持长连接，直接返回 input_required
{"jsonrpc":"2.0","id":2,"result":{"resultType":"input_required","inputRequests":
 [{"type":"elicitation","message":"订单金额 1999 元，确认退款？"}]}}
// 4. 补齐后重发原请求，带 inputResponses
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"refund_order",
 "arguments":{"order_id":"A1001"},"inputResponses":[{"confirm":true}]}}
```

- Java 侧用官方 Java SDK（`io.modelcontextprotocol.sdk`）实现 server / client，Spring AI 在其上做声明式封装。
- 把 [[RAG]] 的检索包成 server，任意宿主复用；写操作一律走人审。

## 安全风险

| 风险 | 场景 | 缓解 |
|---|---|---|
| 提示注入 | 工具返回内容里藏指令 | 输出当数据不当指令；高危二次确认 |
| 工具投毒 | 恶意 server 用描述诱导调用 | 只装可信 server，审 `description` |
| 混淆代理 / 越权数据 | 借服务端身份提权、遍历资源 URI 越权 | 最小权限、校验 `iss`、鉴权放服务端 |
| 审计缺失 | 不知道谁调了什么 | 网关按 `Mcp-Method` / `Mcp-Name` 审计 |

<details>
<summary>面试问答 (2题)</summary>

Q：MCP 和 function calling 是一回事吗？

A：不是。前者是模型「能调函数」的 API 能力，后者规定工具怎么发现、调用与传输，厂商中立。

Q：MCP server 怎么接进企业体系？

A：网关按 `Mcp-Method` / `Mcp-Name` 做路由、限流与审计；授权走 OAuth 并校验 `iss`。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：用了 MCP 就不用管权限。实际放大的是「能调什么」的范围，必须最小权限 + 高危人审。
- 误区：MCP server 只能本地跑。实际远程走 Streamable HTTP，2026 版起可无状态水平扩展。
- 误区：协议无状态 = 业务不能有状态。实际状态改为工具发句柄，由请求携带而非连接保存。

</details>
