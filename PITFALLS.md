# PITFALLS

> 给 AI 看。动 `.build/` 下任何文件前先读本文件。
> 格式：触发 → 症状 → 修法。每条只记一个坑。

## 可复用通则
- 配色/交互语义属用户主权：别拿「克制/高级感/统一」当理由自作主张改；觉得不协调先问。
- 同类元素行为必须跨版式一致；修留白改布局，别改交互语义。
- 多层 UI 上同一按键都有语义时，上层必须显式判定并 return，不能靠注册顺序。
- 任何 `position:fixed` 浮层两个方向都要夹（横向 clamp 完别忘纵向）。
- `space-between` + ≥3 item 且只有首尾该贴边 → 中间 item 必须显式接管剩余空间（`flex:1` / `margin-left:auto`）。
- 覆盖带 `:hover`/`:focus-within` 的全局规则时，版式覆盖选择器必须把伪类一起写（否则特异性压不住）。
- `arr.map(fn)` 而 `fn` 第二参数语义不是 index → 调用处显式丢弃下标，按 type 兜底别按 truthiness。
- 往 mermaid 源码预处理注入（`direction`/`title`）不能抢在首行图类型声明之前。
- 降级为原始源码/占位的渲染分支必须做显性标记（如 `.mm-err` 角标），别只 `console.warn`。
- 验 CSS 必须 re.search 整个 `reader.html`；`_harness` 的 `script` 只切 `<script>` 段，匹配不到样式。
- `display:none`（CSS 初始态）+ JS 用 `style.display=''` 显示 → 内联一空样式表立刻接管，块永远空白。显示侧给具体值（`block`/`flex`）。
- localStorage 结构校验只查必备结构，nullable 状态字段单独类型收编，别当必填判死。

## 构建管线
- 手改 `reader.html`（build 产物）→ 跑 `build.mjs` 被 `.build/tpl/` 清单拼接覆盖，表现「改了没生效」。只动 `.build/tpl/` 模块，改完必重跑 build。
- 模板注释里写占位符字面量 → `String.replace` 只换第一处，注释抢占注入，真实占位符留在产物里 → check.mjs vm 直接 SyntaxError（「NOTES 字面量未找到」）。修法：注释别写占位符字面量；build.mjs 注入后有兜底断言（仍含占位符 → 炸构建）。
- `tpl/` 新增模块文件忘登记 `TPL_MANIFEST` → 文件存在但不参与拼装，静默丢代码。修法：加文件必须同步 build.mjs 清单。
- 模块拆分/抽离时 `\\s` 漏 cook 成 `\s` → 产物正则全废。回归判据 = 产物与旧版 `cmp` 逐字节相同。
- mermaid `classDiagram` 默认 TB + 节点少 → 飞上去/大留白；给 init 加 `useMaxWidth/nodeSpacing/rankSpacing` 并对无 `direction` 的 classDiagram 自动注入 `direction LR`（插在声明行之后）。
- mermaid `direction` 注入插到声明行【之前】→ `detectType` 失灵全站挂。注入点换到首行 `\\n` 之后。
- `wallHTML` 改完只跑 `check.mjs` → 它不调 `wallHTML`，布局错也 RAN OK。验渲染须 vm 跑 `wallHTML(NOTES[...])` 取串做断言。
- `_harness` 的 `script` 只切 script 段 → 验 CSS 规则假 FAIL。验样式 re.search 整个 html（见通则）。
- 给 `MOC_FACETS` 子 MOC（`java-锁`）加子卡片只改 MOC 正文 `[[双链]]` 不够 → facet 墙按白名单静默丢未登记 id。三处同步：正文双链 + `ids` + `traits`。
- `verify-mastery` 写死笔记 id → 结构一变假 FAIL。现动态推导路径，找不到记 `skip` 不 FAIL。
- verify 用全局选择器计数 → 同组件多区域翻倍假 FAIL。断言限定到具体容器。
- verify 断言「已被刻意移除」的 UI → 与实现冲突。先分清「实现漏了」还是「设计改了」，属后者改断言。

