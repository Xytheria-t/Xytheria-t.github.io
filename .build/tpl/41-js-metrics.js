// 内容度量：字数 / 结构密度 / 相对时间。只读内容本身，不碰 localStorage —— 两台设备渲染结果天然一致。
// 密度用于正文 sp-node 与 .rt-cap 角标（43-js-article.js）；relTime 用于墙上「更新于」（42-js-wall.js）。
// 字数（含中文）：去标签后统计非空白字符数
function charCount(html){
  const txt = (html||'').replace(/<[^>]+>/g,'').replace(/\s+/g,'');
  return txt.length;
}

/* ---- 结构密度（替代旧「阅读分钟」）：节内结构化字符 / 该节总字符，保底 0.08。
   重型结构（表格/代码/chain/问答/mermaid）+ 列表 + callout 都算「可扫读结构」，
   否则纯散文+要点列表的节密度会被压到地板，区分度差。 ---- */
function structCharsOf(html){
  const box = document.createElement('div'); box.innerHTML = html;
  let n = 0;
  box.querySelectorAll('table, figure.code, .chain, .qa-q, .qa-a, .mermaid, ul, ol, blockquote')
    .forEach(function(el){ n += (el.textContent || '').replace(/\s+/g,'').length; });
  return n;
}
function densityOf(html){
  const total = charCount(html);
  if(!total) return 0.08;
  return Math.max(0.08, Math.min(1, structCharsOf(html) / total));
}

/* ---- 相对时间：墙上「更新于 X」用它把 mtime 说成人话 ---- */
function relTime(ts){
  const d = Math.floor((Date.now() - ts) / 86400000);
  if(d <= 0) return '今天';
  if(d === 1) return '昨天';
  if(d < 7) return d + ' 天前';
  if(d < 30) return Math.floor(d/7) + ' 周前';
  if(d < 365) return Math.floor(d/30) + ' 个月前';
  return Math.floor(d/365) + ' 年前';
}
