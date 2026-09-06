# Vinea 项目长期记忆

> 本文件为唯一常驻规范源。踩坑台账见 `PITFALLS.md`。
> 动 `.build/` 任何文件前先 `Read D:/Work/Vinea/PITFALLS.md`。

## 会话开头铁律
- 动 `.build/` 前先读 `PITFALLS.md`。
- 不写 `.workbuddy/memory/` 日志（目录已废弃）；踩坑记 `PITFALLS.md`。
- 记忆只存长期有效的规范与偏好：不记设计迭代过程、被否方案、已删死代码、单次改动细节。能从代码/文件推导的一律不写。

## 项目定位
- 离线卡片式阅读器，分发形态 = 文件夹：根 `reader.html` + 同目录 `vendor/`（双击即开、不跑服务器）。内容 = `notes/*.md`。个人自用、无多用户；**同时部署到 `https://Xytheria-t.github.io/` 作个人只读镜像**（公开仓库，URL 不主动外传 = 事实隐私）。
- `mermaid` 外置 `vendor/mermaid.min.js` 懒加载（不内联/CDN）；`marked`/`highlight.js` 仅构建期依赖。
- 必保 feature（改 `reader.html` 不得误删）：`#spine` 迷你地图、`#companion` 章节胶囊、`[[双链]]` hover 预览、```gantt 渲染、mermaid 折叠懒渲染、代码行号、**鼠标侧键前进/后退**、锚点 `#slug`。已断言化：`.build/verify-features.mjs`（设计刻意变更时先改断言再改实现）。
- **导航模型（单一驱动源 = 浏览器历史）**：`go()` 用 `pushState({slug, vi:idx})` 入历史；侧键/浏览器前后退按钮交给原生导航；Vinea **只监听 `popstate` 渲染**，靠 `e.state.vi` 精确定位栈下标。Vinea 内部 `hist[]` 是浏览器历史的镜像。细节与 4 个坑见 PITFALLS·导航。
- 侧键**不接管**（`mousedown` handler 已删）：`preventDefault()` 对 X1/X2 拦截不可靠，接管会导致一次按键退两级。代价：退到历史栈底时浏览器会切标签（正常浏览器行为）。
- Vinea 是写笔记的工具，不进简历。简历第一个真实项目是 **EasyOrange**（后端，缓存与 DB 一致性是核心难点）。

## 构建铁律
- ⚠️ 绝不手改 `reader.html`（build 产物，跑 `build.mjs` 由 `.build/tpl/` 模块按清单拼接覆盖，手改必丢）。改样式/交互只动 `.build/tpl/` 对应模块（按热区切分，**模块头注释 = 该模块铁律，动手前先读**）；新增模块必须登记 `build.mjs` 的 `TPL_MANIFEST`；改完必 `node .build/build.mjs` 重生成 `reader.html`。（详见 PITFALLS）
- 改内容 → `notes/*.md`；改样式/交互 → `.build/tpl/`；重建 → `node .build/build.mjs` → `reader.html`。全由 AI 跑，用户不碰命令行、不建 `.bat`。
- 预览面板读产物 `reader.html`，不直接读 `notes/*.md`；改笔记后必重跑 build，预览才刷新（漏跑表现「改了没生效」，非缓存）。
- 免手动重编：`node .build/watch.mjs`（监听 `notes/*.md` → 200ms 防抖重编，重编后自动跑 `verify.mjs` 全套校验；watch 不碰 git，commit 由 AI 会话手动做）。
- `tpl/` 目录每个模块都是已 cook 的纯文件：正则直接写 `\s` 不写 `\\s`；NOTES/ROOT_ID 注入点只在 `40-js-core.js`（占位符字面量别出现在任何注释里，会抢占 replace 第一处命中——build 有断言拦截）。`.build/mermaid.min.js` → 复制到 `vendor/`。
- 构建不碰 git（原「构建后自动 commit」已关闭，build.mjs 只产出 `reader.html`）。
- 校验入口就一个：`node .build/verify.mjs`（串起 check + features + groups + mastery + spans + health，任一失败整体非 0）。`verify-features` 断言必保 feature/导航模型/CSS 铁律/xilu 清零（JS 断言跑在剥注释的 tpl 模块拼接上，防注释关键词假阳）；`verify-groups` 拦「新领域忘登记 GROUP」并断言卷版式/顺序/待垦；`verify-spans` 对全部 MOC 墙数 `.ventry`（= links 数且无 folio）。

