---
title: CORS
category: network
aliases: [跨域资源共享, Cross-Origin Resource Sharing]
---

# CORS

## 思维链路速查

```chain
同源策略 | 浏览器安全基石 | 前提
CORS 机制 | 预检 · 简单请求 · 头部 | 核心
常见配置 | Spring · Nginx | 落地
面试问答 | 高频考点 | 复盘
```

同源策略阻止跨域读响应，CORS 是服务器声明「允许哪些来源读我」的标准化机制：简单请求直接发，非简单请求先 OPTIONS 预检。

## 同源策略

| 维度 | 相同 = 同源 |
|---|---|
| 协议 | `https` ≠ `http` |
| 域名 | `a.example.com` ≠ `b.example.com` |
| 端口 | `:8080` ≠ `:80` |

> [!note] 同源策略限制的是「读」
> 跨域请求**能发出去**，响应**也能到浏览器**，但 JS 读不到响应体——被同源策略拦在 `XMLHttpRequest` / `fetch` 层。表单提交、`<img>` 标签加载不受限（只拿不到响应内容）。

> [!warning] 同源 ≠ 同站
> 同源看协议+域名+端口三元组；同站（`SameSite`）只看 eTLD+1（`example.com`）。`a.example.com` 和 `b.example.com` 同站不同源。

## CORS 机制

### 简单请求

满足以下全部条件，浏览器直接发送：

- 方法：`GET` / `HEAD` / `POST`
- 头部：仅 `Accept` / `Accept-Language` / `Content-Language` / `Content-Type`
- `Content-Type` 仅 `application/x-www-form-urlencoded` / `multipart/form-data` / `text/plain`

> [!note] 简单请求的 CORS 流程
> 浏览器自动加 `Origin` 头 → 服务端返回 `Access-Control-Allow-Origin` → 浏览器检查是否匹配 → 匹配则 JS 可读响应，否则报跨域错误。

### 预检请求（Preflight）

非简单请求（如 `PUT` / `DELETE` / 自定义头 / `Content-Type: application/json`）触发预检：

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
| `Access-Control-Max-Age` | 预检结果缓存秒数（减少 OPTIONS 往返） |
| `Access-Control-Allow-Credentials` | 是否允许携带 Cookie / Auth |

> [!danger] `Access-Control-Allow-Origin: *` 的陷阱
> 配 `*` 通配时**不能**同时设 `Access-Control-Allow-Credentials: true`——浏览器会拒绝。需要携带凭证（Cookie）时必须写死具体来源。

> [!tip] 减少预检开销
> 服务端设 `Access-Control-Max-Age: 3600` 让浏览器缓存预检结果 1 小时，避免每次非简单请求都多一个 OPTIONS 往返。

### 带凭证请求

默认跨域请求不带 Cookie / HTTP Auth。要带上需：

1. 客户端：`fetch(url, { credentials: 'include' })` 或 `xhr.withCredentials = true`
2. 服务端：`Access-Control-Allow-Credentials: true` + `Access-Control-Allow-Origin` 写死具体来源（不能 `*`）

> [!warning] Cookie 的 SameSite 与 CORS 配合
> 即使 CORS 允许，`SameSite=Strict` 的 Cookie 在跨站请求中浏览器仍不会发送。CORS 管的是「JS 能不能读响应」，`SameSite` 管的是「Cookie 要不要带」——两层独立。

## 常见配置

### Spring Boot

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("http://localhost:3000")
                .allowedMethods("GET", "POST", "PUT", "DELETE")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
```

> [!note] `allowedOriginPatterns` vs `allowedOrigins`
> Spring Boot 2.4+ 用 `allowedOriginPatterns` 支持通配符；旧版 `allowedOrigins` 不支持 `*` 与模式匹配。

### Nginx

```nginx
location /api/ {
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
    add_header Access-Control-Allow-Credentials true always;
    add_header Access-Control-Max-Age 3600 always;

    if ($request_method = OPTIONS) {
        return 204;
    }
}
```

> [!tip] Nginx 用 `$http_origin` 而非硬编码
> `$http_origin` 取请求的 `Origin` 头，动态匹配——比写死 `*` 安全，且支持携带凭证。

## CORS vs CSRF

| 维度 | CORS | CSRF |
|---|---|---|
| 保护目标 | 防 JS 读跨域响应 | 防伪造跨站请求 |
| 机制 | 服务端声明允许的 Origin | Token / SameSite Cookie |
| 生效层 | 浏览器 JS 层（`XMLHttpRequest`） | 浏览器请求层（Cookie 自动携带） |
| 后端调用 | 不影响（curl / 后端互调不走 CORS） | 不影响 |

> [!danger] CORS 不防 CSRF
> CORS 阻止的是「恶意页面的 JS 读你的 API 响应」，不是「恶意页面伪造请求发到你的 API」。防 CSRF 靠 Token 或 `SameSite` Cookie，两者独立。

<details>
<summary>面试问答 (5题)</summary>

Q：什么是跨域？为什么会有跨域问题？

A：浏览器同源策略要求协议+域名+端口三元组一致，否则 JS 不能读跨域响应。跨域是浏览器的安全限制，不是服务端限制——请求能发出去，响应也能到浏览器，只是 JS 读不到。

Q：简单请求和预检请求的区别？

A：简单请求满足方法/头部/Content-Type 三重限制，浏览器直接发送；预检请求先发 OPTIONS 探路，服务端返回允许的方法/头部/来源后，浏览器才发实际请求。预检是为了避免非简单请求被服务端意外允许导致安全问题。

Q：`Access-Control-Allow-Origin: *` 什么时候不能用？

A：需要携带凭证（Cookie / HTTP Auth）时不能用 `*`——浏览器要求 `Allow-Credentials: true` 与具体来源配对。生产环境建议写死具体来源。

Q：CORS 能防 CSRF 吗？

A：不能。CORS 防的是「JS 读跨域响应」，CSRF 防的是「伪造跨站请求」。两者保护目标不同，需独立配置。现代替代方案是 `SameSite=Strict` Cookie。

Q：预检请求能被缓存吗？

A：能。服务端返回 `Access-Control-Max-Age: 秒数`，浏览器在有效期内跳过预检直接发实际请求。设为 -1 或不设则每次都要预检。

</details>

<details>
<summary>常见误区 (4条)</summary>

- 误区：CORS 是后端框架的功能。CORS 是浏览器行为——后端只是返回正确的 `Access-Control-*` 头，浏览器决定是否拦响应。curl / Postman 不走 CORS。
- 误区：`Access-Control-Allow-Origin: *` 最安全。通配意味着任何来源都能读响应，生产环境应写死具体域名。需要凭证时 `*` 直接失效。
- 误区：CORS 预检是多余的。预检是安全阀——让服务端有机会拒绝不信任的来源/方法/头部，避免非简单请求被意外放行。
- 误区：关掉浏览器 CORS 就能跨域。关浏览器安全策略只绕过开发限制，生产环境必须正确配置 CORS 头。

</details>
