// 正文增强接线：chain 滚动 / mermaid details 展开 / 锚点 / 表格排序 / setupWall 入场。hash 解码必须 try/catch 兜畸形百分号（URIError 退回原值）。
function parsePathPoints(d){
  const nums = d.match(/[MmLlHhVvCcQqTtSsAaZz][d.-s,]+/g) || [];
  const pts = [];
  let x=0,y=0;
  nums.forEach(function(seg){
    const cmd=seg[0].toUpperCase();
    const vals=seg.slice(1).trim().split(/[s,]+/).filter(Boolean).map(parseFloat);
    if(cmd==='M' && vals.length>=2){ x=vals[0]; y=vals[1]; pts.push({x,y}); }
    else if(cmd==='L' && vals.length>=2){ x=vals[0]; y=vals[1]; pts.push({x,y}); }
    else if(cmd==='H' && vals.length>=1){ x=vals[0]; pts.push({x,y}); }
    else if(cmd==='V' && vals.length>=1){ y=vals[0]; pts.push({x,y}); }
    else if((cmd==='C' || cmd==='S') && vals.length>=2){ x=vals[vals.length-2]; y=vals[vals.length-1]; pts.push({x,y}); }
  });
  return pts;
}
function setupChainScroll(){
  stage.querySelectorAll('.chain').forEach(function(chain){
    if(chain.dataset.scrollSet) return;
    chain.dataset.scrollSet='1';
    const fl=document.createElement('span'); fl.className='chain-fade l';
    const fr=document.createElement('span'); fr.className='chain-fade r';
    chain.append(fl,fr);
    /* overflow 是布局属性：只在初始化/resize 时算一次并缓存，
       绝不在 scroll 事件里重算，否则平滑滚动到末端瞬间测量抖动会让 has-scroll 翻转、箭头整体消失 */
    let overflow=false;
    function measure(){
      const sw=Math.ceil(chain.scrollWidth), cw=Math.ceil(chain.clientWidth);
      overflow = sw > cw + 1;
      chain.classList.toggle('has-scroll', overflow);
      update();
    }
    function update(){
      if(!overflow) return;
      const sl=Math.round(chain.scrollLeft), cw=Math.round(chain.clientWidth), sw=Math.round(chain.scrollWidth);
      chain.classList.toggle('at-start', sl <= 2);
      chain.classList.toggle('at-end', sl + cw >= sw - 2);
    }
    measure();
    chain.addEventListener('scroll', update, {passive:true});
    if(window.ResizeObserver) (new ResizeObserver(measure)).observe(chain);
    else window.addEventListener('resize', measure);
  });
}
function setupArticle(){
  progress.style.opacity='1';
  /* Convert first ｜-separated blockquote into chip row */
  (function(){
    const mbq = stage.querySelector('.art > blockquote:first-of-type');
    if(!mbq || !mbq.textContent.includes('｜')) return;
    const parts = mbq.textContent.split('｜').map(function(s){return s.trim();}).filter(Boolean);
    if(parts.length < 2) return;
    const row = document.createElement('div');
    row.className = 'meta-row';
    parts.forEach(function(p){
      const idx = p.indexOf('：');
      const chip = document.createElement('span');
      chip.className = 'meta-chip';
      chip.innerHTML = idx > 0 ? '<b>'+esc(p.slice(0,idx))+'</b>'+esc(p.slice(idx+1)) : esc(p);
      row.appendChild(chip);
    });
    mbq.replaceWith(row);
  })();
  const io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
  stage.querySelectorAll('.art h2,.art h3,.art .callout,.art .mermaid,.art figure.code,.art table').forEach(function(el){el.classList.add('reveal');io.observe(el);});
  const links = Array.from(spineNodes.querySelectorAll('.sp-node'));
  if(links.length){
    const map = {};
    stage.querySelectorAll('.art h2[id],.art h3[id]').forEach(function(h){ map[h.id]=h; });
    links.forEach(function(a){ a.onclick=function(){ const h=map[a.getAttribute('data-id')]; if(h) h.scrollIntoView({behavior: RM?'auto':'smooth', block:'start'}); }; });
    tocLinks = links; tocMap = map;
    layoutSpine();
    requestAnimationFrame(function(){ layoutSpine(); updateTimeline(); });
  }
  renderMermaid();
  setupMermaidDetails();
  setupChainScroll();
  bindAnchors();
  bindTableSort();
}
function setupMermaidDetails(){
  if(stage.dataset.mmDetailsBound) return;
  stage.dataset.mmDetailsBound='1';
  stage.addEventListener('toggle', function(e){
    const d = e.target;
    if(d.tagName !== 'DETAILS' || !d.open) return;
    const lazy = Array.from(d.querySelectorAll('.mermaid:not([data-mm-rendered])'));
    if(!lazy.length) return;
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ runMermaidOn(lazy); }); });
  }, true);
}
function bindAnchors(){
  stage.querySelectorAll('.art h2[id],.art h3[id]').forEach(function(h){
    if(h.querySelector('.anchor')) return;
    const a=document.createElement('a');
    a.className='anchor'; a.href='#'+h.id; a.textContent='#';
    a.title='复制锚点链接';
    a.onclick=function(e){
      e.preventDefault();
      const url=location.origin+location.pathname+'#'+h.id;
      // 只改 URL 不动 state：replaceState(null,…) 会清掉 {slug,vi}，导致侧键后退时
      // popstate 拿不到栈下标、退化成 indexOf（重复访问同一篇会定位错页）
      history.replaceState(history.state, '', url);
      navigator.clipboard.writeText(url).catch(function(){});
      a.textContent='✓'; setTimeout(function(){a.textContent='#';},900);
    };
    h.appendChild(a);
  });
}
function bindTableSort(){
  stage.querySelectorAll('.art table').forEach(function(table){
    const ths=Array.from(table.querySelectorAll('thead th'));
    if(!ths.length) return;
    ths.forEach(function(th, idx){
      th.style.cursor='pointer'; th.title='点击排序';
      th.addEventListener('click', function(){
        const tbody=table.querySelector('tbody');
        const rows=Array.from(tbody.querySelectorAll('tr'));
        const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
        ths.forEach(function(t){ delete t.dataset.dir; });
        th.dataset.dir=dir;
        rows.sort(function(a,b){
          const av=a.children[idx] ? a.children[idx].textContent.trim() : '';
          const bv=b.children[idx] ? b.children[idx].textContent.trim() : '';
          return dir==='asc' ? av.localeCompare(bv, 'zh') : bv.localeCompare(av, 'zh');
        });
        rows.forEach(function(r){ tbody.appendChild(r); });
      });
    });
  });
}