## CSS / 渲染
- 浮层 `#pop` 只水平夹取漏垂直 → 文末双链预览落到视口外「hover 没反应」。设 top 前读 `offsetHeight`，塞不下翻上方（见通则·两方向夹）。
- `figure.code` 加 `overflow:hidden` → 变滚动容器，页眉 sticky 失效。圆角靠 head/body/foot 各自声明。
- `.subhead` `space-between` + 三 item → 中间大标题被推到页面正中（见通则）。
- CSS `display:none` 初始态 + JS `style.display=''` 显示 → 块空白（见通则）。
- `spread` 常驻展开时 `.band--spread .v-preview{max-height:none}` 特异性 (0,2,0) 低于 `.ventry:hover` (0,3,0) → hover 反而收起。覆盖选择器把 `:hover` 一起写（见通则）。
- `chain` trigger pill 塞进 `link` 容器 `position:absolute` → pill 挤成单字竖排。pill 属 step 环节标签，放 `.chain-t` inline，删 link 里的 pill/spacer。
- 行号 `.ln{display:flex}` 吞前导缩进/词间空格（Chromium 丢 whitespace-only 匿名 flex item）。改 `display:block` + `code{white-space:pre}`；`::before` 换 `inline-block`。回归：抓 `getComputedStyle(ln).display==='block'` 且 textContent 含完整 `public class X`。
- `clip-path` 裁掉向外扩的 `outline`/`box-shadow`（focus ring 看不见）→ 焦点环改 `inset` box-shadow，或交父元素画。斜切条无缝咬合用 `margin-right:-X` + `polygon`，首尾段单独直角收口，单段 `:only-child{clip-path:none}`。

## 设计主权
- 擅自改 `ACCENT` 饱和度/色相（如莫兰迪化）→ 配色属用户主权，先问别自作主张。
- 改同类元素交互语义（如 hover 展开→常驻展开）→ 同类元素行为跨版式必须一致；修留白改布局别改交互（见通则）。

## 交互 / 行为
- 顶层 `keydown` Esc 与习录覆盖层 Esc 各注册一份 → 焦点回顶层一次 Esc 干两件事（先 back 再关习录）。顶层 Esc 先判 `xiluEscOpen()` 展开就 return（见通则·多层 UI）。
- file:// 下 JS 拉起 Explorer 选中 .md 被沙箱禁（`explorer /select` 不可达）→ 静态方案 `window.open(file://…md)` + 复制绝对路径 + toast；真定位需原生桥，与「双击即开」冲突默认不做。

## 数据 / 存档
- 习录 `load()` 用 `!s.active` 判坏数据，而收工后 `active` 为 null（最常见落盘态）→ 一收工重开就 `fresh()` 重置整库。结构校验只查 `subs`/`days`，nullable 字段单独收编；JSON.parse 失败先 `.corrupt` 备份再重建。

## AI 工作流
- 并行发两个 Edit 改同文件 → 一个 Success 未落地。同文件多笔修改串行，改完 grep/Read 抽查关键标记再跑测试。
- `git rm <多文件>` 在 Windows + Git Bash + 中文路径下行为异常：会把整个目录里所有文件标记为删除（连工作树文件也清掉），commit 失败留 lock。删 `notes/*.md` 用 `rm` + `git add -u <path>`，明确指定文件、绝不让 `git rm` 处理整个目录。
- 工作区带上一会话未提交的 tpl 改动时整文件 `git add` → 把在途工作混进自己的提交。修法：`git diff <file>` 逐 hunk 分清归属，只把自己的 hunk 过滤成 patch 后 `git apply --cached` 单独暂存（awk 按 `^@@` 计数挑 hunk），他人改动原样留工作区不碰、不代提交。
- `new URL(file,location.href).pathname` 当「给人看的路径」复制 → 中文/空格 percent-encode，复制出来乱码。修法 `decodeURIComponent(u.pathname).replace(/^\//,'')` + try/catch 兜畸形百分号（`100%.md` 抛 URIError 退回原值）。
- 改 tpl 的 JS 用到浏览器全局（`clearTimeout`/`requestAnimationFrame`/`IntersectionObserver`）→ `check.mjs`/`verify-*` 报 `X is not defined`（vm 沙箱只 stub 部分全局）。缺哪个在 `_harness` 的 `win`/`ctx` 补哪个，别为过测试删代码。
- 渲染失败只 `console.warn` 无可见痕迹 → 用户看到 `.mermaid:not(:has(svg))` 等宽源码，当「加载慢」反复刷新。失败路径加 `.mm-err` 角标（见通则·降级标记）。

