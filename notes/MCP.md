---
title: MCP
category: ai-tools
order: 2
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

模型要动手，就得先知道「有哪些工具、怎么调」——MCP 把这件事从每家各写一遍变成一份协议：宿主实现一次 client，工具实现一次 server，两边就能互通。2026-07-28 版把协议核心从有状态改成无状态，为的是让 MCP server 像普通 HTTP 服务一样部署。

## 为什么需要 MCP

- 没有协议：M 个宿主 × N 个工具 = M×N 份适配代码，每加一个工具都要在每家宿主改一遍。
- 有了协议：宿主实现 client、工具实现 server，集成量降到 M+N，一个工具实现可被多个宿主复用。

| 时间 | 事件 |
|---|---|
| 2024-11 | Anthropic 开源 MCP，首版规范 2024-11-05 |
| 2025-03 | 引入 Streamable HTTP 传输，取代 HTTP+SSE |
| 2025-06 / 2025-11 | 迭代版本，引入 elicitation 等客户端交互能力 |
| 2025-12 | 捐赠给 Linux 基金会 Agentic AI Foundation，转厂商中立治理 |
| 2026-07 | 第五版规范 2026-07-28：核心无状态化（本篇基准版本） |

> [!note] 边界澄清
> skill 管的是「能力怎么打包」，见 [[AI Agent Skill]]；MCP 管的是「能力怎么接进来」。两者不冲突：一个 skill 可以驱动宿主去调若干 MCP server。

## 三个角色

| 角色 | 职责 | 例子 |
|---|---|---|
| host（宿主） | 跑模型、管会话、决定要不要调工具 | 编码助手、桌面 Agent |
| client（客户端） | 与某个 server 一对一连接，收发协议报文 | host 内每个 server 各一个 client |
| server（服务端） | 暴露工具/资源/提示，真正执行动作 | 数据库、文件系统、内部 API 的封装 |

> [!warning] MCP 不管「该不该调」
> 协议只规定怎么发现、怎么调用、怎么传；是否调用、调用后要不要人审，都是宿主与业务侧的责任——把权限判断寄托在协议上是最常见的认知错误。

## 三类服务端原语

| 原语 | 谁发起 | 语义 | 典型用途 |
|---|---|---|---|
| tools | 模型调用 | 可执行动作，带入参 schema | 查库、发请求、改文件 |
| resources | 宿主或用户读取 | 只读数据，按 URI 寻址 | 文档、日志、配置 |
| prompts | 用户选用 | 预置提示模板 | 代码评审模板、报告框架 |

客户端侧能力有 elicitation（向用户追问补充信息）、sampling（请宿主代调模型）、roots（声明可访问目录）。其中 sampling 与 roots 已在 2026-07-28 废弃，elicitation 改为通过 MRTR 承载（见下节）。

## 传输与生命周期

| 传输 | 形态 | 适用 |
|---|---|---|
| stdio | 宿主拉起子进程，标准输入输出收发 JSON-RPC | 本地工具、单机 |
| Streamable HTTP | 单个 HTTP 端点，POST 发请求，响应为 JSON 或 SSE 流 | 远程服务、多客户端 |

报文一律 JSON-RPC 2.0（请求 / 响应 / 通知）。生命周期在新旧版本里是两套模型：

```chain
旧版握手 | initialize 协商版本与能力 | 有状态
分配会话 | 返回 Mcp-Session-Id | 粘性
带会话请求 | 每请求都带 session id | 绑定实例
反向请求 | 长连接让服务端问客户端 | 双向
新版自包含 | 版本与能力进 _meta | 无状态
```

- **旧版（≤2025-11-25）**：`initialize` 握手协商协议版本与双方能力，服务端返回 `Mcp-Session-Id`，之后每个请求都要带上它；长连接还允许服务端反向请求客户端（sampling / elicitation / roots）。
- **新版（2026-07-28）**：握手与会话一起移除，协议版本与客户端能力放进**每个请求**的 `_meta`；需要提前知道服务端能力时调 `server/discover`，但它不是必需的前置步骤。

> [!warning] 有状态设计的代价
> 会话把客户端钉在某个实例上：负载均衡可能把下一次调用分到没有该会话的实例，只能靠粘性会话或共享会话存储兜底，水平扩缩、蓝绿发布、故障转移全被拖住——这是新版去会话的直接动机。

## 2026-07-28 修订要点

| 变更 | 内容 |
|---|---|
| 无状态核心 | 移除 `initialize` 握手与 `Mcp-Session-Id`；每请求在 `_meta` 带协议版本与客户端能力，版本不匹配返回 `UnsupportedProtocolVersionError` |
| 能力发现 | 新增 `server/discover`，服务端必须实现，用它公布支持的版本、能力与身份 |
| 通知订阅 | HTTP GET 端点与 `resources/subscribe` 由单个 `subscriptions/listen` 长流取代，客户端按类型订阅变更 |
| MRTR | 服务端返回 `resultType: "input_required"` 与 `inputRequests`，客户端补齐信息后**重发原请求**并带 `inputResponses` |
| 结果契约 | 所有结果必带 `resultType`（`complete` / `input_required`） |
| 网关友好 | POST 必带 `Mcp-Method`、`Mcp-Name` 头，工具参数可用 `x-mcp-header` 镜像到 `Mcp-Param-*`；头与 body 不一致返回 400 `HeaderMismatch` |
| 可缓存列表 | `tools/list`、`resources/list`、`prompts/list` 等结果带 `ttlMs` 与 `cacheScope`，客户端可缓存工具目录 |
| 扩展框架 | 核心保持小而稳，能力外挂为扩展：`tasks`（轮询式长任务）、MCP Apps（对话内交互界面）、企业统一授权 |
| 移除 | `ping`、`logging/setLevel`、SSE 流恢复（`Last-Event-ID`） |
| 废弃 | Roots、Sampling、Logging；HTTP+SSE 传输；动态客户端注册（DCR）转向 CIMD |

