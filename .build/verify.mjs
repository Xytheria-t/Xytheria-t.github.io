// 统一验证运行器：串起 check + 各 verify-*，任一失败则整体退出非 0。
// 由 watch.mjs 每次重编后自动调用；也可手动 `node .build/verify.mjs`。
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const steps = ['check.mjs', 'verify-features.mjs', 'verify-groups.mjs', 'verify-mastery.mjs', 'verify-spans.mjs', 'verify-health.mjs'];
let failed = 0;
for (const s of steps) {
  console.log('\n========== ' + s + ' ==========');
  const r = spawnSync(process.execPath, [resolve(root, '.build', s)], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log('\n' + (failed ? 'VERIFY FAILED: ' + failed + ' step(s)' : 'VERIFY OK — 全部检查通过'));
process.exit(failed ? 1 : 0);
