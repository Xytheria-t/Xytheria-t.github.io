---
title: Cookie、Session与Token
category: network
aliases: [Cookie, Session, Token, JWT, 会话管理]
---

# Cookie、Session与Token

## 思维链路速查

```chain
无状态问题 | HTTP 不记住你是谁 | 前提
Cookie / Session | 客户端存 vs 服务端存 | 凭证
Token / JWT | 无状态令牌自包含 | 去中心化
选型对比 | 各自边界与适用场景 | 决策
面试问答 | 高频考点 | 复盘
```

[[HTTP]] 是无状态协议——每个请求都像第一次见面。要让服务端「记住」用户，就得靠凭证回传。Cookie、Session、Token 是三种不同粒度的解法：从浏览器自动携带的甜点，到服务端维护的会话，再到自包含的无状态令牌。

## 无状态问题

| 问题 | 表现 |
|---|---|
| 服务端不记住请求来源 | 每个请求都要重新认证 |
| 无法关联多次请求 | 购物车、登录态无法保持 |

> [!note] 无状态是特性不是缺陷
> 无状态让服务端天然易水平扩展——任意节点都能处理任意请求，无需会话黏性。代价是每个请求都要重复携带身份与上下文。

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

```http
Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Lax; Max-Age=3600
```

> [!warning] 三个安全属性缺一不可
> `HttpOnly` 阻断 JS 读取（防 XSS）；`Secure` 限定 HTTPS（防中间人）；`SameSite` 限制跨站（防 CSRF）。生产环境必须同时配置。

> [!tip] SameSite 选择
> `Strict` 最严：跨站完全不带，但用户从外部链接点进来会丢失登录态。`Lax` 是推荐值：顶级导航（链接/GET 表单）带，AJAX/图片不带。

## Session

Session 是服务端为每个用户维护的会话状态。Cookie 负责传输 Session ID，服务端用它查表获取用户数据。

```sequence
participant C as 客户端
participant S as 服务端
C->>S: POST /login（用户名+密码）
S->>S: 验证通过，创建 Session（存内存/Redis）
S->>C: Set-Cookie: session_id=abc123
C->>S: GET /api/user（Cookie: session_id=abc123）
S->>S: 查表：abc123 → 用户A
S->>C: 返回用户A的数据
```

| 存储位置 | 优点 | 缺点 |
|---|---|---|
| 服务端内存 | 读取最快 | 不可水平扩展（节点间不共享） |
| [[Redis]] | 高性能、支持过期 | 多一次网络开销 |
| 数据库 | 持久化 | 性能最低 |

> [!danger] Session 的扩展瓶颈
> Session 存在服务端，多节点部署时必须共享存储（如 Redis）。如果 Session 在单机内存，请求必须黏到同一台节点——水平扩展受限。

## Token / JWT

Token 是自包含的凭证，服务端签发后不再需要查库。最常用的是 JWT（JSON Web Token）。

### JWT 结构

```
Header.Payload.Signature
```

| 部分 | 内容 | 示例 |
|---|---|---|
| Header | 算法 + 类型 | `{"alg":"HS256","typ":"JWT"}` |
| Payload | 声明（用户ID、角色、过期时间） | `{"sub":"user123","exp":1700000000}` |
| Signature | 签名（防篡改） | HMAC-SHA256(Header + Payload, Secret) |

> [!note] Payload 不加密
> JWT 的 Payload 只是 Base64 编码，任何人可读。敏感信息不要放 Payload，或配合加密层使用。

### Token 流程

```sequence
participant C as 客户端
participant S as 服务端
C->>S: POST /login（用户名+密码）
S->>S: 验证通过，生成 JWT
S->>C: 返回 Token（不存服务端状态）
C->>S: GET /api/user（Authorization: Bearer <token>）
S->>S: 验签 + 检查 exp，无需查库
S->>C: 返回数据
```

> [!warning] 无状态 ≠ 什么都不存
> 黑名单（强制登出）、刷新令牌（Refresh Token）仍需服务端存储。真正消除的是「每个连接」的会话状态，不是所有状态。

## 三者对比

| 维度 | Cookie + Session | Token / JWT |
|---|---|---|
| 状态存储 | 服务端（Session） | 客户端（Token 自包含） |
| 携带方式 | `Cookie` 头（浏览器自动） | `Authorization` 头（手动） |
| 水平扩展 | 需共享 Session 存储 | 天然支持（无状态） |
| 即时失效 | ✅ 删除 Session 即生效 | ❌ 签发后到期前无法作废 |
| 跨域 | 受 SameSite 限制 | 无限制（Authorization 头） |
| 防 CSRF | 需额外措施（SameSite/CSRF Token） | 天然免疫（需手动携带） |
| 数据大小 | 4KB（Cookie 限制） | 无硬限制（但建议精简） |
| 适用场景 | 传统服务端渲染、同域系统 | 前后端分离、微服务、跨端 |

> [!tip] 选型一句话
> 服务端渲染 + 同域 → Cookie + Session 简单省心；前后端分离 / 微服务 / 多端 → Token / JWT 无状态扩展性好。

## 常见方案组合

| 场景 | 推荐方案 | 理由 |
|---|---|---|
| 传统 Web 应用 | Cookie + Session | 浏览器自动携带，开发简单 |
| 前后端分离 SPA | Access Token + Refresh Token | 短期令牌安全，长期令牌续签 |
| 微服务内部认证 | JWT + 服务间信任 | 无需集中 Session 存储 |
| 第三方登录（OAuth 2.0） | Authorization Code + JWT | 标准流程，跨系统互信 |

<details>
<summary>面试问答 (5题)</summary>

Q：Cookie 和 Session 的区别？

A：Cookie 是客户端存储的凭证，浏览器自动携带；Session 是服务端存储的会话状态，通过 Cookie 中的 Session ID 关联。Cookie 有 4KB 大小限制，Session 理论上无限制但受服务端存储约束。

Q：为什么 Token 比 Session 更适合微服务？

A：Token 自包含（用户信息在 Token 里），服务端无需查库即可验签，天然支持水平扩展。Session 必须共享存储，多节点部署时需要 Redis 等集中式存储，增加复杂度。

Q：JWT 如何实现即时失效？

A：JWT 签发后到期前无法自然作废。要实现即时失效，需要配合黑名单（Redis 存已注销的 Token ID）或缩短 Access Token 有效期 + Refresh Token 机制。

Q：SameSite=Strict 和 SameSite=Lax 的区别？

A：Strict：任何跨站请求都不带 Cookie（用户从外部链接点进来会丢失登录态）。Lax：顶级导航（链接、GET 表单）带，AJAX/图片/iframe 不带。Lax 是推荐的平衡值。

Q：如何防止 CSRF 攻击？

A：三道防线：SameSite Cookie（浏览器层面阻止跨站携带）、CSRF Token（服务端生成随机令牌嵌入表单）、双重 Cookie 验证（读取 Cookie 值放请求参数比对）。生产环境至少配 SameSite。

</details>

<details>
<summary>常见误区 (4条)</summary>

- 误区：Token 完全不需要服务端存储。刷新令牌、黑名单仍需存储，只是比 Session 轻量得多。
- 误区：JWT 的 Payload 是加密的。Payload 只是 Base64 编码，任何人都能读；防篡改靠签名，不是加密。
- 误区：Cookie 不安全所以不用。配齐 HttpOnly + Secure + SameSite 后，Cookie 是同域场景下最省心的方案。
- 误区：Session 比 Token 更安全。安全性取决于实现而非方案——Session 被劫持同样危险，Token 泄露同样麻烦。

</details>
