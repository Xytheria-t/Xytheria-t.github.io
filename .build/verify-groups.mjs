/* 分组墙断言：把 reader.html 的脚本放进沙箱跑，调用 wallHTML() 检查分卷结构。
   期望值全部从 NOTES 注入的 group / groupRank 推导，不写死笔记 id。 */
import { run } from './_harness.mjs';

const { ctx, NOTES, ROOT_ID } = run();
const wall = ctx.wallHTML(NOTES[ROOT_ID]);
// 子墙样本：任取一个非根 MOC（不写死 id，结构变了也不假 FAIL）
const subId = Object.keys(NOTES).find(id => id !== ROOT_ID && NOTES[id].type === 'moc');
const subWall = subId ? ctx.wallHTML(NOTES[subId]) : '';

const fail = [], pass = [];
const ok = (cond, msg) => (cond ? pass : fail).push(msg);

const list = (NOTES[ROOT_ID].links || []).map(s => NOTES[s]).filter(Boolean);
function descendants(id){
  const seen = new Set();
  (function walk(x){
    const n = NOTES[x];
    if(!n || seen.has(x)) return;
    seen.add(x);
    if(n.type !== 'moc') return;
    (n.links || []).forEach(walk);
  })(id);
  seen.delete(id);
  return [...seen].filter(x => NOTES[x] && NOTES[x].type !== 'moc');
}

// 1. 每个根墙卡片都必须登记进 GROUP（新领域忘了加 → 直接失败，不静默丢进「其他」）
const orphans = list.filter(t => !(t.group >= 0)).map(t => t.category);
ok(!orphans.length, '根墙所有领域都已登记进 GROUP' + (orphans.length ? '（缺失: ' + orphans.join(', ') + '）' : ''));

// 2. 期望的卷结构（纯从注入字段推导）
const gi = t => (t.group < 0 ? 1e9 : t.group);
const byGroup = {};
list.forEach(t => (byGroup[t.group] = byGroup[t.group] || []).push(t));
const expected = Object.keys(byGroup)
  .map(Number)
  .sort((a, b) => gi({ group:a }) - gi({ group:b }))
  .map(g => {
    const items = byGroup[g].slice().sort((a, b) => a.groupRank - b.groupRank);
    const fallow = items.map(t => t.type === 'moc' && descendants(t.id).length === 0);
    return { items, fallow, layout: items[0].groupLayout || 'tiles' };
  });

// 3. 实际渲染（根墙 = 杂志封面 + 卷目录带，版式由 GROUP.layout 指定）
const bands = wall.split('<section class="band band--').slice(1).map(s => 'band--' + s);
ok(bands.length === expected.length, `卷数 = ${expected.length}（实际 ${bands.length}）`);
ok(bands.length > 0, '根墙走的是分卷版式（renders .band）');
ok(wall.includes('class="cover"'), '根墙渲染杂志封面（.cover）');
ok(subWall && subWall.includes('class="subhead"') && subWall.includes('<article class="ventry') && !subWall.includes('class="folio '),
   `子墙（${subId}）已杂志化：轻量扉页 + 统一 .ventry 网格，无 bento`);

expected.forEach((exp, bi) => {
  const b = bands[bi];
  if(!b){ fail.push(`第 ${bi + 1} 卷缺失`); return; }
  const name = (b.match(/class="band-name">([^<]*)</) || []) [1];
  const layout = (b.match(/^band--([\w-]+)"/) || [])[1];
  const cards = [...b.matchAll(/<article class="ventry([^"]*)" data-target="([^"]+)"/g)]
    .map(m => ({ cls: m[1], id: m[2] }));
  const ids = cards.map(c => c.id);
  const wantIds = exp.items.map(t => t.id);
  const tag = `卷「${exp.items[0].groupName || '其他'}」`;

  ok(name === (exp.items[0].groupName || '其他'), `${tag} 卷名 = ${name}`);
  ok(layout === exp.layout, `${tag} 版式 = ${exp.layout}（实际 ${layout}）`);
  ok(ids.join(',') === wantIds.join(','), `${tag} 卷内顺序 = ${wantIds.join(' → ')}（实际 ${ids.join(' → ')}）`);
  exp.items.forEach((t, i) => {
    const c = cards[i];
    if(!c) return;
    ok(c.cls.includes('fallow') === exp.fallow[i], `${tag} ${t.title} 待垦态 = ${exp.fallow[i]}`);
  });
});

// 4. 没有条目丢卷 / 重复（只数 ventry 条目本身；预览里的笔记链接不计入）
const allIds = bands.flatMap(b => [...b.matchAll(/<article class="ventry[^"]*" data-target="([^"]+)"/g)].map(m => m[1]));
ok(allIds.length === list.length, `渲染卡片数 = ${list.length}（实际 ${allIds.length}）`);
ok(new Set(allIds).size === allIds.length, '无重复卡片');

console.log('PASS ' + pass.length);
pass.forEach(m => console.log('  ✓ ' + m));
if(fail.length){
  console.log('FAIL ' + fail.length);
  fail.forEach(m => console.log('  ✗ ' + m));
  process.exit(1);
}
console.log('GROUPS OK');
