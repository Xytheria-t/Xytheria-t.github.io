import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';
// 走 core + 显式 registerLanguage，避开默认全量加载；只注册实际笔记用到的 22 种（含别名）。
// language 文件已物理瘦身：lib/languages/ 只保留白名单 15 个文件，node_modules 8.4M → 4.2M
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import xml from 'highlight.js/lib/languages/xml';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';
import properties from 'highlight.js/lib/languages/properties';
import plaintext from 'highlight.js/lib/languages/plaintext';
hljs.registerLanguage('bash', bash); hljs.registerLanguage('sh', bash); // sh 别名同 bash
hljs.registerLanguage('c', c); hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('xml', xml); hljs.registerLanguage('html', xml); // html 别名同 xml
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript); hljs.registerLanguage('js', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('sql', sql); hljs.registerLanguage('mysql', sql); // mysql 别名同 sql
hljs.registerLanguage('typescript', typescript); hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('properties', properties);
hljs.registerLanguage('plaintext', plaintext); hljs.registerLanguage('text', plaintext); hljs.registerLanguage('plain', plaintext);
// ponytail:toml/text 未注册 —— highlight.js v11 没自带 toml；text 走 plaintext。tpl.html 上 .code[data-lang="toml"]
// 的高亮会静默退化成等宽文本（hljs.getLanguage 返 null → build.mjs L120 走 _esc raw 路径），不算 FAIL。

const __DIR = dirname(fileURLToPath(import.meta.url)); // .build
const PROJ = resolve(__DIR, '..');
const ROOT = resolve(PROJ, 'notes');
const OUT = resolve(PROJ, 'reader.html');

// 鲜艳高饱和配色（用户明确要求）。色相分离 + 高饱和，不做莫兰迪降饱和处理。
const ACCENT = {
  root: '#FF9E1B',                  // 金橙 · Overview
  'java-collection': '#1DE9B6',     // 青绿 · Collections
  'javase': '#00E676',              // 翠绿 · JavaSE
  jvm: '#FF5252',                   // 珊瑚红 · JVM
  juc: '#7C4DFF',                   // 亮紫 · JUC
  architecture: '#FF6D00',          // 亮橙 · Architecture
  'system-design': '#FF6D00',       // 亮橙 · System Design
  network: '#00B0FF',               // 天蓝 · Network
  mysql: '#2979FF',                 // 亮蓝 · MySQL
  redis: '#FF1744',                 // 鲜红 · Redis
  leetcode: '#FFD600',              // 金黄 · LeetCode
  projects: '#FF4081',              // 玫红 · Projects
};
const ACCENT_INK = {
  root: '#C67100',
  'java-collection': '#00A37A',
  'javase': '#00A344',
  jvm: '#D32F2F',
  juc: '#5E35B1',
  architecture: '#C43E00',
  'system-design': '#C43E00',
  network: '#0081CB',
  mysql: '#1E5FD8',
  redis: '#C51162',
  leetcode: '#F5A600',
  projects: '#C60055',
};
const accentOf = (cat) => ACCENT[cat] || '#C9B08A';
const accentInkOf = (cat) => ACCENT_INK[cat] || '#8A6D3B';
const CAT_LABEL = { root:'Overview', 'java-collection':'Collections', 'javase':'JavaSE', jvm:'JVM', juc:'Concurrency', architecture:'Architecture', mysql:'MySQL', redis:'Redis', leetcode:'LeetCode', 'system-design':'System Design', projects:'Projects', network:'Network' };

// 卷（首页根墙分区）—— 数组顺序 = 卷序；cats 顺序 = 卷内位次
// layout = 卷目录带版式（4 种词汇表）：tiles 磁贴墙 / spread 对开页 / feature 大标页 / index 索引列表；缺省 tiles
const GROUP = [
  { num:'Ⅰ', name:'Java 语言',    cats:['javase','java-collection','jvm','juc'], layout:'tiles' },
  { num:'Ⅱ', name:'架构与系统设计', cats:['architecture','system-design','network'], layout:'spread' },
  { num:'Ⅲ', name:'数据存储',     cats:['mysql','redis'],                   layout:'feature' },
  { num:'Ⅳ', name:'算法',         cats:['leetcode'],                        layout:'index' },
  { num:'Ⅴ', name:'简历项目',     cats:['projects'],                        layout:'feature' },
];
const GROUP_OF = {};
GROUP.forEach(function(g, gi){
  g.cats.forEach(function(c, ci){
    GROUP_OF[c] = { index:gi, num:g.num, name:g.name, rank:ci, layout:g.layout || 'tiles' };
  });
});

// ---- walk ----
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = dir + '/' + e;
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (e.endsWith('.md')) out.push(p);
  }
  return out;
}