## 内容结构 & 命名
- 两类，由 frontmatter `type` 决定（缺省 note）：
  - **MOC**（`type: moc`）= 内容地图。正文 = 一句定位 + `- [[子卡片]]` 列表；可层层下钻，`MOC.md` 为 root。
  - **原子笔记**（note）= 一个概念一篇，标题是具体术语。正文首行 H1 构建时丢弃（取 `title`）。
- 关系只由正文 `[[双链]]` 表达，build 抽 `links` 生成 MOC 墙。无反向链接。MOC 正文段落不放双链（会以死文本显示在卡片上）；bullet 列表是双链唯一合法位置。
- `title` = 显示名 + slug 源（`slug = slugify(title)`）；`aliases: [旧名]` 兼容旧双链；重名 build 打 ⚠，双链只命中最后一篇 → 改名消歧。
- 标题 = 具体术语，禁抽象后缀：体系/核心/原理/机制/进阶/指南/总结/详解/全景/综述/剖析/专题/那些事。
- MOC 标题 = 聚合的具体主题（≤3 个用「与/、」连），不新造上层概念。
- 核心笔记排第一：MOC frontmatter `featured: 子笔记` 锁定同名核心（如 `线程池`↔`ThreadPoolExecutor`），文件名用英文/类名，`[[双链]]` 列表第一位；其余按主题逻辑序。
- **笔记分拆铁律**：拆出来的子卡片**一律不进任何 MOC 墙**——既不在原笔记所在卷 MOC 出现，也不新造 MOC 收容；只在原笔记正文用 `[[双链]]` 链过去，让用户从原文跟进去。MOC 墙只承担「领域入口」，不充当「拆分收纳」。
- 笔记分拆阈值：原笔记偏重（含独立专题、对比表、时间线等）才拆出独立子卡片；分量轻的扩展**只在新笔记正文用 `[[双链]]` 链回**，不建 MOC。判断标准 ≈ 占原笔记 1/3 篇幅或可独立成「对比/选型/演进」主题。

## 写笔记规范
- 先加载项目级技能 `atomic-note-template`（基准：原子笔记 `notes/ThreadPoolExecutor.md`，MOC `notes/线程池.md`）。
- 结构化优先、少散文：表格/callout/chain/mermaid 说清的不写段落；尽量少用列表（最后兜底）。
- callout 不做小字密文墙：标题给结论，正文拆成 ≤3 条 bullet 或 compact 表格；连续散文超过 2 行必须改为结构化。
- 禁「## 1. 2. 3.」编号标题；H2 用描述性标题。禁用泛化「## 详节」占位标题，深入/落地节按内容落点命名（如 `## 落地：构造示例`、`## 派生命题问答`）。
- 新名词/缩写（SYN、seq、MSL、RTO 这类）首次出现必须随文解释：表格行或一句括注，不默认读者认识。

## 首页分卷（杂志版式）
- 根墙 = 纯审美封面（`.cover`：大字标题 + 定位句 + 卷名索引，点击滚动到卷带；不放动态数据）+ 各卷目录带（`.band band--{layout}`）。
- 卷索引 = 斜切色带（`.cm-rail` + `.cm-tile` 咬合，段数 = 卷数，`.cm-caption` 卷名随 hover/聚焦切换，左短规取当前卷色）。一段一卷色，走 `ACCENT` 高饱和，用色方式与 `.ventry` 同源（淡底+实色顶标+深墨字），不铺纯色块。
- 分区表 = `build.mjs` 的 `GROUP`：数组序 = 卷序，`cats` 序 = 卷内位次，`layout` = 卷版式（4 种：`tiles` 磁贴墙 / `spread` 对开页 / `feature` 大标页 / `index` 索引列表；缺省 tiles）。新增领域 → 对应卷 `cats` 加项；新增卷 → 加一组。
- 卷内条目 `.ventry`（一套 DOM，版式差异走 CSS）：catLabel + MOC 标题 + 「N 篇 · 更新于 X」角标，点击直达。hover 展开最近 3 篇预览已删（用户不要）；保留的轻微交互 = hover 左竖规延展 + 指针跟随光晕（`--mx/--my` 由 FINE_HOVER 段 stage pointermove 更新，换卡/离场复位居中）+ 上浮。
- 子墙（非根 MOC）= 轻量扉页（`.subhead`）+ `.ventry` 网格（`.subwall`，按「子地图/笔记」分两区），整页继承父卷色。
- 待垦态 = MOC 任何深度无后代笔记 → `.ventry.fallow`（虚线边 + 虚线竖规 + 「待垦」印章）。
- 改完跑 `build.mjs` + `verify.mjs`（一键全套，见构建铁律）。`verify-spans` 对全部 MOC 墙数 `.ventry`（= links 数且无 folio）。

