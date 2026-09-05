// 熟练度/翻阅时间戳/recent 全落 localStorage：解析必须 try/catch，只查必备结构，nullable 字段单独收编（PITFALLS）。
/* ---- mastery: Shaky / Familiar / Fluent (面试反复重读场景;不做"已读进度") ---- */
const MASTERY = [
  {k:'raw',  label:'Shaky',   hint:"Can’t explain it clearly yet"},
  {k:'firm', label:'Familiar', hint:'Can roughly answer'},
  {k:'tell', label:'Fluent',  hint:'Can recount off-script'}
];
const MASTERY_COLOR = { raw:'#C0563B', firm:'#B68A2E', tell:'#3F7A5A' };
const MS_KEY = 'vinea:mastery';
// 读路径全走内存缓存，写路径一次性回写 — 反复翻页/渲染不再每次 JSON.parse
const msStore = (() => { try { return JSON.parse(localStorage.getItem(MS_KEY)) || {}; } catch(e){ return {}; } })();
function masteryAll(){ return msStore; }
function masteryGet(id){ return msStore[id] || null; }
function masterySet(id, k){
  if(k) msStore[id] = {k:k, t:Date.now()}; else delete msStore[id];
  try { localStorage.setItem(MS_KEY, JSON.stringify(msStore)); } catch(e){}
}
/* 墙上只读态：评级了才出徽标，未评级零干扰 */
function mastOf(id){
  const cur = masteryGet(id);
  if(!cur) return null;
  for(let i=0;i<MASTERY.length;i++){ if(MASTERY[i].k===cur.k) return { m:MASTERY[i], t:cur.t }; }
  return null;
}
function mastHTML(id){
  const o = mastOf(id); if(!o) return '';
  return '<span class="vm" style="--mc:'+MASTERY_COLOR[o.m.k]+'" title="'+esc(o.m.label)+' · '+esc(o.m.hint)+'（评级于 '+new Date(o.t).toLocaleDateString('zh-CN')+'）">'+esc(o.m.label)+'</span>';
}
// 字数（含中文）：去标签后统计非空白字符数
function charCount(html){
  const txt = (html||'').replace(/<[^>]+>/g,'').replace(/\s+/g,'');
  return txt.length;
}

/* ---- 结构密度（替代旧「阅读分钟」）：节内结构化字符 / 该节总字符，保底 0.08 ---- */
function structCharsOf(html){
  const box = document.createElement('div'); box.innerHTML = html;
  let n = 0;
  box.querySelectorAll('table, figure.code, .chain, .qa-q, .qa-a, .mermaid')
    .forEach(function(el){ n += (el.textContent || '').replace(/\s+/g, '').length; });
  return n;
}
function densityOf(html){
  const total = charCount(html);
  if(!total) return 0.08;
  return Math.max(0.08, Math.min(1, structCharsOf(html) / total));
}

/* ---- 翻阅时间戳（localStorage['vinea.read'] = {slug: ts}）；未翻阅者以 mtime 当种子 ---- */
const READ_KEY = 'vinea.read';
function readStore(){ try { return JSON.parse(localStorage.getItem(READ_KEY)) || {}; } catch(e){ return {}; } }
function markRead(slug){
  if(!NOTES[slug]) return;
  const r = readStore(); r[slug] = Date.now();
  try { localStorage.setItem(READ_KEY, JSON.stringify(r)); } catch(e){}
}
function readInfo(slug){
  const r = readStore();
  if(r[slug]) return { read:true, ts:r[slug] };
  const n = NOTES[slug];
  const mt = n && n.mtime ? new Date(n.mtime).getTime() : 0;
  return { read:false, ts:mt };
}
// 待复习：能讲永不催；其余按「距上次读（未读则用 mtime 种子）≥ 7 天」判定
function isDue(slug){
  const m = masteryGet(slug);
  if(m && m.k === 'tell') return false;
  return (Date.now() - readInfo(slug).ts) >= 7 * 86400000;
}
function relTime(ts){
  const d = Math.floor((Date.now() - ts) / 86400000);
  if(d <= 0) return '今天';
  if(d === 1) return '昨天';
  if(d < 7) return d + ' 天前';
  if(d < 30) return Math.floor(d/7) + ' 周前';
  if(d < 365) return Math.floor(d/30) + ' 个月前';
  return Math.floor(d/365) + ' 年前';
}
function freshLabel(slug){
  const info = readInfo(slug);
  const due = isDue(slug);
  if(info.read) return { text: relTime(info.ts) + '读过', due:due, title:'上次翻开 · ' + new Date(info.ts).toLocaleString('zh-CN') };
  return { text:'未读', due:due, title: info.ts ? ('最后编辑 · ' + new Date(info.ts).toLocaleDateString('zh-CN')) : '尚未编辑' };
}

/* ---- recently-read (localStorage['vinea.recent']) ---- */
const RECENT_KEY = 'vinea.recent';
const RECENT_MAX = 12;
function recentList(){
  try { const a = JSON.parse(localStorage.getItem(RECENT_KEY)); return Array.isArray(a) ? a : []; } catch(e){ return []; }
}
function recentPush(slug){
  if(!NOTES[slug]) return;
  const a = recentList().filter(function(s){ return s !== slug; });
  a.unshift(slug);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(a.slice(0, RECENT_MAX))); } catch(e){}
}