// ---- frontmatter ----
function parseFm(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > -1) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

const slugify = (s) => s.trim().toLowerCase().replace(/\s+/g, '-');

function extractExcerpt(body) {
  const clean = body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').replace(/^\s*#\s+[^\r\n]*\r?\n?/m, '');
  const lines = clean.split('\n');
  let inCode = false;
  for (const line of lines) {
    const trim = line.trim();
    if (trim.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    // 防御：墙卡描述从原始正文抽，会带未渲染的 [[xxx]]；剥成纯文本，免得墙上挂着死括号
    const t = trim.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => (alias || target).trim());
    if (!t || /^[#>|\-*\d]/.test(t) || t.startsWith('<')) continue;
    return t.length > 160 ? t.slice(0, 160) + '…' : t;
  }
  return '';
}

// mermaid 源码以纯文本形式存在 div 里，渲染时取 textContent 喂给 render()
const escapeMermaid = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---- highlight + line numbers ----
const unescape = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function highlightBlock(html) {
  return html.replace(
    /<pre><code class="language-(\w+)(?::([^\s"<>]+))?">([\s\S]*?)<\/code><\/pre>/g,
    (_, lang, title, code) => {
      const raw = unescape(code);
      let inner;
      if (hljs.getLanguage(lang)) {
        inner = hljs.highlight(raw, { language: lang }).value;
      } else {
        inner = _esc(raw);
      }
      const arr = inner.split('\n');
      while (arr.length > 1 && arr[arr.length - 1] === '') arr.pop();
      const lines = arr.map((l) => `<span class="ln">${l || ' '}</span>`).join('');
      const langName = (lang === 'text' || lang === 'plain') ? 'TEXT' : lang.toUpperCase();
      const titleHtml = title ? `<span class="code-sep">·</span><span class="code-title">${title}</span>` : '';
      const mini = arr.length <= 3 ? ' mini' : '';
      return `<figure class="code${mini}" data-lang="${lang}"><figcaption class="code-head">`
        + `<span class="code-sig">${lang.slice(0, 2).toUpperCase()}</span>`
        + `<span class="code-lang">${langName}</span>${titleHtml}<span class="spacer"></span>`
        + `</figcaption><div class="code-body"><pre><code>${lines}</code></pre></div>`
        + `<div class="code-foot"><span class="cf-plate">清单</span><span class="spacer"></span><span class="cf-meta">${arr.length} 行</span></div>`
        + `</figure>`;
    }
  );
}

const CALLOUT_LABEL = { note:'笔记', warning:'警告', tip:'提示', info:'信息', danger:'危险', important:'重点', caution:'注意', question:'疑问' };
const CALLOUT_ICON = {
  note:'<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/>',
  warning:'<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  tip:'<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.7.7 1 1.5 1 3h6c0-1.5.3-2.3 1-3a7 7 0 0 0-4-12z"/>',
  danger:'<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  caution:'<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  important:'<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
  question:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><path d="M12 17h.01"/>'
};

function buildCallout(type, firstP, rest) {
  const t = type.toLowerCase();
  const label = CALLOUT_LABEL[t] || (t.charAt(0).toUpperCase() + t.slice(1));
  const icon = CALLOUT_ICON[t] || CALLOUT_ICON.info;
  const tf = firstP.trim();
  let sub = tf, body = '';
  const cut = tf.indexOf('\n');
  if (cut > -1) { sub = tf.slice(0, cut).trim(); body = tf.slice(cut + 1).trim(); }
  const subHtml = sub ? `<div class="callout-sub">${sub}</div>` : '';
  const bodyHtml = body ? `<p>${body}</p>` : '';
  return `<div class="callout ${t}"><div class="ct"><svg class="ci" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>${label}</div>${subHtml}${bodyHtml}${rest}</div>`;
}