- **状态没消失，只是换了位置**：需要跨调用状态时由工具自己发句柄（`browser_id`、`order_id`），模型把它当普通参数传回——状态从「连接知道」变成「请求说清楚」。
- **废弃窗口 12 个月**：新实现不要再上 Roots / Sampling / Logging；目录改用工具参数或资源 URI，模型调用改为宿主直连 provider，日志走 stderr 或 OpenTelemetry。

> [!tip] 为什么这些改动利好生产
> 无状态让请求可路由、可重试、可缓存、可追踪；头部路由让网关不解析 body 就能限流鉴权；可缓存列表让工具目录不用每次会话重拉，首字延迟与 prompt 缓存命中率都受益。

## 与 function calling 的区别

| 维度 | function calling | MCP |
|---|---|---|
| 定位 | 模型侧「能调函数」的能力 | 工具与数据接入的开放协议 |
| 谁定义 | 各模型厂商的 API 参数 | 中立规范（Linux 基金会托管） |
| 发现方式 | 每次请求随 API 传 schema | `tools/list` 动态发现，可缓存 |
| 复用范围 | 宿主各自适配 | 一次实现，多宿主复用 |
| 传输 | 随 API 请求体 | stdio / Streamable HTTP |

## 落地：一次工具调用的往返

下列报文只保留要点、省略了头部与完整 schema，字段以官方规范为准。

```json
// 1. 客户端列工具（结果可缓存：ttlMs + cacheScope）
{"jsonrpc":"2.0","id":1,"method":"tools/list",
 "_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28",
          "io.modelcontextprotocol/clientCapabilities":{}}}

// 2. 服务端返回工具目录，结果必带 resultType
{"jsonrpc":"2.0","id":1,"result":{"resultType":"complete","ttlMs":60000,
 "cacheScope":"private",
 "tools":[{"name":"query_order","description":"按订单号查订单",
   "inputSchema":{"type":"object","properties":{"order_id":{"type":"string"}}}}]}}

// 3. 需要用户确认时不保持长连接，直接返回 input_required
{"jsonrpc":"2.0","id":2,"result":{"resultType":"input_required",
 "inputRequests":[{"type":"elicitation","message":"订单金额 1999 元，确认退款？"}]}}

// 4. 客户端补齐后重发原请求，带 inputResponses
{"jsonrpc":"2.0","id":3,"method":"tools/call",
 "params":{"name":"refund_order","arguments":{"order_id":"A1001"},
           "inputResponses":[{"confirm":true}]}}
```

- Java 侧可用官方 Java SDK（`io.modelcontextprotocol.sdk`）实现 server / client，Spring AI 的 MCP 集成在其上做了声明式封装。
- 把 [[RAG]] 的检索能力包成一个 server，任意宿主都能复用同一套检索；写操作（退款、删除）一律走人审确认。

## 安全风险

| 风险 | 场景 | 缓解 |
|---|---|---|
| 提示注入 | 工具返回内容里藏指令，诱导模型越权调用 | 工具输出当数据不当指令；高危操作二次确认 |
| 工具投毒 | 恶意 server 用工具描述诱导调用 | 只装可信 server；审 `description` 与 schema |
| 混淆代理 | 借服务端身份拿到更大权限 | 最小权限凭据、按 issuer 绑定、校验 `iss` |
| 越权数据 | 资源 URI 可遍历到未授权目录 | 鉴权与范围校验放服务端，别靠客户端自觉 |
| 审计缺失 | 不知道谁调了什么 | 走网关按 `Mcp-Method` / `Mcp-Name` 路由与审计，透传 trace context |

<details>
<summary>面试问答 (5题)</summary>

Q：MCP 解决了什么问题？

A：把 M 个宿主与 N 个工具的 M×N 适配收敛成 M+N：宿主实现一次 client，工具实现一次 server，双方按统一协议互通，工具一次实现多宿主复用。

Q：MCP 和 function calling 是一回事吗？

A：不是。function calling 是模型「能调函数」的 API 能力；MCP 规定工具怎么被发现、调用与传输，且厂商中立、可跨宿主复用。

Q：为什么 2026 版要去掉会话？

A：会话让实例之间不可互换，只能靠粘性会话或共享存储兜底，扩缩容、蓝绿发布、故障转移都被绑住。改成每请求自包含后，server 可像普通 HTTP 服务一样部署与治理。

Q：无状态之后多轮交互怎么做？

A：用 MRTR：服务端返回 `input_required` 与 `inputRequests`，客户端补齐信息后重发原请求带 `inputResponses`；跨调用状态则由工具发显式句柄，模型当普通参数传回。

Q：MCP server 怎么接进企业体系？

A：请求头提到网关做路由、限流与审计（`Mcp-Method` / `Mcp-Name`），授权走 OAuth 并校验 `iss`、凭据按 issuer 绑定，能力由企业统一授权扩展集中管控，日志与链路走 OpenTelemetry。

</details>

<details>
<summary>常见误区 (4条)</summary>

- 误区：MCP 是模型能力，装上就会自动用。实际是否调用由宿主与模型决定，协议只提供发现与调用方式。
- 误区：用了 MCP 就不用管权限。实际 MCP 放大的是「能调什么」的范围，必须最小权限 + 高危操作人审。
- 误区：MCP server 只能本地跑。实际远程走 Streamable HTTP，2026 版起还能无状态水平扩展。
- 误区：协议无状态 = 业务不能有状态。实际状态改为显式句柄，由请求携带而不是连接保存。

</details>
