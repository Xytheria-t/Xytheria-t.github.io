// 代码块行自平衡断言：hljs 的多行 token（yaml 块标量 / Java text block / bash heredoc…）若未被
// build.mjs 的 splitLinesBalanced 在每个 \n 处补关重开，.ln 会互相嵌套、行尾多出孤儿 </span>，
// 现象 = 行号断成两截、代码逃出行面板（PITFALLS·CSS/渲染）。断言对象：每篇笔记产物 html 里
// 每个 code figure 的 <pre><code> 体内 —— .ln 只准在深度 0 开启，且 span 总体配平。
import { run } from './_harness.mjs';

const { NOTES } = run();
let figs = 0, bad = [];
for (const id of Object.keys(NOTES)) {
  const html = NOTES[id].html || '';
  const figRe = /<figure class="code[^"]*" data-lang="[^"]*">[\s\S]*?<pre><code>([\s\S]*?)<\/code><\/pre>/g;
  let fm;
  while ((fm = figRe.exec(html))) {
    figs++;
    const body = fm[1];
    let depth = 0, ok = true;
    const tagRe = /<span class="ln">|<span [^>]*>|<\/span>/g;
    let tm;
    while ((tm = tagRe.exec(body))) {
      if (tm[0] === '<span class="ln">') {
        if (depth !== 0) { ok = false; break; }
        depth++;
      } else if (tm[0] === '</span>') {
        depth--;
      } else {
        depth++;
      }
      if (depth < 0) { ok = false; break; }
    }
    if (!ok || depth !== 0) bad.push(id);
  }
}
if (figs === 0) { console.error('CODE CHECK FAILED — 产物中一个 code figure 都没有（渲染管线坏了？）'); process.exit(1); }
if (bad.length) {
  console.error('CODE CHECK FAILED — .ln 嵌套/配平失衡: ' + [...new Set(bad)].join(', '));
  process.exit(1);
}
console.log('CODE CHECK OK  (' + figs + ' 个代码图, 全部 .ln 顶层平铺且配平)');
