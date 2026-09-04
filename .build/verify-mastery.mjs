// 熟练度断言：评级在正文页控件里设置；MOC 墙上以 .vm 徽标（叶子卡右上角）与 .vmd 微点（预览行）只读展示。
// MOC 卡自身不可评级、永不出现徽标；清除 = 再点一次已选档位（无独立清除按钮）。
// 期望从 NOTES 动态推导（不写死笔记 id），否则笔记结构一变就假 FAIL。
import { run } from './_harness.mjs';

const { ctx, NOTES, ROOT_ID } = run();
const { wallHTML, articleHTML, masterySet, masteryAll } = ctx;
if (typeof wallHTML !== 'function') { console.error('wallHTML missing'); process.exit(1); }
let fail = 0;
const ck = (name, cond, extra = '') => { console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fail++; };

console.log('\n== 1. empty state (no ratings) ==');
let out = wallHTML(NOTES[ROOT_ID]);
ck('root wall MOC cards no .vm', !/class="vm"/.test(out));
// 任一有直接叶子笔记的 MOC 墙：全未评级 → 全无徽标
const parentWithNotes = Object.keys(NOTES).find(id => NOTES[id].type === 'moc' && (NOTES[id].links || []).some(x => NOTES[x] && NOTES[x].type === 'note'));
const w0 = parentWithNotes ? wallHTML(NOTES[parentWithNotes]) : '';
ck('leaf-note wall 无评级时无 .vm/.vmd', !/class="vm"?/.test(w0));

console.log('\n== 2. rate a few notes ==');
const noteIds = Object.keys(NOTES).filter(id => NOTES[id].type === 'note');
const [a, b, c] = [noteIds[0], noteIds[1], noteIds[2]];
masterySet(a, 'tell'); masterySet(b, 'firm'); masterySet(c, 'raw');
ck('masteryAll has 3 entries', Object.keys(masteryAll()).length === 3, JSON.stringify(Object.keys(masteryAll())));
ck('value shape {k,t}', masteryAll()[a].k === 'tell' && typeof masteryAll()[a].t === 'number');

console.log('\n== 3. MOC 墙展示熟练度 = 叶子卡 .vm（MOC 卡自身无评级、永不徽标） ==');
out = wallHTML(NOTES[ROOT_ID]);
ck('root wall MOC cards carry no .vm', !/class="vm"/.test(out));
// a 的直接父 MOC 墙应出现评级徽标；同墙其他卡按评级数一比一
const parents = Object.keys(NOTES).filter(id => NOTES[id].type === 'moc' && (NOTES[id].links || []).includes(a));
ck('find direct MOC parent of rated note', parents.length > 0, parents[0] || 'none');
if (parents.length) {
  const w = wallHTML(NOTES[parents[0]]);
  const ratedDirect = (NOTES[parents[0]].links || []).filter(id => NOTES[id] && NOTES[id].type !== 'moc' && masteryAll()[id]).length;
  const ratedMoc = (NOTES[parents[0]].links || []).filter(id => NOTES[id] && NOTES[id].type === 'moc' && masteryAll()[id]).length;
  ck('rated leaf-note card carries .vm', /class="vm"/.test(w.split('</article>').find(s => s.includes('data-target="' + a + '"')) || ''));
  ck('badge carries level color', /--mc:#3F7A5A/.test(w), 'tell=绿');
  ck('.vm 数 = 已评级直接叶子数（MOC 子卡不掺和）', (w.match(/class="vm"/g) || []).length === ratedDirect + ratedMoc,
    (w.match(/class="vm"/g) || []).length + ' vs ' + (ratedDirect + ratedMoc));
}

console.log('\n== 4. article page has the control ==');
const art = articleHTML(NOTES[a]);
ck('article renders .ms control', /class="ms"/.test(art));
ck('control has 3 level buttons', (art.match(/class="ms-b/g) || []).length === 3, 'got ' + (art.match(/class="ms-b/g) || []).length);
ck('rated note shows active button', /class="ms-b on"/.test(art));
const artUnrated = articleHTML(NOTES[noteIds[noteIds.length - 1]]);
ck('unrated note has no active button', !/class="ms-b on"/.test(artUnrated));
// 清除 = 再点一次已选档位（toggle off），控件里没有独立清除按钮
ck('control has no clear button (toggle 取代)', !/ms-clr/.test(art));
ck('rated button is toggle-off (提示语在 .ms-set 上)', /点击评级 · 再点一次取消/.test(art));

console.log('\n== 5. clear works (再点一次取消) ==');
masterySet(a, null);
ck('cleared entry removed from storage', !masteryAll()[a]);
const art2 = articleHTML(NOTES[a]);
ck('article no longer shows active', !/class="ms-b on"/.test(art2));

console.log('\n== 6. 深层叶子评级后：中间 MOC 卡仍无徽标，叶子墙出现 .vm ==');
// 路径从 NOTES 动态推导，不写死笔记 id —— 否则笔记结构一变就假 FAIL
const kids = id => ((NOTES[id] && NOTES[id].links) || []).filter(x => NOTES[x]);
const deep = (function () {
  for (const mid of kids(ROOT_ID)) {
    if (NOTES[mid].type !== 'moc') continue;
    for (const leaf of kids(mid)) {
      if (NOTES[leaf].type !== 'moc') continue;
      const note = kids(leaf).find(x => NOTES[x].type === 'note');
      if (note) return { mid, leaf, note };
    }
  }
  return null;
})();
if (!deep) {
  console.log('  skip 当前结构无 >=2 层嵌套 MOC 链，跨层级聚合不可验证');
} else {
  ck('找到 >=2 层嵌套路径', true, `${ROOT_ID} > ${deep.mid} > ${deep.leaf} > ${deep.note}`);
  const midRow = () => (wallHTML(NOTES[ROOT_ID]).split('</article>').find(s => s.includes(`data-target="${deep.mid}"`)) || '');
  // 负向对照：清空整棵子树
  [deep.mid, deep.leaf].concat(kids(deep.mid), kids(deep.leaf)).forEach(id => masterySet(id, null));
  ck(`[${deep.mid}] 子树未评级时该卡无 .vm/.vmd`, !/class="vmd?"/.test(midRow()));
  const leafWallBefore = wallHTML(NOTES[deep.leaf]);
  ck(`leaf wall [${deep.leaf}] 未评级时无 .vm`, !/class="vm"/.test(leafWallBefore));
  masterySet(deep.note, 'tell');
  ck(`[${deep.mid}] 评级后 MOC 卡本身仍无 .vm（MOC 不可评级）`, !/class="vm"/.test(midRow()),
     (midRow().match(/class="vm"/) || ['none'])[0]);
  const leafWall = wallHTML(NOTES[deep.leaf]);
  ck(`leaf wall [${deep.leaf}] 评级后出现 .vm`, new RegExp('data-target="' + deep.note + '"').test(leafWall) && /class="vm"/.test(leafWall.split('</article>').find(s => s.includes('data-target="' + deep.note + '"')) || ''));
}

console.log('\n' + (fail ? 'MASTERY CHECK FAILED (' + fail + ')' : 'MASTERY CHECK OK'));
process.exit(fail ? 1 : 0);
