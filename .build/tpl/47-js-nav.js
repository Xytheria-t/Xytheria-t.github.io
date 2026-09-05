// 导航模型（单一驱动源 = 浏览器历史，动此文件前先读 PITFALLS·导航）：go() 只 pushState({slug,vi})；
// popstate 用 e.state.vi 定位（indexOf 会在重复访问时跳错页）；replaceState 必须传 history.state（清 state = 静默白屏）；鼠标侧键不接管。
function setupWall(){
  const cards = stage.querySelectorAll('.vbody .ventry');
  cards.forEach(function(c,i){
    c.style.transitionDelay = (i*55)+'ms';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ c.classList.add('in'); }); });
    setTimeout(function(){ c.style.transitionDelay=''; }, 800 + i*55);
  });
}

function updateAccent(n){
  document.documentElement.style.setProperty('--accent', n.accent);
  document.documentElement.style.setProperty('--accent-ink', n.accentInk);
  if(n.id===ROOT_ID){ progress.style.opacity='0'; spine.classList.remove('show'); companion.classList.remove('show'); }
  else if(n.type==='moc'){ progress.style.opacity='0'; spine.classList.remove('show'); companion.classList.remove('show'); }
  else { progress.style.opacity='1'; spine.classList.add('show'); companion.classList.add('show'); }
}

let _transTimer = 0;
function transitionTo(slug){
  const n=NOTES[slug]; if(!n) return;
  recentPush(slug); // ponytail: localStorage['vinea.recent'] feeds the wall .recent dot
  // vi = 当前 Vinea 栈下标，随 state 一起入历史 —— popstate 靠它精确定位，不用 indexOf 猜
  // （同一篇可能被重复访问，indexOf 只会命中第一次出现的位置 → 后退会跳过中间直接回到很早的页）
  try{ window.history.replaceState({slug:slug, vi:idx},'', '#'+slug); }
  catch(e){ location.hash = slug; } // file:// 下失败则回退到 location.hash
  try{ localStorage.setItem('vinea:last', slug); }catch(e){} // ponytail: raw slug (no %-encoding) survives reload even when hash fragment is stripped
    pop.classList.remove('on');
  stage.style.opacity='0'; stage.style.transform='scale(1.03)'; stage.style.filter='blur(10px)';
  clearTimeout(_transTimer); // 取消上一次尚未执行的过渡，避免快速导航时多段 setTimeout 交错覆盖最终渲染
  _transTimer = setTimeout(function(){
    stage.innerHTML = n.type==='moc'?wallHTML(n):articleHTML(n);
    stage.style.transform='scale(.99)'; stage.style.filter='blur(2px)';
    requestAnimationFrame(function(){stage.style.opacity='1';stage.style.transform='none';stage.style.filter='none';});
    bind();
    if(n.type!=='moc') setupArticle(); else setupWall();
    updateAccent(n);
    _scrollAnchor = scrollMem[slug] || 0; jumpTo(_scrollAnchor); // 回到离开时的位置，不再回顶
    progress.style.transform='scaleX(0)';
  },300);
}

// 滚动位置记忆：离开某页时记 scrollY，back/fwd/双链跳回时恢复（不一律回顶）
const scrollMem = {};
let _scrollAnchor = null; // 本次导航的期望位置：mermaid svg 晚于恢复就位，渲染完若用户没手动滚则校正一次
function leave(){ scrollMem[hist[idx]] = window.scrollY; }
function jumpTo(y){
  const de = document.documentElement;
  const sb = de.style.scrollBehavior;
  de.style.scrollBehavior = 'auto'; // 覆盖 html{scroll-behavior:smooth}：恢复定位必须瞬时，不许平滑滑过整页
  window.scrollTo(0, y);
  de.style.scrollBehavior = sb;
}

// 导航驱动源 = 浏览器历史栈（Vinea 内部 hist[] 与其镜像同步）。
// 原先只 replaceState 不入栈 → 浏览器历史永远 1 条 → 侧键后退退化成「切标签页」（JS 拦不住）。
// 改：go() pushState 入历史，侧键/浏览器按钮交给原生导航，渲染统一由 popstate 驱动。
function go(slug){
  if(!NOTES[slug] || hist[idx]===slug) return; // 防重复入栈
  leave();
  hist=hist.slice(0,idx+1); hist.push(slug); idx++;
  try{ window.history.pushState({slug:slug, vi:idx},'', '#'+slug); }
  catch(e){ location.hash = slug; } // file:// 下 pushState 可能抛，退回 hash
  transitionTo(slug); // transitionTo 内 replaceState 仅同步 URL，不再入栈
}
// 侧键导航视觉反馈：方向箭头 + 目标标题，短暂浮现
let navHintT;
function showNavHint(dir, slug){
  const n=NOTES[slug]; if(!n) return;
  navHint.innerHTML='<span class="nh-arrow">'+(dir<0?'‹':'›')+'</span><span>'+(dir<0?'后退':'前进')+' · <b>'+esc(n.title)+'</b></span>';
  navHint.classList.add('show');
  clearTimeout(navHintT);
  navHintT=setTimeout(function(){ navHint.classList.remove('show'); }, 900);
}
// 不接管鼠标侧键：mousedown 里 preventDefault() 对 X1/X2 的拦截不可靠（浏览器/驱动差异），
// 一旦没拦住就会出现「JS 调 history.back() + 浏览器再退一级」= 一次按键退两级。
// 既然 go() 已 pushState（历史栈有内容），侧键完全交给浏览器原生导航，
// Vinea 只通过下面的 popstate 渲染 —— 单一驱动源，不可能双导航。
// （原 back()/fwd() 已无调用者，删；需要键盘/UI 入口时两行即可加回。）

