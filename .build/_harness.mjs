// 各 verify-* 共用的沙箱装配：把 reader.html 的 <script> 塞进 vm 跑一遍，配齐 DOM/localStorage 假货。
// 路径按本文件位置解析（cwd 无关），脚本只读一次。
import { readFileSync } from 'fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const PROJ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(PROJ, 'reader.html'), 'utf8');
export const script = html.split('<script>')[1].split('</script>')[0];

// 不跑脚本，只把注入的 NOTES 字面量抠出来（比 vm 快，也不受 stub 影响）
export function notes() {
  const m = script.match(/const NOTES = (\{[\s\S]*?\});\s*\nconst ROOT_ID/);
  if (!m) { console.error('NOTES 字面量未找到'); process.exit(1); }
  return { NOTES: JSON.parse(m[1]), ROOT_ID: JSON.parse(script.match(/const ROOT_ID = ("[^"]*")/)[1]) };
}

// 跑一遍顶层脚本，返回 { ctx, NOTES, ROOT_ID }。
// 顶层 const（NOTES/ROOT_ID）只存在于 context 的词法环境里，取回必须再 runInContext，ctx.NOTES 是 undefined。
export function run() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const make = () => ({
    style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {},
    querySelectorAll() { return []; }, querySelector() { return make(); },
    setAttribute() {}, getAttribute() { return 'x'; },
    getBoundingClientRect() { return { left: 0, bottom: 0 }; },
    innerHTML: '', textContent: '', onclick: null,
  });
  const doc = {
    documentElement: { style: { setProperty() {} } },
    getElementById() { return make(); }, querySelector() { return make(); },
    querySelectorAll() { return []; }, addEventListener() {}, createElement() { return make(); },
  };
  const win = {
    matchMedia() { return { matches: false }; },
    history: { replaceState() {} }, location: { hash: '' }, scrollTo() {}, addEventListener() {},
    innerWidth: 1200, innerHeight: 800,
    requestAnimationFrame: (cb) => cb(),
    IntersectionObserver: class { observe() {} unobserve() {} },
    navigator: { clipboard: { writeText() { return Promise.resolve(); } } },
    setTimeout: (cb) => cb(),
    clearTimeout() {},
  };
  const ctx = {
    document: doc, location: win.location, navigator: win.navigator, history: win.history,
    IntersectionObserver: win.IntersectionObserver, requestAnimationFrame: win.requestAnimationFrame,
    setTimeout: win.setTimeout, clearTimeout: win.clearTimeout, matchMedia: win.matchMedia, localStorage,
    addEventListener() {}, removeEventListener() {}, scrollTo: win.scrollTo,
    console, Math, JSON, Object, Array, String, Number, RegExp, Date,
  };
  ctx.window = ctx;
  vm.runInNewContext(script, ctx);
  return { ctx, NOTES: vm.runInContext('NOTES', ctx), ROOT_ID: vm.runInContext('ROOT_ID', ctx) };
}
