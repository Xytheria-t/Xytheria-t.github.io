// 源文件定位（Ctrl+Alt+O）路径断言：中文/空格文件名必须 decode 成可读绝对路径。
// 坑：new URL().pathname 会 percent-encode 中文，直接复制得到 %E5%8A%A8... 粘进资源管理器打不开。
// 只测纯函数逻辑（与 reader.tpl.html 内 openCurrentNoteFile 的路径处理同构），不依赖 DOM。
import { run } from './_harness.mjs';

const { NOTES } = run();
let fail = 0;
const ck = (name, cond, extra = '') => {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!cond) fail++;
};

// 与 tpl 内一致的处理：decodeURIComponent(pathname).replace(/^\//,'')
function absPathOf(file, baseHref) {
  const u = new URL(file, baseHref);
  let abs;
  try { abs = decodeURIComponent(u.pathname).replace(/^\//, ''); }
  catch (e) { abs = u.pathname.replace(/^\//, ''); }
  return abs;
}

const HREF = 'file:///D:/Work/Vinea/reader.html';

console.log('\n== 1. 中文文件名 decode ==');
const cn = absPathOf('notes/动态代理.md', HREF);
ck('中文路径 decode 后可读', cn === 'D:/Work/Vinea/notes/动态代理.md', cn);
ck('中文路径不含百分号', !cn.includes('%'), cn);

console.log('\n== 2. 英文/数字文件名不受影响 ==');
const en = absPathOf('notes/ThreadPoolExecutor.md', HREF);
ck('英文路径原样', en === 'D:/Work/Vinea/notes/ThreadPoolExecutor.md', en);

console.log('\n== 3. 空格文件名 ==');
const sp = absPathOf('notes/Exam Essay.md', HREF);
ck('空格路径 decode 成真空格', sp === 'D:/Work/Vinea/notes/Exam Essay.md', sp);

console.log('\n== 4. 全库实跑：每篇笔记的 file 都要能 decode 出可读路径 ==');
const bad = [];
for (const n of Object.values(NOTES)) {
  if (!n.file) continue;
  const abs = absPathOf(n.file, HREF);
  if (abs.includes('%')) bad.push(n.id + ' → ' + abs);
}
ck('无笔记路径残留百分号编码', bad.length === 0, bad.length ? bad.slice(0, 3).join(' | ') : `(${Object.keys(NOTES).length} 篇全过)`);

console.log('\n== 5. 非法百分号序列不崩（退回原始值）==');
const weird = absPathOf('notes/100%.md', HREF);
ck('畸形编码不抛异常', typeof weird === 'string' && weird.length > 0, weird);

console.log('\n' + (fail ? `PATH CHECK FAILED (${fail})` : 'PATH CHECK OK'));
process.exit(fail ? 1 : 0);