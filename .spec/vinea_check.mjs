import fs from 'fs'; import path from 'path';
// 机械校验（全库体检第一步，秒级、零误报才准上手改）：
const dir = 'notes';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
const slugify = s => s.trim().toLowerCase().replace(/\s+/g, '-');
const CALLOUTS = ['note', 'info', 'warning', 'tip', 'danger', 'caution', 'important', 'question'];
const MERMAID_TYPES = /^(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|mindmap|quadrantChart|timeline|graph)/;

const meta = new Map(); const notes = {}; const problems = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) { problems.push(`[P0] ${f}: 无 frontmatter`); continue; }
  const fm = m[1]; const kv = {};
  for (const line of fm.split('\n')) {
    const i = line.indexOf(':');
    if (i > -1) kv[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const title = (kv.title || '').trim();
  if (!title) { problems.push(`[P0] ${f}: 无 title`); continue; }
  const h1 = (raw.match(/^# (.+)$/m) || [])[1];
  if (h1 && h1.trim() !== title) problems.push(`[P1] ${f}: H1「${h1}」≠ title「${title}」`);
  const fences = (raw.match(/^```/gm) || []).length;
  if (fences % 2 !== 0) problems.push(`[P0] ${f}: fence 数为奇数 (${fences})`);
  const aliases = (kv.aliases || '').replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean);
  meta.set(f, { title, aliases, isMoc: /^moc$/i.test((kv.type || '').trim()), order: kv.order, cat: kv.category, raw });
  notes[title] = f;
}
// slug 名册 = title slug ∪ alias slug（与 build 的双链解析同口径，避免 [[旧名]] 误报死链）
const knownSlugs = new Set();
meta.forEach(v => { knownSlugs.add(slugify(v.title)); v.aliases.forEach(a => knownSlugs.add(slugify(a))); });

for (const [f, v] of meta) {
  for (const lm of v.raw.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const t = lm[1].split('|')[0].split('#')[0].trim();
    if (!notes[t] && !knownSlugs.has(slugify(t))) problems.push(`[P1] ${f}: 死链 [[${t}]]`);
  }
}
const seen = {};
for (const [t, f] of Object.entries(notes)) {
  if (seen[t]) problems.push(`[P0] title 重复:「${t}」 ${seen[t]} 与 ${f}`);
  seen[t] = f;
}

// order 冲突：同 category 内两篇 note 用了同一位次
const byCat = new Map();
for (const [f, v] of meta) if (!v.isMoc && v.order) {
  const k = v.cat || '?';
  if (!byCat.has(k)) byCat.set(k, new Map());
  byCat.get(k).set(v.order, [...(byCat.get(k).get(v.order) || []), f]);
}
for (const [cat, m] of byCat) for (const [o, fs2] of m) if (fs2.length > 1)
  problems.push(`[P1] 卷 ${cat} order=${o} 冲突: ${fs2.join(', ')}`);

// 逐篇规范体检（MOC 走墙渲染，规则不同，跳过）
const sparse = [];
for (const [f, v] of meta) {
  if (v.isMoc) continue;
  const body = v.raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const iss = [];

  // 节点数上限只管顶部「思维链路速查」；正文 chain 描述实际阶段数（如类加载七阶段）不受限
  const topIdx = body.search(/##[ \t]*思维链路速查/);
  const topSeg = topIdx > -1 ? body.slice(topIdx, topIdx + 500) : '';
  for (const m of topSeg.matchAll(/```chain\r?\n([\s\S]*?)```/g)) {
    const rows = m[1].split('\n').filter(l => l.trim());
    if (rows.length > 5) iss.push('顶部chain ' + rows.length + '节点（上限5）');
  }
  for (const m of body.matchAll(/```chain\r?\n([\s\S]*?)```/g)) {
    const cols = [...new Set(m[1].split('\n').filter(l => l.trim()).map(r => r.split('|').length))];
    if (cols.some(c => c !== 3)) iss.push('chain非三栏(' + cols.join('/') + ')');
  }

  // 顶部结构：chain/branch 优先；微型·线性笔记允许纯文本导语代替，但导语句必须在
  const head = body.slice(0, topIdx > -1 ? topIdx : body.length)
    .replace(/^#[^\n]*\n/, '')
    .split('\n').filter(l => !/^\s*>[ \t]?/.test(l) && !/^\s*```/.test(l)).join('\n').trim();
  if (!/##[ \t]*思维链路速查/.test(body)) {
    if (head.length < 10) iss.push('既无[思维链路速查]也无导语');
  } else if (!/```(chain|branch)/.test(topSeg)) iss.push('顶部非chain/branch');

  const h2 = [...body.matchAll(/^##[ \t]+(.*)$/gm)].map(m => m[1]);
  const num = h2.filter(h => /^\d+[.、]/.test(h));
  if (num.length) iss.push('编号H2: ' + num.join(','));
  const generic = h2.filter(h => /^(详节|总结|详解)$/.test(h.trim()));
  if (generic.length) iss.push('泛化H2占位: ' + generic.join(','));

  if (/^\|[ \t]*\|[ \t]*\|$/m.test(body)) iss.push('空表头');

  for (const m of body.matchAll(/```(\w+)\r?\n([\s\S]*?)```/g))
    if (m[1] !== 'mermaid' && MERMAID_TYPES.test(m[2].trim()))
      iss.push('mermaid误标为' + m[1]);

  const sums = [...body.matchAll(/<summary>(.*?)<\/summary>/g)].map(m => m[1].trim());
  const ph = sums.filter(s => !s || s === '图' || s === '图示');
  if (ph.length) iss.push('summary占位 x' + ph.length);
  const dup = [...new Set(sums.filter((s, i) => sums.indexOf(s) !== i))];
  if (dup.length) iss.push('summary重名: ' + dup.join(','));

  for (const m of body.matchAll(/\[!(\w+)\]/g))
    if (!CALLOUTS.includes(m[1])) iss.push('未配色 callout [!' + m[1] + ']');

  if (iss.length) problems.push(`[P1] ${f}: ${iss.join(' | ')}`);

  const outLinks = new Set([...body.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => slugify(m[1].split('|')[0].split('#')[0])));
  if (outLinks.size <= 1) sparse.push(f);
}

console.log(problems.length ? problems.join('\n') : 'ALL CLEAN');
if (sparse.length) console.log(`WARN 出链 ≤1（双链稀疏，仅提示）: ${sparse.join(', ')}`);
console.log(`total notes: ${files.length}`);
