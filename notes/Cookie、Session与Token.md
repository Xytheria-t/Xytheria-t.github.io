---
title: Cookie、Session与Token
category: network
aliases: [Cookie, Session, Token, JWT, 会话管理]
---

# Cookie、Session与Token

:::lede
Cookie、Session 与 Token 是 [[HTTP]] 无状态前提下维持用户会话的三类凭证方案，解决「服务端记不住你是谁」的问题。
**边界：** 分水岭不在安全性，而在状态存在哪一方——客户端、服务端，还是令牌自身。
:::

## 思维链路速查

```chain
凭证回传 | 浏览器自动带 Cookie / 手动挂 Token | 前提
状态存放 | 服务端会话 / 令牌自包含 | 分歧
失效能力 | 删状态即刻生效 / 等过期 | 代价
攻击面 | 自动携带招 CSRF / 手动招 XSS | 权衡
选型落地 | 短令牌 + 可撤销刷新 | 收敛
```

无状态意味着服务端不保留每连接上下文，凭证必须由客户端每次带回来。谁负责「带」、状态存在哪，决定了扩展性、失效能力与攻击面——下文按这条主线逐档对比。

## 凭证的携带方式

三类方案中只有 Cookie 由浏览器自动回传：服务端用 `Set-Cookie` 下发，浏览器按 `Domain` / `Path` 匹配，后续请求自动附在 `Cookie` 头。Token 没有这层自动化，必须手动挂到 `Authorization: Bearer <token>`。

- 跨域要带上 Cookie，客户端加 `credentials: 'include'`、服务端回 `Access-Control-Allow-Credentials: true` 且来源写具体值，详见 [[CORS]]。

> [!warning] 自动携带是 CSRF 的成因
> 请求只要发往匹配的域就必然带上 Cookie，攻击者无需读到它，借用户浏览器发一个跨站请求就能以用户身份操作。

## Cookie 属性与安全

| 属性 | 作用 | 示例 |
|---|---|---|
| `Name=Value` | 键值对数据 | `session_id=abc123` |
| `Domain` / `Path` | 限定回传范围 | `.example.com` / `/api` |
| `Expires` / `Max-Age` | 过期时间 | `Max-Age=3600` |
| `HttpOnly` | 禁止 JS 读取，防 XSS 窃取 | — |
| `Secure` | 仅 [[HTTPS]] 传输，防明文泄露 | — |
| `SameSite` | 限制跨站携带，防 CSRF | `Strict` / `Lax` / `None` |

`Set-Cookie: session_id=abc123; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`

| `SameSite` | 行为 | 代价 |
|---|---|---|
| `Strict` | 跨站请求一律不带 | 外链点进来丢登录态 |
| `Lax` | 顶级导航带，AJAX 不带 | 推荐默认值 |
| `None` | 跨站一律带，须配 `Secure` | 放弃 CSRF 防护 |

- Chrome 80+ 起未显式声明 `SameSite` 的 Cookie 按 `Lax` 处理；单个 Cookie 约 4KB 上限。

## Session：状态留在服务端

Session 是服务端维护的会话状态，Cookie 只传一个无业务含义的 Session ID，服务端拿它查表还原用户。

- 流程：登录校验通过 → 建 Session → 回 `Set-Cookie: session_id=...` → 后续请求带 Cookie，服务端查表取用户数据。

| 存储位置 | 优点 | 缺点 |
|---|---|---|
| 服务端内存 | 读取最快 | 多节点不共享，需会话粘滞 |
| [[Redis]] | 高性能、自带过期 | 多一次网络往返 |
| 数据库 | 持久化 | 性能最低 |

> [!note] 登录后必须换 Session ID
> 不换则攻击者可预先构造一个已知 ID 诱导用户登录（会话固定攻击），登录态会落进攻击者手里；校验通过后重新生成 ID 是标准动作。

## Token / JWT：状态写进令牌

JWT（JSON Web Token）是自包含令牌，结构为 `Header.Payload.Signature` 三段 Base64URL，服务端验签即可取信，无需查库。

| 部分 | 内容 | 示例 |
|---|---|---|
| Header | 算法 + 类型 | `{"alg":"HS256","typ":"JWT"}` |
| Payload | 声明：用户 ID、角色、过期时间 | `{"sub":"user123","exp":1700000000}` |
| Signature | 前两段的签名结果 | `HMAC-SHA256(前两段, secret)` |

- 签名覆盖 `base64url(Header) + "." + base64url(Payload)`，改任何一个字节验签都不过。

