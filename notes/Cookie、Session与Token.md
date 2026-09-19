---
title: Cookie、Session与Token
category: network
aliases: [Cookie, Session, Token, JWT, 会话管理]
---

# Cookie、Session与Token

Cookie、Session 与 Token 是 HTTP 无状态前提下维持用户会话的三类凭证方案，解决「服务端记不住你是谁」的问题；三者差别只在状态存在哪一方——客户端、服务端，还是令牌自身。

## 思维链路速查

```chain
无状态问题 | HTTP 不记住你是谁 | 前提
Cookie / Session | 客户端存 vs 服务端存 | 凭证
Token / JWT | 无状态令牌自包含 | 去中心化
选型对比 | 各自边界与适用场景 | 决策
面试问答 | 高频考点 | 复盘
```

[[HTTP]] 是无状态协议——每个请求都像第一次见面，要「记住」用户就得靠凭证回传。三档解法：浏览器自动携带的 Cookie、服务端维护的 Session、自包含无状态的 Token / JWT。

## Cookie

Cookie 是服务端通过响应头 `Set-Cookie` 下发、浏览器自动在后续请求中回传的小段文本。

| 属性 | 作用 | 示例 |
|---|---|---|
| `Name=Value` | 键值对数据 | `session_id=abc123` |
| `Domain` | 限定回传域名 | `.example.com` |
| `Path` | 限定回传路径 | `/api` |
| `Expires / Max-Age` | 过期时间 | `Max-Age=3600`（1 小时） |
| `HttpOnly` | 禁止 JS 读取 | 防 XSS 窃取 |
| `Secure` | 仅 HTTPS 传输 | 防明文泄露 |
| `SameSite` | 限制跨站携带 | `Strict` / `Lax` / `None` |

拼起来是：`Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`。

- 安全三属性缺一不可：`HttpOnly` 防 XSS 窃取、`Secure` 防明文泄露、`SameSite` 防 CSRF。

> [!tip] SameSite 选择
> `Strict` 跨站完全不带（用户从外部链接点进来会丢登录态）；`Lax` 推荐：顶级导航（链接 / GET 表单）带，AJAX / 图片不带。

## Session

Session 是服务端维护的会话状态，Cookie 只负责传 Session ID，服务端拿它查表取用户数据。

- 流程：登录验证通过 → 建 Session（内存 / [[Redis]]）→ 回 `Set-Cookie: session_id=abc123` → 后续请求自动带上该 Cookie，服务端查表得用户数据。

| 存储位置 | 优点 | 缺点 |
|---|---|---|
| 服务端内存 | 读取最快 | 不可水平扩展（节点间不共享） |
| [[Redis]] | 高性能、支持过期 | 多一次网络开销 |
| 数据库 | 持久化 | 性能最低 |

> [!warning] Session 的扩展瓶颈
> Session 在服务端，多节点部署必须共享存储（如 Redis）；放单机内存则请求必须黏到同一节点，水平扩展受限。

## Token / JWT

Token 是自包含凭证，服务端签发后无需查库；最常用 JWT（JSON Web Token），结构为 `Header.Payload.Signature` 三段。

| 部分 | 内容 | 示例 |
|---|---|---|
| Header | 算法 + 类型 | `{"alg":"HS256","typ":"JWT"}` |
| Payload | 声明（用户ID、角色、过期时间） | `{"sub":"user123","exp":1700000000}` |
| Signature | 签名（防篡改） | HMAC-SHA256(Header + Payload, Secret) |

> [!note] Payload 不加密
> Payload 只是 Base64 编码，任何人可读；敏感信息不要放进去，防篡改靠的是签名。

- 流程：登录验证通过 → 签发 JWT 返回（不存状态）→ 请求带 `Authorization: Bearer <token>` → 验签 + 检查 `exp`，无需查库。
- 无状态 ≠ 什么都不存：黑名单（强制登出）、Refresh Token 仍需服务端存储，消除的只是「每连接」会话状态。

## 三者对比

| 维度 | Cookie + Session | Token / JWT |
|---|---|---|
| 状态存储 | 服务端 | 客户端（Token 自包含） |
| 携带方式 | `Cookie` 头（浏览器自动） | `Authorization` 头（手动） |
| 水平扩展 | 需共享 Session 存储 | 天然支持（无状态） |
| 即时失效 | ✅ 删除 Session 即生效 | ❌ 签发后到期前无法作废 |
| 跨域 | 受 SameSite 限制 | 无限制（Authorization 头） |
| 防 CSRF | 需额外措施（SameSite/CSRF Token） | 天然免疫（需手动携带） |
| 数据大小 | 4KB（Cookie 限制） | 无硬限制 |
| 适用场景 | 传统服务端渲染、同域系统 | 前后端分离、微服务、跨端 |

## 常见方案组合

| 场景 | 推荐方案 | 理由 |
|---|---|---|
| 传统 Web 应用 | Cookie + Session | 自动携带、开发简单 |
| 前后端分离 SPA | Access Token + Refresh Token | 短期安全、长期续签 |
| 微服务内部认证 | JWT + 服务间信任 | 无需集中存储 |
| 第三方登录（OAuth 2.0） | Authorization Code + JWT | 标准流程、跨系统互信 |

<details>
<summary>面试问答 (3题)</summary>

Q：Cookie 和 Session 的区别？

A：Cookie 是客户端凭证、浏览器自动携带（4KB 上限）；Session 是服务端状态，靠 Cookie 里的 Session ID 关联。

Q：JWT 如何实现即时失效？

A：签发后到期前无法自然作废，需黑名单（Redis 存已注销的 Token ID）或短 Access Token + Refresh Token。

Q：如何防止 CSRF 攻击？

A：SameSite Cookie 阻止跨站携带、CSRF Token 嵌入表单、双重 Cookie 验证；生产至少配 SameSite。

</details>

<details>
<summary>常见误区 (2条)</summary>

- 误区：Token 完全不需要服务端存储。刷新令牌、黑名单仍需存，只是比 Session 轻量。
- 误区：JWT 的 Payload 是加密的。它只是 Base64，任何人都能读，防篡改靠签名。

</details>
