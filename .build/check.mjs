// 冒烟：把 reader.html 的顶层脚本在 stub DOM 里跑一遍，语法/运行时错误即失败。
// 注意：它不调用 wallHTML —— 渲染产物要验得靠 verify-groups / verify-spans。
import { run } from './_harness.mjs';
run();
console.log('RAN OK');