## 设计铁律
- 配色 = 鲜艳高饱和（`build.mjs` 的 `ACCENT`/`ACCENT_INK`，色相分离+高饱和，相邻卷色相拉开：翠绿/亮橙/亮蓝/金黄/玫红）。禁止擅自往莫兰迪/低饱和调（见 PITFALLS·设计主权）。
- 浓墨重彩 + 单主题（无暗色模式，不搞双主题切换）。禁用：渐变文字、emoji 当图标。
- 允许：分区标题、≤3px 强调线（卡片左侧竖规、卷首罗马数字）。
- 卡片/条目 = 1px 发丝边 + 左侧 2px 渐变竖规 + 悬停 sheen，无 3D tilt。
- callout = 标签 + 圆点 + 1px 彩边，就近散布不堆块。
- 暖纸白、衬线正文、纸纹噪点（噪点 + 28px 细方格双层，见 `body::before/::after`）；动画守 `prefers-reduced-motion`。
- 装饰字号 ≤ 副标（≤24px），别用单字大字占位；背景装饰要么小字、要么 SVG `<pattern>` 平铺。中文语境慎用西方版式术语（`Folio`/`Vol.`/`Opus`）作装饰。
- 首页 + 子墙已杂志化（封面/扉页 + 目录带/网格），正文页仍是暖纸白手稿 folio 风。

## 习录（Time）
- 习录已迁出 Vinea 仓库，独立存放在 `D:\Tool\Time\time.html`。tpl 模块不再含 `#xiluOpen` / `#xiluWrap` / iframe 习录入口（Vinea 主页是纯阅读器，不再有习录按钮）。
- 改 tpl 时勿再加回 xilu 相关代码（搜 `xilu|study\.html|xiluOpen|xiluWrap|xiluFrame|xiluEsc` 应为零结果）；想恢复时再讨论。
- `D:\Tool\Time\time.html` 跟 Vinea 数据不互通（localStorage 按 origin 隔离）；原 `study.html` 的数据**不迁移**——它已经独立成另一工具。
- 习录调色：**延后**。等用户主动说「改 time.html」再做。
- 习录仍归 Vinea 同源 tokens（暖纸/衬线/噪点+方格/accent 金），但当前是单独维护的 HTML 工具，不入任何 Vinea 文件。

## 公网部署（GitHub Pages）
- 仓库：`Xytheria-t/Xytheria-t.github.io`（公开，Personal Site 仓库）
- 触发：`push` 到 `master`（兼容 `main`）改动 `notes/**`、`.build/**`、`.github/workflows/deploy.yml` 时跑 `.github/workflows/deploy.yml`
- Workflow：Actions checkout → setup-node 22 + npm cache → `npm ci --prefix .build` → `node .build/build.mjs` → `node .build/check.mjs && node .build/verify-groups.mjs` → 准备 `_deploy/`（含 `cp reader.html _deploy/index.html`）→ `peaceiris/actions-gh-pages@v4` 强推 `gh-pages` 分支
- Pages 配置：Source = `gh-pages` branch / root
- 关键坑（详见 PITFALLS·部署）：
  - GitHub Pages 用户站根 URL 只认 `index.html`，必须 `cp reader.html index.html`（部署产物里**两份**都要有）
  - 仓库的 `default_workflow_permissions` 默是 `read`，要先 `gh api -X PUT repos/Xytheria-t/Xytheria-t.github.io/actions/permissions/workflow -f default_workflow_permissions=write`（或者 workflow 里 `permissions: contents: write` + 仓库设置改 write）——否则 `peaceiris/actions-gh-pages@v4` 推 gh-pages 时 403
- 本地 dev 不变（双击 `reader.html` 仍能看）；线上 URL：`https://Xytheria-t.github.io/`
- 仓库物理：入版本库 = `notes/` 全量、`.build/`（build.mjs、check.mjs、verify-*.mjs、watch.mjs、verify.mjs、package.json、package-lock.json、`tpl/` 模块目录、mermaid.min.js）、`.github/workflows/deploy.yml`、`.gitignore`。不入仓：`.workbuddy/`、`.impeccable/`、`PITFALLS.md`、`study.html`（已迁出）、`reader.html`（build 产物）、`vendor/`（build 时生成）、`node_modules/`、`_deploy/`。
