// mermaid 外置 vendor/ 懒加载（不内联、不 CDN）。预处理注入（direction 等）必须插在首行图类型声明之后——插在前面 detectType 全站挂（PITFALLS）。
/* mermaid: 外置到 vendor/mermaid.min.js，运行时按需懒加载（首次渲染含图笔记才拉取，不用 CDN） */
let _mmLoading = null;
function ensureMermaid(){
  if(window.mermaid && window.mermaid.__vineaReady) return Promise.resolve(window.mermaid);
  if(_mmLoading) return _mmLoading;
  _mmLoading = new Promise(function(res, rej){
    const s = document.createElement('script');
    s.src = 'vendor/mermaid.min.js';
    s.onload = function(){
      // ponytail: initMermaid (~80-120ms) 推到 requestIdleCallback，让首屏纯文笔记不再被卡
      const go = function(){
        try { initMermaid(window.mermaid); } catch(e){ console.warn('mermaid init fail:', e); }
        res(window.mermaid);
      };
      if(window.requestIdleCallback) requestIdleCallback(go, { timeout: 800 });
      else setTimeout(go, 50);
    };
    s.onerror = function(){ rej(new Error('mermaid load failed: vendor/mermaid.min.js')); };
    document.head.appendChild(s);
  });
  return _mmLoading;
}
// initialize() 只需调一次（重复调用会重置主题/样式）；放在加载完成时执行
function initMermaid(mm){
  const cs = getComputedStyle(document.documentElement);
  const accent = (cs.getPropertyValue('--accent').trim()) || '#C9B08A';
  const accentInk = (cs.getPropertyValue('--accent-ink').trim()) || '#8A6D3B';
  const hexMix = function(c,w){
    const h = c.replace('#','');
    return '#' + [0,2,4].map(function(i){ return Math.round(parseInt(h.slice(i,i+2),16)*(1-w)+255*w).toString(16).padStart(2,'0'); }).join('');
  };
  const light = function(c){ return hexMix(c, 0.88); };
  mm.initialize({ startOnLoad:false, theme:'base', securityLevel:'loose',
    flowchart:{ curve:'linear', nodeSpacing:64, rankSpacing:72, padding:20, htmlLabels:true, useMaxWidth:true, wrap:true },
    classDiagram:{ padding:3, htmlLabels:false, dividerMargin:1, useMaxWidth:true, nodeSpacing:28, rankSpacing:32, diagramPadding:8 },
    gantt:{ useMaxWidth:true, barHeight:20, barGap:6, topPadding:38, leftPadding:92, gridLineStartPadding:52, fontSize:13, sectionFontSize:13, numberSectionStyles:2, displayMode:'compact' },
    themeVariables:{ fontFamily:'"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,-apple-system,sans-serif',
      fontSize:14, primaryColor:light(accent), primaryBorderColor:accent, primaryTextColor:'#211D17',
      lineColor:accentInk, secondaryColor:light(accent), tertiaryColor:'#FBF9F5',
      edgeLabelBackground:'#FBF9F5', clusterBkg:light(accent), clusterBorder:accent, titleColor:'#211D17',
      taskBkgColor:light(accent), taskBorderColor:accent, taskTextColor:'#211D17', taskTextLightColor:'#fff', taskTextOutsideColor:'#211D17',
      gridColor:accent, gridBorderColor:accent,
      sectionBkgColor:light(accent), sectionBkgColor2:light(accent), altSectionBkgColor:light(accent),
      excludedTaskBkgColor:'#EFEAE0', excludedTaskBorderColor:'#D9D1C4',
      activeTaskBkgColor:accentInk, activeTaskBorderColor:accentInk,
      doneTaskBkgColor:light(accent), doneTaskBorderColor:accent, doneTaskTextColor:'#211D17',
      critTaskBkgColor:'#F2A9A9', critTaskBorderColor:'#D45454',
      todayColor:accent } });
  mm.__vineaReady = true;
}
function renderMermaid(){
  const all = Array.from(stage.querySelectorAll('.mermaid:not([data-mm-rendered])'));
  const visible = all.filter(function(n){ const d=n.closest('details'); return !d || d.open; });
  runMermaidOn(visible);
}
let _mmId = 0; // 全局自增：多次 runMermaidOn（首屏 + 每次展开 details）不能复用同一 render id
function runMermaidOn(nodes){
  if(!nodes || !nodes.length) return;
  // 失败必须显性化：只留源码文本会被当成「图还没加载出来」，.mm-err 角标 + title 带上原因
  const fail = function(n, e){
    const msg = (e && e.message) || e;
    n.classList.add('mm-err'); n.title = 'Mermaid 渲染失败：' + msg;
    console.warn('mermaid render fail:', msg);
  };
  ensureMermaid().then(function(mm){
    // v11 run() 对 classDiagram DOM textContent 解析有兼容问题；统一用 render()
    Promise.all(Array.from(nodes).map(function(n){
      let code = n.textContent.trim();
      // direction 必须插在 classDiagram 声明行【之后】：mermaid 靠 /^\s*classDiagram/ 判定图类型，
      // 插到首行会让 detectType 整个失灵 → 解析抛错 → 只剩源码文本（曾全站 classDiagram 静默挂掉）
      if(code.startsWith('classDiagram') && !/^\s*direction\s+(TB|LR|BT|RL)\b/m.test(code)){
        const nl = code.indexOf('\n');
        code = nl < 0 ? code + '\ndirection LR'
                      : code.slice(0, nl) + '\ndirection LR' + code.slice(nl);
      }
      return mm.render('mm'+(++_mmId), code)
        .then(function(r){ n.innerHTML = r.svg; n.dataset.mmOk='1'; })
        .catch(function(e){ fail(n, e); });
    })).then(function(){
      nodes.forEach(function(n){ if(n.dataset.mmOk) n.dataset.mmRendered='1'; });
      enrichMermaid(); layoutSpine();
      // svg 注入改变文档高度晚于导航恢复：若用户尚未手动滚动（距目标 <60px）则按原位置校正一次
      if(_scrollAnchor !== null && Math.abs(window.scrollY - _scrollAnchor) < 60) jumpTo(_scrollAnchor);
      _scrollAnchor = null;
    });
  }).catch(function(e){ Array.from(nodes).forEach(function(n){ fail(n, e); }); });
}
// 按 diagram 类型分派增强；任何单类型的增强失败都用 try 兜住，绝不拖垮渲染
function enrichMermaid(){
  stage.querySelectorAll('.mermaid svg').forEach(function(svg){
    const wrap = svg.parentElement;
    if(wrap.dataset.enriched) return;
    wrap.dataset.enriched = '1';
    const type = (wrap.dataset.mmType || 'flowchart');
    try {
      if (type === 'sequenceDiagram') enrichSequence(svg, wrap);
      else if (type === 'quadrantChart') applyEntrance(svg, '.point');
      else if (type === 'timeline') applyEntrance(svg, '.section');
      else if (type === 'pie') applyEntrance(svg, '.slice');
      // ponytail: 类图不做 hover 高亮——只有 2 个节点 1 条边，dim 相邻节点没有信息量，
      // 且鼠标在节点与边标签（handler）之间移动会反复 toggle flow-dim，边标签闪烁
      else if (type !== 'classDiagram') enrichGraph(svg, wrap, type === 'flowchart' ? /execute task|开始|start/ : null); // flowchart/state/er/mindmap
    } catch (e) { /* 单图增强异常不影响其它图 */ }
  });
}
// graph 类（flowchart / stateDiagram-v2 / classDiagram / erDiagram / mindmap）：节点浮入 + hover 高亮相邻节点与边
function enrichGraph(svg, wrap, startRegex){
  const nodes = Array.from(svg.querySelectorAll('.node'));
  const edges = Array.from(svg.querySelectorAll('.edgePath, .edgePaths .edgePath, .transition'));
  if (startRegex) {
    const start = nodes.find(function(n){ const txt = (n.textContent || '').toLowerCase(); return startRegex.test(txt); });
    if (start) start.classList.add('flow-start');
  }
  const nodeIndex = new Map();
  nodes.forEach(function(n,i){ nodeIndex.set(n,i); n.dataset.idx=i; n.style.animationDelay=(i*70)+'ms'; });
  const nodeEdges = new Map();
  nodes.forEach(function(n){ nodeEdges.set(n,{in:[],out:[]}); });
  edges.forEach(function(e){
    const path = e.querySelector('path');
    if(!path) return;
    const d = path.getAttribute('d') || '';
    const pts = parsePathPoints(d);
    if(pts.length < 2) return;
    let src=null, dst=null, srcDist=Infinity, dstDist=Infinity;
    nodes.forEach(function(n){ const r=n.getBBox(); const c={x:r.x+r.width/2,y:r.y+r.height/2}; const a=pts[0], b=pts[pts.length-1];
      const da=Math.hypot(a.x-c.x,a.y-c.y), db=Math.hypot(b.x-c.x,b.y-c.y);
      if(da<srcDist){srcDist=da;src=n;} if(db<dstDist){dstDist=db;dst=n;}
    });
    if(src && dst){ e.dataset.from = src.dataset.idx; e.dataset.to = dst.dataset.idx; nodeEdges.get(src).out.push(e); nodeEdges.get(dst).in.push(e); }
  });
  function highlight(root, active){
    wrap.classList.toggle('flow-dim', active);
    nodes.forEach(function(n){ n.classList.toggle('active', false); });
    edges.forEach(function(e){ e.classList.toggle('active', false); });
    if(!active || !root) return;
    const seenNodes = new Set([root]), seenEdges = new Set();
    let frontier = [root];
    while(frontier.length){
      const next = [];
      frontier.forEach(function(n){
        nodeEdges.get(n).out.forEach(function(e){ const t = nodes[parseInt(e.dataset.to,10)]; if(t && !seenNodes.has(t)){ seenNodes.add(t); seenEdges.add(e); next.push(t); } });
        nodeEdges.get(n).in.forEach(function(e){ seenEdges.add(e); });
      });
      frontier = next;
    }
    seenNodes.forEach(function(n){ n.classList.add('active'); });
    seenEdges.forEach(function(e){ e.classList.add('active'); });
  }
  nodes.forEach(function(n){
    n.addEventListener('mouseenter', function(){ highlight(n, true); });
    n.addEventListener('mouseleave', function(){ highlight(null, false); });
    n.addEventListener('focus', function(){ highlight(n, true); });
    n.addEventListener('blur', function(){ highlight(null, false); });
    n.style.cursor = 'pointer';
  });
  wrap.addEventListener('mouseleave', function(){ highlight(null, false); });
}
// sequenceDiagram：hover 角色 → 高亮其参与的消息线
function enrichSequence(svg, wrap){
  const actors = Array.from(svg.querySelectorAll('.actor'));
  // v11 实际生成的是 messageLine0（实线）/ messageLine1（虚线），没有 messageLine
  const lines = Array.from(svg.querySelectorAll('.messageLine0,.messageLine1'));
  if(!actors.length) return;
  actors.forEach(function(a,i){ a.style.animationDelay=(i*70)+'ms'; });
  lines.forEach(function(l,i){ if(!l.style.animationDelay) l.style.animationDelay=(i*70)+'ms'; });
  function centerX(el){ const b = el.getBBox ? el.getBBox() : null; return b ? b.x + b.width/2 : 0; }
  function highlight(actor, on){
    wrap.classList.toggle('flow-dim', on);
    actors.forEach(function(a){ a.classList.toggle('active', false); });
    lines.forEach(function(l){ l.classList.toggle('active', false); });
    if(!on || !actor) return;
    actor.classList.add('active');
    const ax = centerX(actor);
    // 判定「该角色是这条消息的端点」：角色中心落在消息线的横向跨度内。
    // 旧的「|中点-角色中心| < 半宽+36」对每条消息都对两端成立，会把所有线全高亮。
    lines.forEach(function(l){
      const b = l.getBBox ? l.getBBox() : null; if(!b) return;
      if(ax >= b.x - 24 && ax <= b.x + b.width + 24) l.classList.add('active');
    });
  }
  actors.forEach(function(a){
    a.addEventListener('mouseenter', function(){ highlight(a, true); });
    a.addEventListener('mouseleave', function(){ highlight(null, false); });
    a.addEventListener('focus', function(){ highlight(a, true); });
    a.addEventListener('blur', function(){ highlight(null, false); });
    a.style.cursor = 'pointer';
  });
  wrap.addEventListener('mouseleave', function(){ highlight(null, false); });
}
