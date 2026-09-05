// 构建注入点在本文件：NOTES 与 ROOT_ID 两个占位符由 build.mjs replace，别处出现占位符字面量会抢占替换（build 已有兜底断言）。hist 是浏览器历史栈的镜像（模型见 47-js-nav.js）。
const NOTES = /*__NOTES__*/;
const ROOT_ID = /*__ROOT__*/;
const stage = document.getElementById('stage');
const progress = document.getElementById('progress');
const spine = document.getElementById('spine');
const spineNodes = spine.querySelector('.spine-nodes');
const spineFill = spine.querySelector('.spine-fill');
const companion = document.getElementById('companion');
const cpTitle = document.getElementById('cpTitle');
const cpPrev = document.getElementById('cpPrev');
const cpNext = document.getElementById('cpNext');
const cpRing = document.getElementById('cpRing');
const cpRingBar = cpRing.querySelector('.cr-bar');
const CP_C = 2 * Math.PI * 15.5; // 周长，配合 strokeDashoffset 表示已读比例
cpRingBar.style.strokeDasharray = CP_C;
cpRingBar.style.strokeDashoffset = CP_C;
let tocLinks = [], tocMap = {};
const pop = document.getElementById('pop');
const navHint = document.getElementById('navHint');
const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches; // 触屏无 hover：预览气泡/halo/磁吸只属鼠标
let hist = [ROOT_ID], idx = 0;

function esc(s){return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function attr(s){return esc(s).replace(/"/g,'&quot;');}

