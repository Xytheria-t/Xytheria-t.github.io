---
title: WebSocket 速记
category: network
clip: true
---

WebSocket 是建立在单个 TCP 连接上的应用层协议：先用 HTTP 握手把连接「升级」成全双工通道，之后双方随时互发消息，弥补 [[HTTP]] 实时推送能力的不足。

## 握手升级（借 HTTP 完成）

客户端先发一个带升级头的 HTTP 请求：

- `Connection: Upgrade`
- `Upgrade: websocket`

服务器同意则回 `101 Switching Protocols`，连接从 HTTP 升级为 WebSocket，不再走请求-响应模式。

> [!note] 依赖关系
> WebSocket 依赖 HTTP 完成握手，但握手之后就不再是普通 HTTP——它跑在 [[TCP]] 之上，双方随时互发消息。

## 核心特点

- **全双工**：客户端与服务端可同时互发消息。
- **长连接**：一次握手后连接保持，免反复建连。
- **低开销**：数据以「帧」传输，帧头很小，比反复发 HTTP 请求更轻量。
- **实时性高**：服务端可主动推送，无需客户端先请求。

## 地址格式

- `ws://`：明文 WebSocket。
- `wss://`：加密 WebSocket，类比 [[HTTPS]] 与 [[HTTP]] 的关系。

## 典型用途

聊天室 / 即时通讯、实时通知与消息推送、在线协作编辑、股票行情与实时数据大屏、在线游戏、IoT 设备通信。

> [!tip] 一句话定位
> WebSocket 不是 HTTP 的替代品，而是对其实时能力不足的一种补充：适合服务端主动推送、双方频繁交互的场景。
