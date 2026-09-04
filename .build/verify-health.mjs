// 内容健康断言：无孤儿笔记（in-degree=0）、所有笔记从根可达。
// 期望全部从注入的 NOTES[id].links 推导，不写死笔记 id。
import { notes } from './_harness.mjs';

const { NOTES, ROOT_ID } = notes();
const ids = Object.keys(NOTES);
const indeg = Object.fromEntries(ids.map(id => [id, 0]));
for (const id of ids) for (const l of (NOTES[id].links || [])) if (NOTES[l]) indeg[l]++;

const seen = new Set();
(function walk(x) {
  if (!NOTES[x] || seen.has(x)) return;
  seen.add(x);
  for (const l of (NOTES[x].links || [])) walk(l);
})(ROOT_ID);

const orphans = ids.filter(id => indeg[id] === 0 && id !== ROOT_ID);
const unreachable = ids.filter(id => !seen.has(id));

let fail = 0;
const ck = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fail++;
};

console.log('\n== content health ==');
ck('无孤儿笔记 (in-degree = 0)', orphans.length === 0, orphans.length ? orphans.join(', ') : '');
ck('所有笔记从根可达', unreachable.length === 0, unreachable.length ? unreachable.join(', ') : '');

console.log('\n' + (fail ? 'HEALTH CHECK FAILED (' + fail + ')' : 'HEALTH CHECK OK  (' + ids.length + ' notes, 全部已链接且可达)'));
process.exit(fail ? 1 : 0);