function transformCallouts(html) {
  // marked 会把嵌套 `>` 渲染成嵌套 <blockquote>。原实现在一层正则上吃掉了所有内层 callout。
  // 改为：反复替换「内部不含 <blockquote> 的最内层 callout」，每轮剥一层洋葱，直到稳定。
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 12) {
    changed = false;
    html = html.replace(
      /<blockquote>((?:(?!<blockquote>)[\s\S])*?)<\/blockquote>/g,
      (m, inner) => {
        const mm = /^\s*<p>\[!(\w+)\]([\s\S]*?)<\/p>([\s\S]*)$/.exec(inner);
        if (!mm) return m;
        changed = true;
        return buildCallout(mm[1], mm[2], mm[3]);
      }
    );
  }
  // 还存在的 <blockquote>（普通引用/非 callout）原样保留
  return html;
}

function renderMarkdown(body) {
  let html = marked.parse(body);
  html = transformCallouts(html);
  html = html.replace(
    /<pre><code class="language-chain">([\s\S]*?)<\/code><\/pre>/g,
    (_, code) => renderChain(unescape(code))
  );
  html = html.replace(
    /<pre><code class="language-branch">([\s\S]*?)<\/code><\/pre>/g,
    (_, code) => renderBranch(unescape(code))
  );
  html = html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_, code) => {
      const raw = unescape(code);
      const first = (raw.match(/^\s*([A-Za-z][\w-]*)/) || [, ''])[1];
      // 所有 mermaid 块都打上 data-mm-type（不只 details 内的），供 enrichMermaid 分派
      // 必须转义 < ：不转义的话 <<interface>> 会被 innerHTML 当成未知标签，textContent 只剩 <> ，注解丢失
      return `<div class="mermaid"${first ? ` data-mm-type="${first}"` : ''}>${escapeMermaid(raw)}</div>`;
    }
  );
  html = html.replace(
    /<pre><code class="language-gantt">([\s\S]*?)<\/code><\/pre>/g,
    (_, code) => renderGantt(unescape(code))
  );
  html = html.replace(
    /<details([^>]*)>\s*<summary([^>]*)>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g,
    (_, attr, sumAttr, summary, body) => transformDetails(attr, sumAttr, summary, body)
  );
  // 宽表（>5 列或任意列文本偏长）渲染时容易撑破 .art 的 84ch，套 .tbl 横向滚动容器
  html = html.replace(/<table>([\s\S]*?)<\/table>/g, '<div class="tbl"><table>$1</table></div>');
  html = autoLabelMermaid(html);
  html = highlightBlock(html);
  return html;
}

// 把「思维链路速查」整节包成可折叠 details（默认展开，h2 仍留在 summary 内供脊线抓取）
function foldThinking(html) {
  return html.replace(
    /(<h2>\s*思维链路速查\s*<\/h2>)([\s\S]*?)(?=<h2>|$)/,
    '<details class="think-fold" open><summary>$1</summary>$2</details>'
  );
}

