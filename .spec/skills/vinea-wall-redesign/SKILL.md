---
name: vinea-wall-redesign
description: 改造 Vinea 阅读器(reader.html)的视觉/布局/交互，含 build→verify 闭环与 vm 沙箱验证手法。用于「改首页/墙/卷带/卡片」「调样式交互」「重建 reader.html」。注意 reader.html 是构建产物，绝不能直接改。
description_zh: "Vinea 墙改造：构建闭环 + vm 验证 + tpl 结构速查"
description_en: "Vinea wall redesign: build loop, vm verify, tpl internals"
agent_created: true
visibility: "project"
display_name: "墙改造与构建验证"
display_name_en: "vinea-wall-redesign"
---

# Vinea 墙改造 / 构建验证闭环

设计规范（配色主权、首页分卷、设计铁律）常驻 `.spec/memory/MEMORY.md`，动视觉前先读它；本篇只讲**怎么改、怎么验**。

## 铁律

**`reader.html` 是构建产物，禁止直接编辑。** 唯一正确流程：

1. 改**样式 / 交互 / 布局 / JS** → `.build/tpl/` 对应模块（按热区切分，文件头注释 = 该模块铁律，先读它）
2. 改**构建期常量与注入**（`ACCENT`/`ACCENT_INK`、`GROUP` 分卷表、`CAT_LABEL`、mermaid 拷贝）→ `.build/build.mjs`
3. `node .build/build.mjs` → 按清单拼接重新生成 `reader.html`，并把 `.build/mermaid.min.js` 复制到 `vendor/`
4. `node .build/verify.mjs` → 全套校验（见文末）

`build.mjs` 按 `TPL_MANIFEST` 清单序**纯拼接** `.build/tpl/` 模块，替换 `40-js-core.js` 里的 `/*__NOTES__*/` 与 `/*__ROOT__*/` 两个占位符后落盘。三个坑：新模块文件**必须登记进清单**（漏登记 = 静默丢代码）；任何模块的**注释里别写占位符字面量**（`String.replace` 只换第一处，注释会抢占注入——build 有兜底断言拦这个）；模板里没有别的注入点，别自己发明第三个。

## 模板 cook 陷阱

`.build/tpl/` 下每个模块都是已 cook 的纯文件：源码里怎么落到浏览器就怎么写，**正则里直接写 `\s`，不写 `\\s`**。

反斜杠丢失极其隐蔽：`/\S+/g` 写成 `/S+/g` 不报错，只是默默数错——中文笔记恒为 0，下游权重/统计整条链路失效，页面看起来只是「不太对」。改完模板若怀疑转义，回归判据 = 产物与旧版 `cmp` 逐字节相同。

## 墙是运行时生成的 —— grep 产物会误判

`wallHTML(n)` 在浏览器里按需渲染，构建只把函数源码内联进 `reader.html`。卡片、卷带、`.ventry` 都不在落盘 HTML 里，**grep 产物永远匹配不到**——别用 grep 产物判断墙渲染对错，必须在 vm 里真跑 `wallHTML`。

项目已备验证脚本 `verify-spans.mjs`：对每个 MOC 调 `wallHTML`，断言 `.ventry` 数 == links 数。写自己的验证时**复用 `_harness.mjs` 的 `run()`**（DOM/localStorage 假货配齐），跑完顶层脚本后在同一上下文里继续求值：

```js
import { run } from './_harness.mjs';
const { ctx, NOTES, ROOT_ID } = run();    // 顶层 const 已从词法环境取回，ctx.NOTES 是 undefined
const out = ctx.wallHTML(NOTES[ROOT_ID]); // wallHTML 是函数声明，已暴露在 ctx 上
```

`localStorage` 在桩里是空实现，`masteryAll()` 等自带 try/catch 静默回空，不用补桩。tpl 的 JS 用到新浏览器全局（如 `IntersectionObserver`）而 verify 报 `X is not defined` → 在 `_harness` 的 `win`/`ctx` 补桩，**别为过测试删代码**。

