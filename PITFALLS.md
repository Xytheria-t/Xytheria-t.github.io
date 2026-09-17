# PITFALLS

> 给 AI 看。动 `.build/` 下任何文件前先读本文件。
> 格式：触发 → 症状 → 修法，每条只记一个坑；已在 AGENTS.md 立成规约的不在此重复。

## 可复用通则
- 配色/交互语义属用户主权：别拿「克制/高级感/统一」当理由自作主张改（把 ACCENT 莫兰迪化、把 hover 展开改成常驻展开都算）；觉得不协调先问。
- 同类元素行为必须跨版式一致；修留白改布局，别改交互语义。
- 多层 UI 上同一按键都有语义时，上层必须显式判定并 return，不能靠注册顺序。
- 任何 `position:fixed` 浮层两个方向都要夹（横向 clamp 完别忘纵向）。
- `space-between` + ≥3 item 且只有首尾该贴边 → 中间 item 必须显式接管剩余空间（`flex:1` / `margin-left:auto`）。
- 覆盖带 `:hover`/`:focus-within` 的全局规则时，版式覆盖选择器必须把伪类一起写（否则特异性压不住）。
- `arr.map(fn)` 而 `fn` 第二参数语义不是 index → 调用处显式丢弃下标，按 type 兜底别按 truthiness。
- 降级为原始源码/占位的渲染分支必须做显性标记（`.mm-err` 角标），别只 `console.warn`。
- 验 CSS 必须 re.search 整个 `Vinea.html`；`_harness` 的 `script` 只切 `<script>` 段，匹配不到样式。
- `display:none`（CSS 初始态）+ JS 用 `style.display=''` 显示 → 内联一空样式表立刻接管，块永远空白。显示侧给具体值（`block`/`flex`）。
- localStorage 结构校验只查必备结构，nullable 状态字段单独类型收编，别当必填判死。

## 构建管线
- 手改 `Vinea.html`（build 产物）→ 重跑 build 被 `tpl/` 清单拼接覆盖，表现「改了没生效」。只动 `.build/tpl/` 模块，改完必重跑 build。
- 模板注释里写占位符字面量 → `String.replace` 只换第一处，注释抢占注入、真实占位符留在产物里 → `check.mjs` vm SyntaxError。注释别写占位符字面量；build 注入后有「仍含占位符即炸」的兜底断言。
- `tpl/` 新增模块忘登记 `TPL_MANIFEST` → 文件存在但不参与拼装，静默丢代码。
- 模块拆分/抽离时 `\\s` 漏 cook 成 `\s` → 产物正则全废。回归判据：产物与旧版 `cmp` 逐字节相同。
- mermaid 预处理注入（`direction`/`title`）插到首行图类型声明之前 → `detectType` 失灵全站挂。注入点固定在该行之后。
- mermaid `classDiagram` 默认 TB + 节点少 → 飞上去/大留白。init 加 `useMaxWidth/nodeSpacing/rankSpacing`，并对无 `direction` 的 classDiagram 自动注入 `LR`。
- `wallHTML` 改完只跑 `check.mjs` → 它不调 `wallHTML`，布局错也 RAN OK。验渲染须 vm 跑 `wallHTML(NOTES[...])` 取串做断言。
- 给 `MOC_FACETS` 子 MOC 加子卡只改正文 `[[双链]]` → facet 墙按白名单静默丢未登记 id。三处同步：正文双链 + `ids` + `traits`。
- 加新 category/领域忘改 `build.mjs` 的 `GROUP` → 落到末尾「其他」卷且 `verify-groups` FAIL。`GROUP` 是根墙卷序/卷内序唯一来源（`MOC.md` links 序对根墙无效）。
- 卷外常驻的域（`clip` / 随问随记）别登记 `GROUP`、别写进 `MOC.md` 双链：只走壳层右上角 `#clipDock`。`build.mjs` 从 `30-tail.html` 现读按钮目标标 `dock`，`verify-groups` 反查它不落任何卷，`verify-health` 据此豁免孤儿/可达（按钮没了或指向改了 → 这两条断言直接红）。
- 速记（`clip: true`）回挂学科 MOC → 八股墙被速记卡片污染（用户已明确否掉）。速记只挂收件箱 `随问随记`；撤卡片要三处同步（正文双链 + `groups[].ids` + `traits`），只删正文会留死配置。
- `verify-mastery` 写死笔记 id → 结构一变假 FAIL。现动态推导路径，找不到记 `skip` 不 FAIL。
- `41-js-mastery.js` MOC 卡熟练度聚合整棵子树、flatten 穿透多层 MOC 是有意的 → 别当 bug「优化」掉；子卡染色走 `--mc` 覆盖 `--c`。
- verify 用全局选择器计数 → 同组件多区域翻倍假 FAIL。断言限定到具体容器。
- verify 断言「已被刻意移除」的 UI → 与实现冲突。先分清「实现漏了」还是「设计改了」，属后者改断言。