// mermaid 类型 → 中文 <summary> 自动标签；占位/留空才自动填，作者写了具体 summary 则保留
const _MM_LABEL = {
  flowchart: '展开流程图', sequenceDiagram: '展开时序图',
  classDiagram: '展开类图', stateDiagram: '展开状态图', 'stateDiagram-v2': '展开状态图',
  erDiagram: '展开ER图', mindmap: '展开思维导图',
  quadrantChart: '展开象限图', timeline: '展开时间线',
  gantt: '展开甘特图', pie: '展开饼图',
};
const _MM_PLACEHOLDER = /^\s*(图|图示|图例|展开图|展开图示|展开图例|流程图|展开流程图|图表|展开图表)?\s*$/;
function autoLabelMermaid(html) {
  return html.replace(
    /<details\b([^>]*)>([\s\S]*?<summary>)([\s\S]*?)(<\/summary>)([\s\S]*?<div class="mermaid"([^>]*)>)([\s\S]*?)(<\/div>)([\s\S]*?)(<\/details>)/g,
    function (_, attr, pre, sum, post, pre2, divAttr, code, endDiv, tail, detailsEnd) {
      const m = divAttr.match(/data-mm-type="([^"]+)"/);
      const label = _MM_LABEL[m ? m[1] : ''];
      if (!label) return _; // 无法识别类型则原样保留，不破坏
      const newSum = _MM_PLACEHOLDER.test(sum) ? label : sum; // 占位/留空才自动填
      return '<details' + attr + '>' + pre + newSum + post + pre2 + code + endDiv + tail + detailsEnd;
    }
  );
}
// 通用入场动画（给非 flowchart 类型的节点/元素加 stagger 延迟，动画由 CSS 触发）
function applyEntrance(svg, sel) {
  svg.querySelectorAll(sel).forEach(function (n, i) { if (!n.style.animationDelay) n.style.animationDelay = (i * 60) + 'ms'; });
}

// ---- custom infographics (chain / branch) ----
const _esc = (s) => (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function renderChain(src) {
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);
  let steps;
  if (lines.length === 1 && lines[0].includes('→')) {
    steps = lines[0].split('→').map((s) => s.trim()).filter(Boolean).map((part) => {
      const m = part.match(/^(.+?)(?:\s*\|\s*(.+?))?$/);
      return m ? { title: m[1].trim(), caption: (m[2] || '').trim(), trigger: '' } : { title: part, caption: '', trigger: '' };
    });
  } else {
    steps = lines.map((line) => {
      const m = line.match(/^(.+?)(?:\s*\|\s*(.+?))?(?:\s*\|\s*(.+))?$/);
      return m ? { title: m[1].trim(), caption: (m[2] || '').trim(), trigger: (m[3] || '').trim() } : { title: line, caption: '', trigger: '' };
    });
  }
  if (!steps.length) return '';
  const hasCaption = steps.some(s => s.caption);
  const hasTrigger = steps.some(s => s.trigger);
  const stepHtml = (s, i) => `<div class="chain-step"><span class="chain-num">${String(i + 1).padStart(2, '0')}</span><div class="chain-t">${_esc(s.title)}${s.trigger ? ` <span class="chain-pill">${_esc(s.trigger)}</span>` : ''}</div>${s.caption ? `<div class="chain-c">${_esc(s.caption)}</div>` : ''}</div>`;
  const linkHtml = () => `<div class="chain-link"><div class="chain-rail"><span class="chain-line"></span><svg class="chain-arr" viewBox="0 0 12 12" aria-hidden="true"><polyline points="2,3 10,6 2,9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>`;
  const parts = [];
  for (let i = 0; i < steps.length; i++) {
    parts.push(stepHtml(steps[i], i));
    if (i < steps.length - 1) parts.push(linkHtml(steps[i]));
  }
  const chainCls = ['chain'];
  if (!hasCaption && !hasTrigger) chainCls.push('chain-simple');
  return `<div class="${chainCls.join(' ')}"><div class="chain-row">${parts.join('')}</div></div>`;
}

function renderBranch(src) {
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);
  const steps = [];
  const policies = [];
  for (const line of lines) {
    let m;
    if ((m = line.match(/^(\d+)\s*[\s:：.、)]\s*(.+?)(?:\s*\|\s*(.+))?$/))) {
      steps.push({ num: m[1], title: m[2].trim(), caption: (m[3] || '').trim() });
    } else if ((m = line.match(/^-\s*(.+?)(?:\s*\|\s*(.+?))(?:\s*\|\s*(.+))?$/))) {
      policies.push({ title: m[1].trim(), behavior: (m[2] || '').trim(), tag: (m[3] || '').trim() });
    }
  }
  const stepHtml = (s) => `<div class="branch-step"><span class="branch-num">${_esc(s.num)}</span><div class="branch-body"><div class="branch-t">${_esc(s.title)}</div>${s.caption ? `<div class="branch-c">${_esc(s.caption)}</div>` : ''}</div></div>`;
  const policyHtml = (p) => `<div class="branch-card"><div class="branch-h">${_esc(p.title)}</div><div class="branch-b">${_esc(p.behavior)}</div>${p.tag ? `<span class="branch-tag">${_esc(p.tag)}</span>` : ''}</div>`;
  const trigger = steps[0] ? stepHtml(steps[0]) : '';
  const hub = steps[1] ? stepHtml(steps[1]) : '';
  const grid = policies.length ? `<div class="branch-grid">${policies.map(policyHtml).join('')}</div>` : '';
  const stem = trigger + `<div class="branch-link-v"><span>触发</span></div>` + hub;
  return `<div class="branch"><div class="branch-stem">${stem}</div><div class="branch-join"></div><div class="branch-fan"></div>${grid}</div>`;
}