## tpl 模块地图（改代码前定位用）

墙 = `42-js-wall.js`（渲染）+ `21/22/23-css-*.css`（封面/卷带/子墙样式）；正文 = `43-js-article.js` + `24-css-article.css`；导航 = `47-js-nav.js`；特效 = `48-js-fx.js`。关键位置：

| 在哪 | 是什么 |
|---|---|
| `build.mjs` `GROUP` | 分卷表：数组序=卷序，`cats` 序=卷内位次，`layout` ∈ tiles/spread/feature/index。**唯一顺序来源**，`MOC.md` 的 links 序对根墙无效 |
| `build.mjs` `ACCENT`/`ACCENT_INK` | 每类卷色（高饱和、色相分离）。**配色属用户主权，别擅自调饱和度/色相**（PITFALLS·设计主权） |
| `tpl/42-js-wall.js` `wallHTML(n)` | 墙渲染入口。根墙走杂志版式（cover + band + `.cm-rail` 卷索引带），子墙走 `.subhead` + `.subwall` ventry 网格；`bandOn = isRoot && 有 group≥0 的卡` |
| `tpl/42-js-wall.js` `orderOf`/`layoutRank` | `order: 1..n` 显式位次 > 权重；`pinned`（`featured` 解析而来）永远第一 |
| `tpl/42-js-wall.js` `MOC_FACETS` | facet 子墙白名单（如 `java-锁`）。给 facet 加子卡片要**三处同步**：MOC 正文双链 + `ids` + `traits`，漏一处静默丢卡 |
| `tpl/41-js-mastery.js` | 三档熟练度（生疏/熟悉/能讲），`localStorage['vinea:mastery']`；MOC 卡聚合整棵子树（flatten 穿透多层是有意的，别"优化"掉）；染色走 `--mc` 覆盖 `--c` |
| `build.mjs` `highlightBlock()` | 代码块 `figure.code` 三段式：sticky `.code-head`（40px，语言色 `--lc`）+ `.code-body`（唯一滚动容器）+ `.code-foot`。**`.ln` 必须 `display:block`**（flex 会吞前导缩进，PITFALLS 有回归判据）；**别给 `.code` 加 `overflow:hidden`**（会变滚动容器，sticky 页眉失效） |

## 排查手法：vm 直接求值

现象对不上时，不用改产物：在 verify 脚本里 `vm.runInContext('表达式', ctx)` 直接求值，或在 `_harness` 里加断言。定位后把临时断言删掉。

**验证脚本别用全局选择器计数**：同一组件在 hero + 每个卷首横幅各有一份（如 `.m-seg`），全局计数会翻倍假 FAIL。先切出具体容器再数。

## 校验清单

改完必跑（一条命令串起全部）：

```bash
cd <项目根> && node .build/build.mjs && node .build/verify.mjs
```

各步通过标志：

- build：`built N notes -> …`；`check.mjs` 沙箱 `RAN OK`（vm 无运行时错误）
- `FEATURE CHECK OK`（必保 DOM/接线、导航模型、CSS 铁律、xilu 清零——设计刻意变更时**先改断言再改实现**，见 verify-features.mjs 头注）
- `GROUPS OK`（卷序/卷内序/待垦/主卡断言）
- `MASTERY CHECK OK`（熟练度断言）
- `SPAN CHECK OK`（每墙 `.ventry` 数 == links 数；「待填子 MOC 仅作警告」是用户没写完的空壳墙，非故障）
- `HEALTH CHECK OK`（无孤儿、全可达）
- 收尾 `node .spec/vinea_check.mjs` 应 `ALL CLEAN`

新领域忘登记 `GROUP` 会落到末尾「其他」卷且 `verify-groups` 判 FAIL——加卷/加类先改 `GROUP`。