| 算法 | 密钥形态 | 适用 |
|---|---|---|
| HS256 | 对称，签验同一把密钥 | 单服务自签自验，密钥泄露即可伪造 |
| RS256 | 非对称，私钥签、公钥验 | 验签方多于签发方，公钥可公开分发 |

> [!warning] Payload 只是编码不是加密
> 任何人都能 Base64URL 解码读出内容，敏感信息不要放；防篡改靠签名，不靠「看不见」。

- 验签只证明令牌没被改过，不证明没过期、没被撤销：`exp` 必须校验，强制登出另需黑名单。

## 三者对比

| 维度 | Cookie + Session | Token / JWT |
|---|---|---|
| 状态存储 | 服务端 | 令牌自身，服务端无状态 |
| 携带方式 | `Cookie` 头，浏览器自动 | `Authorization` 头，手动 |
| 服务端开销 | 每请求查会话存储 | 每请求验签，不查库 |
| 水平扩展 | 需共享 Session 存储 | 天然支持 |
| 即时失效 | 删 Session 即刻生效 | 到期前无法自然作废 |
| 跨域 | 受 `SameSite` 与 CORS 双重限制 | 无额外限制 |
| CSRF | 需 `SameSite` 或 CSRF Token | 免疫（前提是不存 Cookie） |
| 体积 | 几十字节随机 ID | 声明越多越大，每请求都带 |
| 适用场景 | 传统服务端渲染、同域系统 | 前后端分离、微服务、多端 |

## Token 存哪：XSS 与 CSRF 的取舍

| 存放位置 | 面对 XSS | 面对 CSRF |
|---|---|---|
| `localStorage` | ❌ 任意脚本可读走 | ✅ 不会自动携带 |
| 内存变量 | ✅ 刷新即失，需重登 | ✅ 不会自动携带 |
| `HttpOnly` Cookie | ✅ JS 读不到 | ❌ 自动携带 |

- 主流做法：Access Token 放内存、Refresh Token 放 `HttpOnly + Secure + SameSite` Cookie——XSS 偷不走长期凭证，CSRF 只影响刷新接口（可再校验 `Origin`）。
- 续期靠双令牌：Access Token 5~15 分钟，Refresh Token 7~30 天且存 [[Redis]] 可随时撤销，补上「JWT 无法主动失效」的缺口；刷新时轮换新 Refresh Token，旧的立即作废。

## 落地：Spring 拦截器校验 JWT

```java
public class JwtInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse resp, Object handler) {
        String h = req.getHeader("Authorization");                 // "Bearer xxx"
        if (h == null || !h.startsWith("Bearer ")) return reject(resp);
        try {
            Claims c = Jwts.parserBuilder().setSigningKey(key).build()
                    .parseClaimsJws(h.substring(7)).getBody();     // 验签 + 校验 exp
            UserContext.set(c.getSubject());                   // 存 ThreadLocal 供本次请求用
            return true;
        } catch (JwtException e) {                             // 签名错 / 过期 / 格式错
            return reject(resp);
        }
    }
}
```

- `parseClaimsJws` 一次完成验签与 `exp` 校验，任一不过都抛 `JwtException`；拦截器只管认证，授权（角色 / 权限）交给后续注解。

<details>
<summary>面试问答 (4题)</summary>

Q：Cookie 和 Session 的区别？

A：Cookie 是存在客户端、浏览器自动携带的凭证（单个约 4KB）；Session 是服务端状态，靠 Cookie 里的 Session ID 关联。

Q：JWT 如何实现即时失效？

A：签名令牌到期前无法自然作废，靠 [[Redis]] 黑名单存已注销的 `jti`，或改用短 Access Token + 可撤销的 Refresh Token。

Q：HS256 和 RS256 怎么选？

A：单服务自签自验用 HS256（对称、快）；验签方多于签发方用 RS256，公钥可分发且泄露公钥不影响签发安全。

Q：为什么说 JWT 天然免疫 CSRF？

A：CSRF 依赖浏览器自动携带凭证，而 JWT 要前端手动放进 `Authorization` 头；一旦把 JWT 存进 Cookie，这个免疫就没了。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：Token 完全不需要服务端存储。黑名单、Refresh Token 仍需存，消除的只是每连接的会话状态。
- 误区：JWT 的 Payload 是加密的。它只是 Base64URL，任何人都能读，防篡改靠签名。
- 误区：`SameSite=Strict` 就绝对安全。它只挡跨站携带，同站 XSS 仍能读走非 `HttpOnly` 的 Cookie。

</details>
