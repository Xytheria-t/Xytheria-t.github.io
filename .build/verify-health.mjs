// 内容健康断言：无孤儿笔记（in-degree=0）、所有笔记从根可达。
// 卷外常驻（NOTES[id].dock = 右上角 #clipDock 指向的笔记）是第二座入口：它自己靠常驻按钮进入（无入边 → 孤儿豁免），
// 下挂的速记也只由它进入（可达性从它起算 —— 速记不回挂学科墙，别改回「不可达」判据）。
// 豁免有名有姓：按钮没解析到目标笔记时 dock 数为 0，下面第三条断言直接 FAIL，不会变成无名后门。
// 期望全部从注入的 NOTES[id].links 推导，不写死笔记 id。
import { notes } from './_harness.mjs';

const { NOTES, ROOT_ID } = notes();
const ids = Object.keys(NOTES);
const indeg = Object.fromEntries(ids.map(id => [id, 0]));
for (const id of ids) for (const l of (NOTES[id].links || [])) if (NOTES[l]) indeg[l]++;

const docked = ids.filter(id => NOTES[id].dock);

const seen = new Set();
function walk(x) {
  if (!NOTES[x] || seen.has(x)) return;
  seen.add(x);
  for (const l of (NOTES[x].links || [])) walk(l);
}
walk(ROOT_ID);
docked.forEach(walk); // 常驻入口也是入口

const orphans = ids.filter(id => indeg[id] === 0 && id !== ROOT_ID && !NOTES[id].dock);
const unreachable = ids.filter(id => !seen.has(id));

let fail = 0;
const ck = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fail++;
};

console.log('\n== content health ==');
ck('无孤儿笔记 (in-degree = 0)', orphans.length === 0, orphans.length ? orphans.join(', ') : '');
ck('所有笔记从根 / 常驻入口可达', unreachable.length === 0, unreachable.length ? unreachable.join(', ') : '');
ck('常驻入口目标（dock）存在', docked.length > 0, docked.join(', '));

console.log('\n' + (fail ? 'HEALTH CHECK FAILED (' + fail + ')' : 'HEALTH CHECK OK  (' + ids.length + ' notes, 全部已链接且可达)'));
process.exit(fail ? 1 : 0);