## CSS / 渲染
- 浮层 `#pop` 只水平夹取漏垂直 → 文末双链预览落到视口外「hover 没反应」。设 top 前读 `offsetHeight`，塞不下翻上方。
- `figure.code` 加 `overflow:hidden` → 变滚动容器，页眉 sticky 失效。圆角靠 head/body/foot 各自声明。
- `spread` 常驻展开时 `.band--spread .v-preview{max-height:none}` 特异性 (0,2,0) 低于 `.ventry:hover` (0,3,0) → hover 反而收起。覆盖时把 `:hover` 一起写。
- `chain` trigger pill 塞进 `link` 容器 `position:absolute` → 挤成单字竖排。pill 是 step 环节标签，放 `.chain-t` inline，删 link 里的 pill/spacer。
- 行号 `.ln{display:flex}` 吞前导缩进/词间空格（Chromium 丢 whitespace-only 匿名 flex item）→ 改 `display:block` + `code{white-space:pre}`，`::before` 换 `inline-block`。回归：`getComputedStyle(ln).display==='block'` 且 textContent 含完整 `public class X`。
- hljs 多行 token（yaml 块标量 `|`/`>`、Java text block、bash heredoc）把 `<span>` 开到 `\n` 之后才关 → `highlightBlock` 按 `\n` 切行后 `.ln` 互相嵌套、行尾多孤儿 `</span>`（行号断成两截、代码逃出行面板）。修法 `splitLinesBalanced`：每个 `\n` 处补关全部未闭合 span、下一行原样重开；断言在 `verify-code.mjs`。
- `clip-path` 裁掉向外扩的 `outline`/`box-shadow` → focus ring 看不见，焦点环改 `inset` box-shadow 或交父元素画。斜切条无缝咬合用 `margin-right:-X` + `polygon`，首尾段单独直角收口，单段 `:only-child{clip-path:none}`。

## 交互 / 行为
- file:// 下 JS 拉起 Explorer 选中 .md 被沙箱禁（`explorer /select` 不可达）→ 静态方案 `window.open(file://…md)` + 复制绝对路径 + toast；真定位需原生桥，与「双击即开」冲突，默认不做。

## AI 工作流
- 并行发两个 Edit 改同文件 → 一个 Success 未落地。同文件多笔修改串行，改完 grep/Read 抽查关键标记再跑测试。
- `git rm <多文件>` 在 Windows + Git Bash + 中文路径下行为异常：把整个目录里所有文件标记为删除（连工作树也清），commit 失败留 lock。删 `notes/*.md` 用 `rm` + `git add -u <path>`，绝不 `git rm` 整个目录。
- 工作区带上一会话未提交的 tpl 改动时整文件 `git add` → 把在途工作混进自己的提交。修法：`git diff <file>` 逐 hunk 分清归属，只把自己的 hunk 过滤成 patch 后 `git apply --cached` 单独暂存（awk 按 `^@@` 计数挑 hunk），他人改动原样留工作区。
- `new URL(file,location.href).pathname` 当「给人看的路径」复制 → 中文/空格 percent-encode 乱码。修法 `decodeURIComponent(u.pathname).replace(/^\//,'')` + try/catch 兜畸形百分号（`100%.md` 抛 URIError 退回原值）。
- 改 tpl 的 JS 用到浏览器全局（`clearTimeout`/`requestAnimationFrame`/`IntersectionObserver`）→ `check.mjs`/`verify-*` 报 `X is not defined`（vm 沙箱只 stub 部分全局）。缺哪个在 `_harness` 的 `win`/`ctx` 补哪个，别为过测试删代码。

