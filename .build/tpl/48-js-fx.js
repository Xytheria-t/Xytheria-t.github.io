// 交互层接线：ripple / halo / 磁吸 / 磁贴指针跟随光晕（更新卡内 --mx/--my，rAF 节流，换卡离场复位居中）。
// FINE_HOVER 闸门之前只挂 ripple——halo/磁吸/光晕属鼠标语言，别提到闸门前（vm 沙箱无这些全局，提到闸门前 verify 会挂）。
/* ===== interaction layer wiring (delegated; survives every transition) ===== */
(function fx(){
  if(RM) return;                       // ponytail: one guard, skip all FX for reduced-motion

  // ink ripple on any interactive tap (delegated) — 鼠标/触屏通用（触屏拿它当点按反馈）
  function spawnRipple(e){
    const t = e.target.closest('.ventry,button,.copy-btn,.branch-card,.callout');
    if(!t || t.getBoundingClientRect().width === 0) return;
    const r = t.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2.2;
    const c = getComputedStyle(t).getPropertyValue('--c') || getComputedStyle(t).getPropertyValue('--mc');
    const span = document.createElement('span');
    span.className = 'ripple';
    if(c) span.style.setProperty('--c', c.trim());
    span.style.width = span.style.height = d + 'px';
    span.style.left = (e.clientX - r.left) + 'px';
    span.style.top = (e.clientY - r.top) + 'px';
    if(getComputedStyle(t).position === 'static') t.style.position = 'relative';
    t.appendChild(span);
    setTimeout(function(){ span.remove(); }, 600);
  }
  stage.addEventListener('pointerdown', spawnRipple, true);

  if(!FINE_HOVER) return;              // 触屏（无 hover）：halo/磁吸只属鼠标语言，到此为止
  const halo = document.getElementById('halo');
  let raf = 0, lx = 0, ly = 0, hoverEl = null;

  // pointer halo position/size (rAF-throttled, single delegated listener)
  // ponytail: elementFromPoint + closest 是整帧最贵的一步（大文档上千节点）。
  // 指针移动不足 8px 就不重查命中 —— 微抖动/静止时零 hit-test，视觉上无差别。
  let hitX = -1e4, hitY = -1e4, lastHot = null;
  window.addEventListener('pointermove', function(e){
    lx = e.clientX; ly = e.clientY;
    if(halo){ halo.style.left = lx+'px'; halo.style.top = ly+'px'; }
    if(raf) return;
    raf = requestAnimationFrame(function(){
      raf = 0;
      if(Math.abs(lx - hitX) < 8 && Math.abs(ly - hitY) < 8) return; // 没挪动够，沿用上次结果
      hitX = lx; hitY = ly;
      const f = document.elementFromPoint(lx, ly);
      const hot = f && f.closest ? f.closest('a,button,.ms-b,.copy-btn,.branch-card,.callout,[data-target]') : null;
      if(hot !== lastHot){
        lastHot = hot;
        if(halo) halo.classList.toggle('big', !!hot); // 只在「命中结果变了」才碰 DOM
      }
    });
  }, {passive:true});
  window.addEventListener('pointerdown', function(){ if(halo) halo.classList.add('on'); });
  window.addEventListener('pointerup',   function(){ if(halo) halo.classList.remove('on'); });
  document.addEventListener('pointerleave', function(){ if(halo) halo.classList.remove('on'); });

  // magnetic pull on small controls (delegated; auto-applies to freshly rendered wall)
  stage.addEventListener('pointermove', function(e){
    const el = e.target.closest('#cpPrev,#cpNext,.copy-btn');
    if(hoverEl && hoverEl !== el) { hoverEl.style.transform = ''; hoverEl = null; }
    if(!el) return;
    hoverEl = el;
    const r = el.getBoundingClientRect();
    el.style.transform = 'translate(' + ((e.clientX - r.left - r.width/2) * 0.22) + 'px,'
                                + ((e.clientY - r.top - r.height/2) * 0.22) + 'px)';
  });
  stage.addEventListener('pointerleave', function(){ if(hoverEl){ hoverEl.style.transform=''; hoverEl=null; } });

  // 磁贴指针跟随光晕：更新卡内 --mx/--my（背景 tint 与 hover sheen 共用），换卡/离场复位居中
  let sheenEl = null, sheenRaf = 0, sx = 0, sy = 0;
  stage.addEventListener('pointermove', function(e){
    const el = e.target.closest('.ventry');
    sx = e.clientX; sy = e.clientY;
    if(sheenEl && sheenEl !== el){
      sheenEl.style.setProperty('--mx','50%'); sheenEl.style.setProperty('--my','50%'); sheenEl = null;
    }
    if(!el) return;
    sheenEl = el;
    if(sheenRaf) return;
    sheenRaf = requestAnimationFrame(function(){
      sheenRaf = 0;
      if(!sheenEl) return;
      const r = sheenEl.getBoundingClientRect();
      sheenEl.style.setProperty('--mx', ((sx - r.left) / r.width * 100).toFixed(1) + '%');
      sheenEl.style.setProperty('--my', ((sy - r.top) / r.height * 100).toFixed(1) + '%');
    });
  }, {passive:true});
  stage.addEventListener('pointerleave', function(){
    if(sheenRaf){ cancelAnimationFrame(sheenRaf); sheenRaf = 0; }
    if(sheenEl){ sheenEl.style.setProperty('--mx','50%'); sheenEl.style.setProperty('--my','50%'); sheenEl = null; }
  });
})();
