// 必保 feature 断言：把散文铁律（workbuddy MEMORY·必保 feature / 导航模型 / CSS 铁律 / xilu 清零）固化成检查。
// 断言对象：产物 reader.html（DOM/CSS/注入完整性）+ tpl/ JS 模块拼接（剥注释后匹配，防注释关键词污染）+ build.mjs（构建期渲染器）。
// 设计主权：这些断言编码的是「当前设计」。若某 feature 被刻意移除，先改这里再改实现（PITFALLS·verify 断言已被移除的 UI）。
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const product = readFileSync(resolve(root, 'reader.html'), 'utf8');
const buildSrc = readFileSync(resolve(root, '.build', 'build.mjs'), 'utf8');

// JS 断言跑在「tpl JS 模块拼接 + 剥注释」上：NOTES 数据不在其中（无内容污染），注释里的 pushState/back 等关键词必须剥掉
const TPL = resolve(root, '.build', 'tpl');
const jsFiles = readdirSync(TPL).filter(f => /^4[0-8]-/.test(f)).sort().concat(['90-end.html']);
let js = jsFiles.map(f => readFileSync(resolve(TPL, f), 'utf8')).join('');
js = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let fail = 0;
const ck = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fail++;
};
const count = (src, re) => (src.match(re) || []).length;

// ---- 必保 DOM 固定件（壳层，误删即静默失效） ----
console.log('\n== 必保 DOM 固定件 ==');
for (const id of ['stage', 'spine', 'companion', 'pop', 'navHint', 'halo', 'progress']) {
  ck(`#${id} 存在`, product.includes(`id="${id}"`));
}
for (const id of ['stage', 'spine', 'companion', 'pop']) {
  ck(`js-core 引用 #${id}`, count(js, new RegExp(`getElementById\\('${id}'\\)`)) >= 1);
}

// ---- 必保 feature 接线（定义 + 至少一处调用，count>=2） ----
console.log('\n== 必保 feature 接线 ==');
for (const fn of ['bindPop', 'ensureMermaid', 'runMermaidOn', 'setupMermaidDetails', 'bindAnchors', 'layoutSpine', 'updateTimeline']) {
  ck(`${fn} 定义且被调用`, count(js, new RegExp(`\\b${fn}\\b`, 'g')) >= 2);
}
ck('双链 hover 预览渲染（pop 灌 HTML）', count(js, /\bpop\.innerHTML/g) >= 1);
ck('gantt 构建期渲染器（build.mjs）', count(buildSrc, /function renderGantt\(/g) === 1 && buildSrc.includes('language-gantt'));
ck('代码行号 .ln（build.mjs 产出 span.ln）', buildSrc.includes('class="ln"'));
ck('mermaid 外置 vendor/ 懒加载（vendor 文件在）', existsSync(resolve(root, 'vendor', 'mermaid.min.js')));
ck('mermaid 懒加载指向 vendor 而非 CDN', count(js, /vendor\/mermaid\.min\.js/g) >= 1 && count(js, /https?:\/\/[^\s'"]*mermaid/g) === 0);

// ---- 导航模型（单一驱动源 = 浏览器历史；PITFALLS·导航） ----
console.log('\n== 导航模型 ==');
ck("popstate 监听恰好 1 份（多份 = 一次导航多重渲染）", count(js, /addEventListener\('popstate'/g) === 1);
ck('go() 用 pushState 入历史（栈恒 1 条 = 侧键退化切标签）', count(js, /history\.pushState\(/g) === 1);
ck('replaceState 保留 history.state（清 state = popstate 拿不到 slug 静默白屏）', count(js, /replaceState\(history\.state/g) >= 1);
ck('无 replaceState(null', count(js, /replaceState\(null/g) === 0);
ck('JS 不调 history.back（侧键交给原生，接管 = 一次按键退两级）', count(js, /history\.back/g) === 0);
ck("无 mousedown 监听（侧键不接管的现状编码）", count(js, /addEventListener\('mousedown'/g) === 0);

// ---- CSS 铁律（PITFALLS：验 CSS 必须 re.search 整个产物） ----
console.log('\n== CSS 铁律 ==');
ck('.ln 必须 display:block（flex 吞前导缩进）', /\.ln\{display:block/.test(product));
ck('.code 不得加 overflow:hidden（变滚动容器，sticky 页眉失效）', !/\.code\{[^}]*overflow:hidden/.test(product));

// ---- xilu 清零 + 注入完整性 ----
console.log('\n== xilu 清零 / 注入完整性 ==');
const tplAll = readdirSync(TPL);
const xiluHit = tplAll.filter(f => /xilu|study\.html/i.test(readFileSync(resolve(TPL, f), 'utf8')));
ck('tpl 模块无 xilu/study.html 残留（习录已迁出，勿加回）', xiluHit.length === 0, xiluHit.join(', '));
ck('产物无未注入占位符（build 兜底断言之外的双保险）', !product.includes('/*__NOTES__*/') && !product.includes('/*__ROOT__*/'));

console.log('\n' + (fail ? 'FEATURE CHECK FAILED (' + fail + ')' : 'FEATURE CHECK OK'));
process.exit(fail ? 1 : 0);
