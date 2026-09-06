---
name: notes-review
description: 全库审查/批量体检 Vinea 笔记时加载。机械校验脚本 + 四域代理审查清单 + 修复后校验流程。审查维度：内容正确性 P0 优先，结构规范、组件使用、结构化优先次之。
description_zh: "Vinea 笔记全库审查：脚本 + 代理分工 + 校验闭环"
description_en: "Vinea notes review: script + agent split + verify loop"
allowed-tools: Read,Write,Edit,Grep,Glob,Bash,Agent
display_name: "笔记全库审查"
display_name_en: "notes-review"
visibility: "project"
---

# 笔记全库审查（Vinea reader 系统）

写新笔记用 `atomic-note-template`；全库体检/批量审查用本篇。

## 流程

1. **机械校验先行**（秒级、零误报）：`node D:/Work/Vinea/.spec/vinea_check.mjs`
   覆盖：P0 = frontmatter/title 缺失、fence 配对偶数、title 重复；P1 = 死链（**别名感知**，与 build 双链解析同口径）、H1==title、order 冲突、顶部结构、chain 栏数/节点数、编号与泛化（详节/总结/详解）H2、summary 占位/重名、callout 未配色；WARN = 出链稀疏（≤1，仅提示）。
   ⚠️ 改这个脚本时，所有按行匹配的正则必须容忍 `\r?\n`——notes 全是 CRLF，写死 `\n` 会静默失配（检查形同虚设还不报错）。
2. **人工审查走 4 个并行 Explore 代理**（只报告不修改），按域分：
   - Java 卷（javase/collection/juc/jvm 及子笔记）
   - 存储 + 网络 + 项目（mysql/redis/缓存系列/EasyOrange/HTTP·TCP·UDP）
   - 算法卷（leetcode MOC + Hot100 + 题解）
   - MOC 骨架与简历项目（MOC.md 根、各卷 MOC 定位句、projects 项目类笔记，重点查跨笔记口径互证）
   每个代理 prompt 里给：基准笔记路径（`notes/ThreadPoolExecutor.md` + `notes/线程池.md`）、审查维度、输出格式（P0/P1/P2 + 文件 + 位置 + 修法）。
3. **P0 断言必须亲自 grep 核实再修**——代理会误报（曾把 title 带空格的 `[[1. 两数之和]]` 误判断链；把「待垦态空壳 MOC」误判为缺子卡片）。
4. **修复后闭环**：`node .build/build.mjs && node .build/verify.mjs`（一键全套），再跑一遍第 1 步脚本。

## 审查维度（给代理用）

1. **内容正确性 P0**：技术断言逐条核实（复杂度、协议细节、框架行为、公式）；跨笔记口径要互相对照（如缓存穿透篇 vs EasyOrange 的 null 缓存口径曾正面矛盾）。
2. **结构规范 P1**：顶部「思维链路速查」= 结构流不是机制流、不与正文 chain 撞脸、后接箭头导语；无编号 H2；MOC = 一句定位 + bullet `[[子卡片]]`；MOC 正文段落禁双链（bullet 是唯一合法位置）。
3. **组件 P1**：callout 只承载单一提醒（禁步骤流）；chain 三栏 `名称 | 位置/动作 | 状态`；mermaid fence 必须写 `mermaid`。
4. **结构化优先 P1**：长散文段落该拆表/列表。
5. **P2**：错别字、直角引号统一、JDK 版本差异注释、代码片段自包含。

## 已裁决口径（勿反复）

- 微型/线性笔记（内容即步骤的短卡）允许无顶部 chain，纯文本导语即可。
- 红黑树千万行树高写「约 24~46 层」（最坏 2·log₂n），别只写理想 24。
- **Java 锁卷三条口径（跨笔记必须一致，勿改回去）**：
  1. 偏向锁 = JDK 15 默认禁用、JDK 18 实质移除；凡讲锁升级的笔记都要带这句版本注，不能只画「无锁→偏向→轻量→重量」四段。
  2. volatile 原子性 = 「单次读/写 ✅；复合操作（i++）❌」。写「volatile 完全不保证原子性」是错的。
  3. StampedLock **可中断**（`readLockInterruptibly`/`writeLockInterruptibly`）、**可超时**（`tryReadLock(t)`/`tryWriteLock(t)`），不可重入、无 Condition 才是它的限制。对比表别写「可中断 ❌」。