// ---- gantt (甘特图笔记法) — 阶段时间轴 / 日历时间轴双模式 ----
function renderGantt(src) {
  const _gEsc = (s) => _esc(s).replace(/"/g, '&quot;');
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);
  let title = '';
  let axis = [];
  const tasks = [];
  let section = '';
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d+d$/.test(v);
  const isUnit = (v) => /^\d+(\.\d+)?$/.test(v);
  const parseDate = (v) => {
    if (/^\d+d$/.test(v)) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(v, 10));
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return new Date(v + 'T00:00:00');
  };
  const fmtDate = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  for (const line of lines) {
    if (/^title\s+/i.test(line)) { title = line.replace(/^title\s+/i, '').trim(); continue; }
    if (/^axis\s+/i.test(line)) { axis = line.replace(/^axis\s+/i, '').split(/[,，]/).map((s) => s.trim()).filter(Boolean); continue; }
    if (/^section\s+/i.test(line)) { section = line.replace(/^section\s+/i, '').trim(); continue; }
    const m = line.match(/^(.+?)(?:\s+:(\w+))?\s+(\S+)\s+(\S+)\s*$/);
    if (!m) continue;
    const a = m[3].trim(), b = m[4].trim();
    if (isDate(a) && isDate(b)) {
      tasks.push({ name: _gEsc(m[1].trim()), status: (m[2] || '').toLowerCase(), section, mode: 'date', start: parseDate(a), end: parseDate(b), startStr: a, endStr: b });
    } else if (isUnit(a) && isUnit(b)) {
      tasks.push({ name: _gEsc(m[1].trim()), status: (m[2] || '').toLowerCase(), section, mode: 'stage', start: parseFloat(a), end: parseFloat(b), startStr: a, endStr: b });
    }
  }
  if (!tasks.length) return '<div class="gantt"><div class="gantt-title">' + _gEsc(title || '甘特图') + '</div><div class="gantt-empty">暂无数据</div></div>';

  const stageMode = tasks[0].mode === 'stage';
  let minT, maxT, range, leftOf, widthOf, ticks = [];
  if (stageMode) {
    const vals = tasks.flatMap((t) => [t.start, t.end]);
    minT = Math.min(...vals); maxT = Math.max(...vals);
    const pad = Math.max(0.5, (maxT - minT) * 0.05);
    minT -= pad; maxT += pad;
    range = maxT - minT;
    leftOf = (v) => ((v - minT) / range) * 100;
    widthOf = (s, e) => ((e - s) / range) * 100;
    const labels = axis.length ? axis : [];
    const n = labels.length || 5;
    for (let i = 0; i < n; i++) {
      const left = (i / Math.max(1, n - 1)) * 100;
      ticks.push({ left: Math.min(97, Math.max(3, left)), label: labels[i] || ('T' + (i + 1)) });
    }
  } else {
    const times = tasks.flatMap((t) => [t.start.getTime(), t.end.getTime()]);
    minT = Math.min(...times); maxT = Math.max(...times);
    const pad = Math.max(86400000, (maxT - minT) * 0.05);
    minT -= pad; maxT += pad;
    if (maxT <= minT) maxT = minT + 86400000 * 7;
    range = maxT - minT;
    leftOf = (d) => ((d.getTime() - minT) / range) * 100;
    widthOf = (s, e) => ((e.getTime() - s.getTime()) / range) * 100;
    const nTicks = 5;
    for (let i = 0; i < nTicks; i++) {
      const d = new Date(minT + (range * i / (nTicks - 1)));
      const left = Math.min(97, Math.max(3, (i / (nTicks - 1)) * 100));
      ticks.push({ left, label: fmtDate(d) });
    }
  }

  const sections = [];
  const secMap = new Map();
  for (const t of tasks) {
    if (!secMap.has(t.section)) {
      const sec = { name: t.section, tasks: [] };
      secMap.set(t.section, sec);
      sections.push(sec);
    }
    secMap.get(t.section).tasks.push(t);
  }

  let html = '<div class="gantt' + (stageMode ? ' gantt-stage' : '') + '">';
  if (title) html += '<div class="gantt-title">' + _gEsc(title) + '</div>';
  html += '<div class="gantt-head"><div class="gantt-label" aria-hidden="true"></div><div class="gantt-axis">';
  for (const tk of ticks) {
    html += '<span class="gantt-tick" style="left:' + tk.left.toFixed(1) + '%"><span class="gantt-tick-line"></span><span class="gantt-tick-label">' + _gEsc(tk.label) + '</span></span>';
  }
  html += '</div></div>';

  for (const sec of sections) {
    html += '<div class="gantt-row"><div class="gantt-label">' + _gEsc(sec.name || '') + '</div><div class="gantt-track">';
    for (const t of sec.tasks) {
      const left = leftOf(t.start), width = widthOf(t.start, t.end);
      const cls = 'gantt-bar' + (t.status ? ' s-' + t.status : '');
      const rangeStr = stageMode ? (t.startStr + ' → ' + t.endStr) : (t.startStr + ' ~ ' + t.endStr);
      if (t.status === 'milestone') {
        html += '<span class="' + cls + '" style="left:' + left.toFixed(1) + '%" title="' + t.name + ' ' + t.startStr + '"></span>';
      } else if (width < 14) {
        html += '<span class="' + cls + ' gantt-bar-out" style="left:' + left.toFixed(1) + '%;width:' + width.toFixed(1) + '%"></span>';
        html += '<span class="gantt-bar-text" style="left:' + (left + width).toFixed(1) + '%">' + t.name + '</span>';
      } else {
        html += '<span class="' + cls + '" style="left:' + left.toFixed(1) + '%;width:' + width.toFixed(1) + '%" title="' + t.name + ' ' + rangeStr + '">' + t.name + '</span>';
      }
    }
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}

