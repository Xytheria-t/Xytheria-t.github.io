// 杂志化墙体验证：每个 MOC 墙渲染出的 .ventry 数 = 它的 links 数；
// 旧的权重 bento（.folio b1/b2/b4/b6）不应再出现于任何墙。
// 子 MOC links=0 = 待填空墙，WARN 不 FAIL（用户写笔记的事，不该让 verify 红）。
import { run } from './_harness.mjs';

const { ctx, NOTES, ROOT_ID } = run();
const wallHTML = ctx.wallHTML;
if (typeof wallHTML !== 'function') { console.error('wallHTML not exposed'); process.exit(1); }

const mocIds = Object.keys(NOTES).filter(id => NOTES[id].type === 'moc');
let allOk = true;
const emptyWalls = [];
for (const id of mocIds) {
  const out = wallHTML(NOTES[id]);
  const entries = (out.match(/<article class="ventry/g) || []).length;
  const folios = (out.match(/class="folio /g) || []).length;
  const expectedLinks = NOTES[id].links.length;
  const ok = entries === expectedLinks && folios === 0;
  if (!ok) allOk = false;
  // 子 MOC 没有后代 = 待垦态；根墙不可能 links=0
  const isEmptyWall = expectedLinks === 0 && id !== ROOT_ID;
  if (isEmptyWall) emptyWalls.push({ id, title: NOTES[id].title, group: NOTES[id].group });
  console.log(`\n[${id}] ventry=${entries} (links=${expectedLinks}) folios=${folios}  ${ok ? 'OK' : 'MISMATCH'}`);
}
if (emptyWalls.length) {
  console.log('\n== 待填笔记（子 MOC 没有后代） ==');
  emptyWalls.forEach(function(w){
    console.log(`  ⚠ [${w.id}] ${w.title}${w.group < 0 ? '  (group=-1 未归卷)' : ''}`);
  });
}
console.log('\n' + (allOk ? 'SPAN CHECK OK' : 'SPAN CHECK FAILED') + (emptyWalls.length ? `  (${emptyWalls.length} 个待填子 MOC 仅作警告)` : ''));
process.exit(allOk ? 0 : 1);