// 统一渲染入口：浏览器历史变化（侧键 / 浏览器前后退按钮 / 手改 hash）→ 对齐 Vinea 栈 + 渲染。
// 边界：slug 不在 Vinea 栈内或已在当前页 → 直接 return，绝不破坏栈（原「安全兜底」语义保留）。
window.addEventListener('popstate', function(e){
  const slug = (e.state && e.state.slug) ? e.state.slug : _decodeHash();
  if(!slug || !NOTES[slug]) return;
  // 定位优先用 state.vi（入历史时记下的栈下标，精确）；缺失或越界才退化到 indexOf
  let i = (e.state && typeof e.state.vi === 'number') ? e.state.vi : -1;
  if(i < 0 || i >= hist.length || hist[i] !== slug) i = hist.indexOf(slug);
  if(i === -1 || i === idx) return; // 不在栈内 / 已在当前页 → 忽略
  const dir = i < idx ? -1 : 1;
  leave(); idx = i;
  showNavHint(dir, slug); // 方向由新旧 idx 推出，不用猜浏览器是前进还是后退
  transitionTo(slug);
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){ go(ROOT_ID); return; }
});
let _toastEl, _toastT;
function toast(msg){
  if(!_toastEl){ _toastEl=document.createElement('div'); _toastEl.id='toast'; document.body.appendChild(_toastEl); }
  _toastEl.textContent=msg; _toastEl.classList.add('on');
  clearTimeout(_toastT); _toastT=setTimeout(function(){ _toastEl.classList.remove('on'); }, 2400);
}
cpPrev.onclick=function(){ jumpSection(-1); };
cpNext.onclick=function(){ jumpSection(1); };
window.addEventListener('resize', layoutSpine);
function layoutSpine(){
  if(!tocLinks.length) return;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  const denom = total > 0 ? total : 1;
  tocLinks.forEach(function(a){
    const h = tocMap[a.getAttribute('data-id')];
    if(!h) return;
    const top = h.getBoundingClientRect().top + window.scrollY;
    const pct = Math.max(0, Math.min(1, top/denom));
    a.style.top = (pct*100) + '%';
  });
}
function jumpSection(dir){
  if(!tocLinks.length) return;
  let cur = -1;
  tocLinks.forEach(function(l,i){ if(l.classList.contains('active')) cur=i; });
  let ni = cur + dir;
  if(cur === -1) ni = dir > 0 ? 0 : tocLinks.length - 1;
  ni = Math.max(0, Math.min(tocLinks.length - 1, ni));
  const h = tocMap[tocLinks[ni].getAttribute('data-id')];
  if(h) h.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
}
function updateTimeline(){
  const h=document.documentElement;
  const max=h.scrollHeight-h.clientHeight;
  const p= max>0 ? h.scrollTop/max : 0;
  progress.style.transform='scaleX('+p.toFixed(4)+')';
  let active=null;
  for(const l of tocLinks){
    const hd=tocMap[l.getAttribute('data-id')]; if(!hd) continue;
    const r=hd.getBoundingClientRect();
    const passed=r.top<=120;
    l.classList.toggle('passed', passed);
    if(passed) active=l; // 最后一个越过上边界的标题 = 当前所在节
  }
  if(!active && tocLinks.length && window.scrollY < 200) active = tocLinks[0]; // 顶部未滚动时默认第一节
  tocLinks.forEach(function(l){ l.classList.toggle('active', l===active); });
  // 章节进度环：已读节数 / 总节数 → strokeDashoffset
  const read = tocLinks.filter(function(l){ return l.classList.contains('passed') || l===active; }).length;
  const ratio = tocLinks.length ? read / tocLinks.length : 0;
  cpRingBar.style.strokeDashoffset = (CP_C * (1 - ratio)).toFixed(2);
  if(spineFill){
    let fh = p*100;
    if(active){
      const t = parseFloat(active.style.top) || 0;
      if(t>0 && t<100) fh = t;
    }
    spineFill.style.height = fh + '%';
  }
  if(active && companion && NOTES[hist[idx]]?.type !== 'moc'){
    const sec = tocLinks.indexOf(active); // 注意别写成 idx —— 那是历史栈指针
    cpTitle.innerHTML = '<b>'+(sec+1)+'/'+tocLinks.length+'</b> '+esc(active.getAttribute('data-t'));
    cpPrev.disabled = sec<=0;
    cpNext.disabled = sec>=tocLinks.length-1;
    companion.classList.add('show');
  } else if(companion){
    companion.classList.remove('show');
  }
}
let _tlRaf = 0;
window.addEventListener('scroll', function(){ if(_tlRaf) return; _tlRaf = requestAnimationFrame(function(){ _tlRaf = 0; updateTimeline(); }); });

const _decodeHash = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch(e){ return location.hash.slice(1); } };
const _hslug = _decodeHash();
const startId = (_hslug && NOTES[_hslug]) ? _hslug
  : (() => { try { const l = localStorage.getItem('vinea:last'); return (l && NOTES[l]) ? l : ROOT_ID; } catch(e){ return ROOT_ID; } })();