// summary 里若已是构建期渲染好的 HTML（think-fold 这类），原样放行；
// 手写 summary 才转义，挡住正文里裸写的 < 。
// 注：整篇笔记最终是 innerHTML 灌进 stage 的，此处转义只为排版正确，没有安全意义。
const _SUMMARY_HAS_TAG = /<\/?[a-zA-Z][^>]*>/;

function transformDetails(attr, sumAttr, summary, body) {
  const srcAttr = attr || '';
  const sumAttrs = sumAttr || '';
  // class 追加而非覆盖：生成型 details 自带 class，且 open 等 attribute 一律保留
  const withClass = (cls) => /class="/.test(srcAttr)
    ? srcAttr.replace(/class="([^"]*)"/, 'class="' + cls + ' $1"')
    : srcAttr + ' class="' + cls + '"';
  const hasTag = _SUMMARY_HAS_TAG.test(summary);
  const safeSum = hasTag ? summary : _esc(summary);
  // 括号计数徽章只加在纯文本 summary 上，免得误伤 HTML 属性里的括号
  const styledSum = hasTag ? safeSum : safeSum.replace(/(\([^)]+\))/, ' <span class="dcount">$1</span>');
  if (/问答/.test(summary)) {
    body = body.replace(
      /<p>Q：([\s\S]*?)<\/p>\s*<p>A：([\s\S]*?)<\/p>/g,
      '<div class="qa-item"><div class="qa-q"><span class="qa-tag q">Q</span><div class="qa-t">$1</div></div><div class="qa-a"><span class="qa-tag a">A</span><div class="qa-t">$2</div></div></div>'
    );
    return '<details' + withClass('qa') + '><summary' + sumAttrs + '>' + styledSum + '</summary>' + body + '</details>';
  }
  if (/误区|陷阱|注意/.test(summary)) {
    return '<details' + withClass('pitfalls') + '><summary' + sumAttrs + '>' + styledSum + '</summary>' + body + '</details>';
  }
  return '<details' + srcAttr + '><summary' + sumAttrs + '>' + safeSum + '</summary>' + body + '</details>';
}

