// 交互绑定（每次渲染后重跑）。[data-target] 统一 stopPropagation 防嵌套双 go()；[[双链]] hover 预览是必保 feature。
function bind(){
  // stopPropagation：防 data-target 嵌套时外层卡再触发一次 go()
  stage.querySelectorAll('[data-target]').forEach(function(el){ el.onclick=function(e){ e.stopPropagation(); go(el.getAttribute('data-target')); }; });
  stage.querySelectorAll('a.wikilink:not(.broken)').forEach(function(el){ el.onclick=function(){go(el.getAttribute('data-target'));}; });
  // 封面卷色带 — 点击滚到对应卷带；hover/focus 暂停轮播并切到该段；离开后立即跳到下一段继续；静止 2.2s 自动轮播
  const cmCap = stage.querySelector('#cm-caption');
  const cmRail = stage.querySelector('.cover-mosaic .cm-rail');
  const cmTiles = stage.querySelectorAll('.cover-mosaic [data-band]');
  if(cmCap && cmTiles.length){
    if(!stage.__cm) stage.__cm = { idx: 0, paused: false, tok: 0 };
    const S = stage.__cm; S.paused = false;
    function showCap(b){
      if(!b) return;
      const newName = b.getAttribute('data-name') || '';
      const myTok = ++S.tok;
      const c = (b.style && b.style.getPropertyValue ? b.style.getPropertyValue('--cc') : '') || '';
      // 色带同步激活态（文字未变也要更新，故放在 early return 之前）
      stage.querySelectorAll('.cover-mosaic [data-band]').forEach(function(t){
        t.classList.toggle('cm-on', t === b);
      });
      const cap = stage.querySelector('#cm-caption');
      if(!cap) return;
      if(newName === cap.textContent) return;
      cap.style.opacity = '0';
      setTimeout(function(){
        if(myTok !== S.tok) return;
        const cap2 = stage.querySelector('#cm-caption');
        if(!cap2) return;
        cap2.textContent = newName;
        if(c) cap2.style.setProperty('--cnow', c.trim());
        cap2.style.opacity = '1';
      }, 180);
    }
    function cmTick(){
      if(S.paused) return;
      const tiles = stage.querySelectorAll('.cover-mosaic [data-band]');
      if(!tiles.length) return;
      S.idx = (S.idx + 1) % tiles.length;
      showCap(tiles[S.idx]);
    }
    cmTiles.forEach(function(b, bi){
      b.onclick = function(){
        const t = document.getElementById(b.getAttribute('data-band'));
        if(t) t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block:'start' });
      };
      b.addEventListener('mouseenter', function(){ S.paused = true; S.idx = bi; showCap(b); });
      b.addEventListener('focus', function(){ S.paused = true; S.idx = bi; showCap(b); });
      b.addEventListener('blur', function(){ S.paused = false; });
    });
    if(cmRail) cmRail.addEventListener('mouseleave', function(){
      S.paused = false;
      const tiles = stage.querySelectorAll('.cover-mosaic [data-band]');
      S.idx = (S.idx + 1) % Math.max(tiles.length, 1);
      if(tiles.length) showCap(tiles[S.idx]);
    });
    // interval 只启动一次（多次 bind 不重复跑）
    if(!stage.__cmTimer && !RM) stage.__cmTimer = setInterval(cmTick, 2200);
    showCap(cmTiles[0]);   // 初始：第一段即激活态（文字已相同，只落激活样式）
  }
  bindMastery();
  bindPop();
  bindCopy();
}

/* mastery buttons on an article: click to set, click 清除 to clear */
function bindMastery(){
  stage.querySelectorAll('.ms').forEach(function(box){
    const id = box.getAttribute('data-ms');
    function clear(){
      masterySet(id, null);
      box.querySelectorAll('.ms-b').forEach(function(o){ o.classList.remove('on'); });
      box.classList.add('unrated');
    }
    box.querySelectorAll('button.ms-b').forEach(function(b){
      b.addEventListener('click', function(e){
        e.stopPropagation();
        const k = b.getAttribute('data-k');
        if(b.classList.contains('on')){
          clear();
        } else {
          masterySet(id, k);
          box.querySelectorAll('.ms-b').forEach(function(o){ o.classList.toggle('on', o===b); });
          box.classList.remove('unrated');
        }
      });
    });
  });
}

function bindPop(){
  if(!FINE_HOVER) return; // 触屏：点按直达正文，hover 预览气泡只绑给鼠标（否则点按时 mouseenter 会闪出气泡）
  stage.querySelectorAll('a.wikilink:not(.broken)').forEach(function(a){
    const t = NOTES[a.getAttribute('data-target')];
    if(!t) return;
    a.addEventListener('mouseenter', function(){
      pop.innerHTML = '<div class="pop-t">'+esc(t.title)+'</div><div class="pop-x">'+esc(t.excerpt||'')+'</div>';
      const r = a.getBoundingClientRect();
      // 水平：贴右边界夹回视口内
      let left = r.left;
      if(left + 276 > window.innerWidth) left = window.innerWidth - 284;
      if(left < 8) left = 8;
      // 垂直：默认挂链接下方；下方塞不下就翻到上方，两边都不够就贴底 8px。
      // 不翻的话，文章末尾几个双链的预览会整个落到视口外，等于没出。
      const ph = pop.offsetHeight; // pop 无 display:none，可直接量
      let top = r.bottom + 8;
      if(top + ph > window.innerHeight - 8) top = r.top - ph - 8;
      if(top < 8) top = Math.max(8, window.innerHeight - ph - 8);
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      pop.classList.add('on');
    });
    a.addEventListener('mouseleave', function(){ pop.classList.remove('on'); });
  });
}

const COPY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';
function bindCopy(){
  stage.querySelectorAll('figure.code').forEach(function(pre){
    const head = pre.querySelector('.code-head') || pre;
    const btn = document.createElement('button');
    btn.className = 'copy-btn'; btn.type = 'button';
    btn.innerHTML = COPY_SVG + '<span class="ct">复制</span>';
    btn.onclick = function(e){
      e.stopPropagation();
      const txt = pre.querySelector('.code-body code').innerText;
      navigator.clipboard.writeText(txt).then(function(){
        btn.classList.add('ok'); btn.innerHTML = CHECK_SVG + '<span class="ct">已复制</span>';
        setTimeout(function(){ btn.classList.remove('ok'); btn.innerHTML = COPY_SVG + '<span class="ct">复制</span>'; }, 1400);
      }).catch(function(){
        btn.innerHTML = '<span class="ct">复制失败</span>';
        setTimeout(function(){ btn.innerHTML = COPY_SVG + '<span class="ct">复制</span>'; }, 1400);
      });
    };
    head.appendChild(btn);
  });
}

