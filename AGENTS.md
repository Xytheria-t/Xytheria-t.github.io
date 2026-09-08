# Vinea 项目记忆（notes 复习库）

> 离线卡片式阅读器：根 `Vinea.html` + 同目录 `vendor/`，双击即开、不跑服务器；内容 = `notes/*.md`，考点基准 = 一线大厂 Java 后端实习面试高频考点。同时部署到 `https://Xytheria-t.github.io/` 作只读镜像（URL 不主动外传）。Vinea 是写笔记的工具，不进简历。
> 项目技能在 `.agents/skills/`（未出现在可调用 skill 列表时，按路径直读其 `SKILL.md`）：写/改/体检笔记、全库审查 → `note-checkup/`（含骨架与组件语法基准、四域审查分域、已裁决口径）。动 `.build/` 前先读 `PITFALLS.md`。通用写作规则见用户级记忆「写作与呈现」（ZCode 会话已自动加载）。

## 结构规约（内容级规则由 `node .build/vinea_check.mjs` 机械校验，其余写时保证）

- 笔记两类由 frontmatter `type` 决定（缺省 note）：**MOC**（`type: moc`）正文 = 一句定位 + 子笔记 `[[双链]]` bullet 列表，双链只准写 bullet（散文段落放双链会让 verify-spans 的 `.ventry` 数对不上 `links` 数）；**原子笔记** = 一个概念一篇，正文首块是 chain 速查块（每行 `标题 | 副标题 | 角标`，4-5 节点封顶；微型/线性笔记可省），小节按因果推进（为什么 → 是什么 → 推论 → 复盘）。
- frontmatter 必填 `title / category`；`aliases` 可选（兼容旧双链）。title 重复 build 打 ⚠ 且双链只命中最后一篇 → 改名消歧。
- 标题 = 具体术语，禁抽象后缀（体系/核心/原理/机制/进阶/指南/总结/详解/全景/综述/剖析/专题）；MOC 标题 = 聚合的具体主题（≤3 个用「与/、」连），不新造上层概念。
- MOC 可用 `featured: <核心子笔记>` 锁核心入口置顶；没有核心入口就别写。
- 分拆铁律：从偏重笔记（≈占原篇 1/3 篇幅，或可独立成对比/选型/演进主题）拆出的子卡片一律不进任何 MOC 墙，只在原笔记正文 `[[双链]]` 链过去——MOC 墙只做领域入口，不做拆分收纳。
- 新笔记必须挂进对应 MOC（否则孤儿）；正文用到的概念要么 `[[双链]]` 要么随文一句话解释，否则断链；跨笔记重复收敛为双链指向主笔，缺口才由新篇补。笔记是复习材料：裸术语与抽象断言复习时想不起来，一律先解释再用。
- 面试问答、常见误区用 `<details>` 折叠收纳；callout 分工：`[!note]` 边界澄清、`[!tip]` 关联实用、`[!warning]` 易错点，紧贴它注解的内容放置，不甩到节末。
- 给 MOC 加分组/chip 三处同步：MOC 正文双链、`.build/tpl/42-js-wall.js` 的 `MOC_FACETS[slug].groups[].ids`、`traits` chip 文案。

## 构建与校验

- `Vinea.html` 只由 `node .build/build.mjs` 生成（按 `TPL_MANIFEST` 清单拼接 `.build/tpl/` 模块），绝不手改。改内容 → `notes/*.md`；改版式/交互 → `.build/tpl/`（新模块必须登记清单；模块头注释 = 该模块铁律，动手前先读）。构建不碰 git。
- 必保 feature（spine 迷你地图、companion 章节胶囊、双链 hover 预览、gantt 渲染、mermaid 折叠懒渲染、代码行号、鼠标侧键导航、锚点）与导航模型（单一驱动源 = 浏览器历史）已断言化进 `verify-features`；设计刻意变更时先改断言再改实现。
- 改笔记后必重跑 build（预览面板读产物，漏跑表现「改了没生效」）；常改可挂 `node .build/watch.mjs`（自动重编 + verify）。
- 提交硬约束：`.githooks/pre-commit`（`core.hooksPath=.githooks`）会跑 build + `verify.mjs`，任一失败即拒绝提交；绕过它就等于把构建/校验责任又交回给记忆。产物 `Vinea.html`/`vendor/` 被 `.gitignore` 排除不入库，所以钩子卡的是「源可构建 + 校验全绿」，不是产物 diff。
- 写/改 notes 后必跑 `node .build/verify.mjs` 全绿才算完成（语法冒烟、DOM 固定件、孤儿/可达性、mastery、spans、features、groups）；内容级机械校验 `node .build/vinea_check.mjs`（死链/fence/chain 栏数/summary 重名等）。

## 部署与边界

- 公网镜像：push `master` 触发 `.github/workflows/deploy.yml` 构建并强推 `gh-pages`；部署坑见 PITFALLS·部署。
- 习录已迁出为独立工具 `D:\Tool\Time\time.html`（数据与 Vinea 不互通），tpl 勿再加回 xilu 代码（verify-features 断言清零）；想恢复先讨论。
- 改版式/配色的设计边界：配色主权、单主题无暗色、禁渐变文字/emoji 图标、装饰字号 ≤ 副标、动画守 `prefers-reduced-motion`；细化坑见 PITFALLS·设计主权。