// ---- collect raw ----
const files = walk(ROOT);
const raw = {};
for (const f of files) {
  const fp = f.replace(/\\/g, '/');
  const base = fp.split('/').pop().replace(/\.md$/, '');
  const { meta, body } = parseFm(readFileSync(f, 'utf8'));
  raw[base] = { base, f: fp, meta, body, mtime: statSync(f).mtime };
}

const titleToSlug = {};
const _aliasList = (meta) => {
  if (!meta.aliases) return [];
  return String(meta.aliases).split(',').map((s) => s.replace(/[\[\]]/g, '').trim()).filter(Boolean);
};
const _slugFrom = (r) => {
  const t = (r.meta.title || r.base || '').trim();
  return slugify(t);
};
for (const [base, r] of Object.entries(raw)) {
  const slug = _slugFrom(r);
  // 主 title / file 别名
  titleToSlug[slug] = slug;
  titleToSlug[slugify(base)] = slug;
  // frontmatter.aliases（Obsidian 风格，多个别名）
  for (const a of _aliasList(r.meta)) {
    const aSlug = slugify(a);
    if (aSlug) titleToSlug[aSlug] = slug;
  }
}

function resolveLink(target) {
  const s = slugify(target.trim());
  return titleToSlug[s] || null;
}

// 冲突检测：同一 slug 指向多个 base → 双链解析不稳定，必须消歧
const _conflicts = new Map();
for (const [base, r] of Object.entries(raw)) {
  const keys = new Set([_slugFrom(r), slugify(base), ..._aliasList(r.meta).map(slugify)]);
  for (const k of keys) {
    if (!_conflicts.has(k)) _conflicts.set(k, new Set());
    _conflicts.get(k).add(base);
  }
}
for (const [k, bases] of _conflicts) {
  if (bases.size > 1) {
    const list = [...bases].sort();
    console.log(`  ⚠  slug "${k}" 被 ${list.length} 篇笔记共享：`);
    list.forEach((b) => console.log(`      - ${b}`));
    console.log(`      → [[双链]] 只会命中最后构建的那篇，建议改名消歧\n`);
  }
}

// ---- build notes ----
const NOTES = {};
for (const [base, r] of Object.entries(raw)) {
  const slug = slugify(r.meta.title || base);
  const category = r.meta.category || 'root';
  const links = [];
  const seen = new Set();
  for (const m of r.body.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
    const t = resolveLink(m[1]);
    if (t && !seen.has(t)) { seen.add(t); links.push(t); }
  }
  // 原子笔记去掉正文首行 H1（标题由 frontmatter 渲染），避免出现两个标题
  const renderBody = r.meta.type === 'moc' ? r.body : r.body.replace(/^\s*#\s+[^\n]*\n/, '');
  const html = foldThinking(renderMarkdown(renderBody))
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => {
      const t = resolveLink(target);
      const label = (alias || target).trim();
      if (!t) return `<span class="wikilink broken">${label}</span>`;
      return `<a class="wikilink" data-target="${t}">${label}</a>`;
    });
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const grp = GROUP_OF[category] || null;
  NOTES[slug] = {
    id: slug,
    title: r.meta.title || base,
    type: r.meta.type === 'moc' ? 'moc' : 'note',
    category,
    file: r.f.slice(PROJ.length + 1), // 相对项目根的路径，如 notes/Foo.md（Ctrl+Alt+O 定位源文件用）
    accent: accentOf(category),
    accentInk: accentInkOf(category),
    catLabel: CAT_LABEL[category] || category,
    mtime: r.mtime,
    html,
    links,
    excerpt: r.meta.excerpt || extractExcerpt(r.body) || text.slice(0, 90),
    featured: r.meta.featured || '',
    order: Number(r.meta.order) || 0, // 墙上显式位次，1..n；0 = 未声明，退回权重排序
    group: grp ? grp.index : -1,        // 卷序号；-1 = 未归入任何卷（渲染时落到末尾「其他」）
    groupNum: grp ? grp.num : '',
    groupName: grp ? grp.name : '',
    groupRank: grp ? grp.rank : 999,    // 卷内位次
    groupLayout: grp ? grp.layout : '', // 卷目录带版式（tiles/spread/feature/index）
  };
}

