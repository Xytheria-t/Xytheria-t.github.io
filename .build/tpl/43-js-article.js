// 正文组装。正文首行 H1 构建期已丢（title 顶替），此处别再剥。
function articleHTML(n){
  // 概念脉搏：解析每 H2/H3 节 → 字数 / 结构密度
  const SEG_RE = /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/g;
  const heads = []; let _m;
  while((_m = SEG_RE.exec(n.html))){ heads.push({tag:_m[1], attrs:_m[2], inner:_m[3], start:_m.index, end:SEG_RE.lastIndex}); }
  heads.forEach(function(h,i){
    const segEnd = (i+1 < heads.length) ? heads[i+1].start : n.html.length;
    const seg = n.html.slice(h.end, segEnd);
    h.chars = charCount(seg);
    h.d = densityOf(seg);
    h.text = h.inner.replace(/<[^>]+>/g,'').trim();
    h.id = 'h-'+i;
  });
  const tocItems = heads.filter(function(h){return h.text;}).map(function(h){
    return {tag:h.tag, id:h.id, text:h.text, chars:h.chars, d:h.d};
  });
  let body = '', _cur = 0;
  heads.forEach(function(h){
    body += n.html.slice(_cur, h.start);
    body += '<'+h.tag+' id="'+h.id+'"'+h.attrs+' data-d="'+h.d.toFixed(2)+'">'+h.inner
          + '<span class="rt-cap" title="本节约 '+h.chars+' 字 · 结构密度 '+(h.d*100|0)+'%">密度 '+(h.d*100|0)+'%</span>'
          + '</'+h.tag+'>';
    _cur = h.end;
  });
  body += n.html.slice(_cur);
  spineNodes.innerHTML = tocItems.map(function(it){
    return '<button class="sp-node '+(it.tag==='h3'?'h3':'h2')+'" data-id="'+it.id+'" data-d="'+it.d.toFixed(2)+'" data-t="'+attr(it.text)+'" style="--d:'+it.d.toFixed(3)+'">'
      + '<span class="sp-density"></span>'
      + '<span class="sp-dot"></span>'
      + '<span class="sp-label">'+esc(it.text)+'<span class="rt-cap" title="结构密度 '+(it.d*100|0)+'%">'+(it.d*100|0)+'%</span></span>'
      + '</button>';
  }).join('');
  markRead(n.id);
  const fr = freshLabel(n.id);
  const pad = n => String(n).padStart(2,'0');
  const mt = n.mtime ? new Date(n.mtime) : null;
  const etStr = mt && !isNaN(mt) ? mt.getFullYear()+'-'+pad(mt.getMonth()+1)+'-'+pad(mt.getDate())+' · '+pad(mt.getHours())+':'+pad(mt.getMinutes()) : '';
  const etHtml = etStr
    ? '<div class="et" title="最后修改时间"><svg class="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>最后编辑 · '+etStr+'</div>'
    : '';
  const cur = masteryGet(n.id);
  const msHtml = '<div class="ms'+(cur?'':' unrated')+'" data-ms="'+esc(n.id)+'">'
    + '<span class="ms-lab">Mastery</span>'
    + '<span class="ms-set" title="点击评级 · 再点一次取消">'
    + MASTERY.map(function(m){
        return '<button class="ms-b'+(cur&&cur.k===m.k?' on':'')+'" data-k="'+m.k+'" style="--mc:'+MASTERY_COLOR[m.k]+'" title="'+esc(m.hint)+'">'
          + '<span class="dot"></span>'+esc(m.label)+'</button>';
      }).join('')
    + '</span>'
    + '</div>';
  return '<article class="art" style="--accent:'+n.accent+';--accent-ink:'+n.accentInk+'">'
    + '<h1>'+esc(n.title)+'</h1>'
    + '<div class="meta">'
    +   '<div class="rt'+(fr.due?' due':'')+'">'+fr.text+'</div>'
    +   etHtml
    +   msHtml
    + '</div>'
    + body
    + '</article>';
}