## 部署（GitHub Pages）
- 仓库 `Xytheria-t/Xytheria-t.github.io`（公开用户站）→ Actions 跑 build → 推 `gh-pages` 分支 → Pages 切 `gh-pages`/root serve。仓库的 `default_workflow_permissions` 默认 `read` → `peaceiris/actions-gh-pages@v4` 推 `gh-pages` 时报 `Permission to ... denied to github-actions[bot]` + 403。**修法**：仓库 Settings → Actions → General → Workflow permissions 改 **Read and write permissions**，或 `gh api -X PUT repos/Xytheria-t/Xytheria-t.github.io/actions/permissions/workflow -f default_workflow_permissions=write`。`permissions: contents: write` 在 workflow 文件里也要写。
- GitHub Pages 用户站（`username.github.io`）根 URL 只认 `index.html`，不认 `reader.html` → 部署产物必须 `cp reader.html _deploy/index.html` 一份，否则首页 404。
- workflow 用了 `on.push.paths` 过滤时**不能同时**用 `workflow_dispatch`（paths 跟 dispatch 在 `on:` 下互斥，YAML 静默接受但 GitHub 拒跑，状态显示 `workflow file issue`、jobs 空）。要么全 push、要么全 dispatch，二选一。
- workflow 文件本地写 `LF`，git 在 Windows 上常警告「will be replaced by CRLF」——CRLF 也行，但 **BOM (`﻿`, U+FEFF) 不行**。Write 工具产生文件偶尔会带 BOM，save 后 `head -1 | xxd` 校验。
- workflow `run:` 块里有中文注释/字符串完全 OK（UTF-8），但**多行 block `run: |` 后每行缩进必须 ≥block 起始缩进**，否则 GitHub Actions YAML parser 把它当 step body 而不是 block。

## 导航 / 浏览器历史栈
> 模型见「单一驱动源」那条。

- **单一驱动源 = 浏览器历史**。`go()` 用 `pushState`，侧键/浏览器按钮交给原生导航，Vinea 只监听 `popstate` 渲染。**绝不要在 `mousedown` 里既 `preventDefault()` 又自己调 `history.back()`** —— 见下条。
- 鼠标侧键（`button` 3/4）的 `mousedown` + `preventDefault()` **拦截不可靠**（浏览器/鼠标驱动差异）。没拦住时 = JS 退一级 + 浏览器原生再退一级 = **一次按键退两级**（现象：两次渲染间隔极短）。**修法**：删掉侧键 handler，交给浏览器原生。
- `popstate` 定位**不能靠 `hist.indexOf(slug)`** —— 同一篇被重复访问时（首页→A→B→经双链回 A），`indexOf` 只命中第一次出现的位置 → `idx` 跳到很早的页（现象：后退像「直回主页」）。**修法**：入历史时把栈下标写进 state（`pushState({slug, vi:idx})`），`popstate` 优先用 `e.state.vi`，缺失/越界/与 slug 不符才退化到 `indexOf`。
- 全站只用 `replaceState` 从不 `pushState` → 浏览器历史栈恒为 1 条 → 侧键后退没历史可退，**退化成「切标签页」**（浏览器 UI 层行为，JS 拦不住）。要侧键能用必须 `pushState`。代价：浏览器历史会被站内导航填满。
- 任何 `replaceState(null, …)` 会**清掉 history state**，导致后续 `popstate` 拿不到 `slug`/`vi` 而退化到读 hash（锚点 id 在 `NOTES` 里查无此页 → 静默不渲染）。**只改 URL 时用 `replaceState(history.state, '', url)` 保留 state**。
- 加事件 handler 前**先 grep 是否已存在**（`mousedown`/`keydown`/同名函数）——“以为没绑所以加一份”会造成一次事件触发两次（一次按键跳两页）。删多余 handler 时同理，先数清楚有几份。
