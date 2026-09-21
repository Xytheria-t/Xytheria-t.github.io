---
title: CORS
category: network
aliases: [跨域资源共享, Cross-Origin Resource Sharing]
---

# CORS

:::lede
CORS（Cross-Origin Resource Sharing，跨域资源共享）是浏览器在同源策略之上提供的放行协议：服务端用响应头声明哪些来源可读其响应，浏览器据此决定跨域响应是否交给页面脚本。
**主体：** 校验发生在浏览器 · 服务端不拦请求只声明 · 非简单请求先发预检
:::

同源策略阻止跨域读响应，CORS 是服务器声明「允许哪些来源读我」的标准化机制：简单请求直接发，非简单请求先 OPTIONS 预检。

## 同源策略

| 维度 | 相同 = 同源 |
|---|---|
| 协议 | `https` ≠ `http` |
| 域名 | `a.example.com` ≠ `b.example.com` |
| 端口 | `:8080` ≠ `:80` |

> [!note] 同源策略限制的是「读」
> 跨域请求能发出去、响应也能到浏览器，但 JS 读不到响应体——被拦在 `XMLHttpRequest` / `fetch` 层；表单提交、`<img>` 加载不受限。

- 同源看协议 + 域名 + 端口三元组；同站（`SameSite`）只看 eTLD+1（`example.com`），`a.example.com` 与 `b.example.com` 同站不同源。

## CORS 机制

### 简单请求

| 条件 | 取值范围 |
|---|---|
| 方法 | `GET` / `HEAD` / `POST` |
| 头部 | 仅 `Accept` / `Accept-Language` / `Content-Language` / `Content-Type` |
| `Content-Type` | 仅 `application/x-www-form-urlencoded` / `multipart/form-data` / `text/plain` |

- 三者全满足才直接发送：浏览器自动加 `Origin` → 服务端回 `Access-Control-Allow-Origin` → 比对不匹配即报跨域错误。

### 预检请求（Preflight）

非简单请求（`PUT` / `DELETE` / 自定义头 / `Content-Type: application/json`）先发 OPTIONS 探路：

```chain
浏览器发 OPTIONS | Origin + Access-Control-Request-Method | 预检
服务端返回允许 | Access-Control-Allow-* 头 | 确认
浏览器发实际请求 | 带 Origin 的真实请求 | 执行
```

| 预检响应头 | 作用 |
|---|---|
| `Access-Control-Allow-Origin` | 允许的来源（`*` 或具体值） |
| `Access-Control-Allow-Methods` | 允许的 HTTP 方法 |
| `Access-Control-Allow-Headers` | 允许的请求头 |
| `Access-Control-Max-Age` | 预检结果缓存秒数（减少 OPTIONS 往返，设 -1 或不设则每次都预检） |
| `Access-Control-Allow-Credentials` | 是否允许携带 Cookie / Auth |

> [!danger] `Access-Control-Allow-Origin: *` 的陷阱
> 配 `*` 时不能同时设 `Access-Control-Allow-Credentials: true`，浏览器会拒绝；要携带凭证必须写死具体来源。

### 带凭证请求

默认跨域请求不带 Cookie / HTTP Auth，要带上需两头配：

1. 客户端：`fetch(url, { credentials: 'include' })` 或 `xhr.withCredentials = true`
2. 服务端：`Access-Control-Allow-Credentials: true` + `Access-Control-Allow-Origin` 写明具体来源

> [!warning] CORS 与 SameSite 两层独立
> 即使 CORS 允许，`SameSite=Strict` 的 Cookie 在跨站请求中仍不会发送：CORS 管「JS 能不能读响应」，`SameSite` 管「Cookie 要不要带」。

## 落地：Spring 与 Nginx

```java
// WebMvcConfigurer#addCorsMappings
registry.addMapping("/api/**")
        .allowedOriginPatterns("http://localhost:3000")
        .allowedMethods("GET", "POST", "PUT", "DELETE")
        .allowedHeaders("*").allowCredentials(true).maxAge(3600);
```

- 上例携带凭证，故写具体来源；Spring Boot 2.4+ 才支持 `allowedOriginPatterns` 通配符，旧版 `allowedOrigins` 不支持。
- Nginx 侧回同样几个头：`Access-Control-Allow-Origin` 用 `$http_origin` 动态回显（比写死 `*` 安全且支持凭证），OPTIONS 直接 `return 204`。

## CORS vs CSRF

| 维度 | CORS | CSRF |
|---|---|---|
| 保护目标 | 防 JS 读跨域响应 | 防伪造跨站请求 |
| 机制 | 服务端声明允许的 Origin | Token / SameSite Cookie |
| 生效层 | 浏览器 JS 层（`XMLHttpRequest`） | 浏览器请求层（Cookie 自动携带） |
| 后端调用 | 不影响（curl / 后端互调不走 CORS） | 不影响 |

<details>
<summary>面试问答 (3题)</summary>

Q：什么是跨域？为什么会有跨域问题？

A：浏览器同源策略要求协议 + 域名 + 端口三元组一致，否则 JS 读不到跨域响应；请求能发出去、响应也能到浏览器。

Q：简单请求和预检请求的区别？

A：简单请求满足方法 / 头部 / `Content-Type` 三重限制，浏览器直接发送；其余先发 OPTIONS 预检，服务端返回允许的 Method / Headers / Origin 后才发实际请求。

Q：`Access-Control-Allow-Origin: *` 什么时候不能用？

A：需要携带凭证（Cookie / HTTP Auth）时不能用——浏览器要求 `Allow-Credentials: true` 与具体来源配对。

</details>

<details>
<summary>常见误区 (3条)</summary>

- 误区：CORS 是后端框架的功能。它是浏览器行为，后端只负责回 `Access-Control-*` 头；curl / Postman 不走 CORS。
- 误区：`Access-Control-Allow-Origin: *` 最安全。通配意味着任何来源都能读响应，要凭证时还直接失效。
- 误区：预检是多余的。它让服务端有机会拒绝不信任的来源 / 方法 / 头部，避免非简单请求被意外放行。

</details>