// featured: MOC 在 frontmatter 声明子笔记为主体 → 构建时锁定最高权重（永远主卡 b4）
// 指向不存在/未 slugify 解析到的子笔记必须显式警告，避免 featured 写错一个别名就静默失踪
const _featuredMiss = [];
for (const n of Object.values(NOTES)) {
  if (!n.featured) continue;
  String(n.featured).split(',').map(s => s.trim()).filter(Boolean).forEach(function(raw){
    const tg = slugify(raw);
    const id = titleToSlug[tg] || tg;
    if (NOTES[id]) NOTES[id].pinned = true;
    else _featuredMiss.push(`  ⚠ [${n.id}] featured "${raw}" 未找到（slugify=${tg}）`);
  });
}

const ROOT_ID = slugify(raw['MOC']?.meta?.title || 'MOC');

function emit(){
  // featured 指向不存在的子笔记：build 末尾统一打印（不改 exit code —— 仍然产出文件，警告给作者看）
  if (_featuredMiss.length) {
    console.log('== featured 未命中 ==');
    _featuredMiss.forEach(function(l){ console.log(l); });
  }
  // in-degree=1（仅 1 条反向链接）的笔记：薄引用警告，方便识别未挂入知识网的新笔记
  const _indeg = {};
  for (const id of Object.keys(NOTES)) _indeg[id] = 0;
  for (const n of Object.values(NOTES)) for (const l of (n.links||[])) if (NOTES[l]) _indeg[l]++;
  const thin = Object.keys(NOTES).filter(function(id){ return id !== ROOT_ID && _indeg[id] === 1; });
  if (thin.length) {
    console.log('== 薄引用笔记（in-degree=1，仅 1 条反向链接，建议补挂父 MOC） ==');
    thin.forEach(function(id){ console.log(`  • ${id} (${NOTES[id].title})`); });
  }
  // 子 MOC 空墙（待填）一览 —— 让 build 也提示，方便作者知会
  const _emptyKids = Object.values(NOTES).filter(function(n){ return n.type === 'moc' && n.links.length === 0 && n.id !== ROOT_ID; });
  if (_emptyKids.length) {
    console.log(`== 待填子 MOC（${_emptyKids.length} 个空墙）==`);
    _emptyKids.forEach(function(n){ console.log(`  ⚠ [${n.id}] ${n.title}${n.group < 0 ? '  (group=-1 未归卷)' : ''}`); });
  }
  const data = JSON.stringify(NOTES).replace(/</g, '\\u003c');
  // mermaid 外置到 vendor/（本地副本，不内联、不用 CDN）；运行时按笔记懒加载
  mkdirSync(PROJ + '/vendor', { recursive: true });
  copyFileSync(PROJ + '/.build/mermaid.min.js', PROJ + '/vendor/mermaid.min.js');
  const reader = READER_HTML.replace('/*__ROOT__*/', JSON.stringify(ROOT_ID))
    .replace('/*__NOTES__*/', data);
  writeFileSync(OUT, reader, 'utf8');
  console.log('built', Object.keys(NOTES).length, 'notes ->', OUT, '| root:', ROOT_ID, '| mermaid -> vendor/mermaid.min.js (lazy)');
}

// 自动提交已关闭（用户决定手动 commit）：构建只产出 reader.html，不碰 git。

// ---------------- reader template (外置 .tpl.html；两个 /*__XX__*/ 占位符由 emit() 注入) ----------------
const READER_HTML = readFileSync(PROJ + '/.build/reader.tpl.html', 'utf8');

emit();