## 部署（GitHub Pages）
- 仓库 `Xytheria-t/Xytheria-t.github.io`（公开用户站）→ Actions 跑 build → 推 `gh-pages` → Pages serve。`default_workflow_permissions` 默认 `read` → `peaceiris/actions-gh-pages@v4` 报 403 `denied to github-actions[bot]`。修法：Settings → Actions → General 改 **Read and write**，或 `gh api -X PUT repos/Xytheria-t/Xytheria-t.github.io/actions/permissions/workflow -f default_workflow_permissions=write`；workflow 里也要写 `permissions: contents: write`。
- 用户站根 URL 只认 `index.html`，不认 `Vinea.html` → 部署产物必须 `cp Vinea.html _deploy/index.html`，否则首页 404。
- `on.push.paths` 与 `workflow_dispatch` 在 `on:` 下互斥 → 同时写 GitHub 拒跑（`workflow file issue`、jobs 空）。二选一。
- workflow 文件 LF/CRLF 都行但 **BOM（U+FEFF）不行**（Write 工具偶尔带 BOM，`head -1 | xxd` 校验）；`run: |` 块内每行缩进必须 ≥ block 起始缩进，否则 YAML 把后续行当 step body。
- 本机到 `github.com:443` 可能被阻断（`git push` 报 `Recv failure: Connection was reset` 或连接超时）。判据：`curl -m 15 https://github.com` 超时、`api.github.com` 返 200、`ssh -T git@github.com` 报 `publickey`——即 443 断、API 与 SSH 通。修法（`gh` 有 `repo` 权限时）：临时注册写权限部署密钥走 SSH 推，推完即删：
  ```bash
  KEY=~/.ssh/vinea_tmp_push; ssh-keygen -t ed25519 -f "$KEY" -N "" -q
  KID=$(gh api -X POST repos/Xytheria-t/Xytheria-t.github.io/keys -f title=temp-push \
    -f key="$(cat "$KEY.pub")" -F read_only=false --jq .id)
  GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes" \
    git -c url."git@github.com:".insteadOf="https://github.com/" push origin master
  gh api -X DELETE repos/Xytheria-t/Xytheria-t.github.io/keys/$KID; rm -f "$KEY" "$KEY.pub"
  ```
  用 `insteadOf` 重写而非新加 remote（否则 `refs/remotes/origin/master` 不更新）；Git Bash 下 `gh api` 端点省略前导斜杠。

## 导航 / 浏览器历史栈
> 模型见「单一驱动源」那条。

- **单一驱动源 = 浏览器历史**：`go()` 只 `pushState`，侧键/浏览器按钮交给原生导航，Vinea 只监听 `popstate` 渲染。**别在 `mousedown` 里既 `preventDefault()` 又自己 `history.back()`**。
- 鼠标侧键（`button` 3/4）的 `mousedown` + `preventDefault()` 拦截不可靠（浏览器/鼠标驱动差异）→ 没拦住时 JS 退一级 + 原生再退一级 = 一次按键退两级。修法：删掉侧键 handler，交给浏览器原生。
- 全站只用 `replaceState` → 历史栈恒为 1 条 → 侧键后退退化成「切标签页」（浏览器 UI 层行为，JS 拦不住）。要侧键可用必须 `pushState`，代价是历史被站内导航填满。
- `popstate` 定位不能靠 `hist.indexOf(slug)`：同一篇被重复访问时只命中第一次出现，后退像「直回主页」。修法：入历史时把栈下标写进 state（`pushState({slug, vi:idx})`），`popstate` 优先用 `e.state.vi`，缺失/越界/与 slug 不符才退化 `indexOf`。
- `replaceState(null, …)` 会清掉 history state → 后续 `popstate` 拿不到 `slug`/`vi`，退化读 hash（锚点 id 在 `NOTES` 查无此页 → 静默不渲染）。只改 URL 时用 `replaceState(history.state, '', url)`。
- 加事件 handler 前先 grep 是否已存在（`mousedown`/`keydown`/同名函数）——「以为没绑所以加一份」= 一次事件触发两次；删 handler 前同理，先数清楚有几份。
