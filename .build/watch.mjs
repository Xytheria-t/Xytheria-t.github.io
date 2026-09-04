// ponytail: 监听 notes/ 任意 .md 改动 → 自动跑 build.mjs；200ms 防抖重编，重编后自动 verify。
// 用法：node .build/watch.mjs  （终端挂着，Ctrl+C 退出）
// 提交由用户手动处理（git commit）；watch 只重编 + 校验，不碰 git。
import { watch, existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const notes = resolve(root, 'notes')
const build = resolve(root, '.build', 'build.mjs')
if (!existsSync(notes)) { console.error('notes/ 不存在'); process.exit(1) }

const run = () => {
  const p = spawn(process.execPath, [build], {
    cwd: root, stdio: 'inherit',
    env: { ...process.env, VINEA_NO_COMMIT: '1' },
  })
  p.on('exit', c => {
    if (c !== 0) { console.log(`✗ build 退出 ${c}`); return }
    console.log(`✓ ${new Date().toLocaleTimeString()} 重编完成`)
    verify()
  })
}

// 重编后自动跑统一 verify（check + 分组/掌握度/跨度/内容健康）；不通过仅告警，不阻断 watch。
const verify = () => {
  console.log('→ 跑 verify ...')
  const r = spawnSync(process.execPath, [resolve(root, '.build', 'verify.mjs')], { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) console.log('⚠ verify 未通过，见上方输出')
  else console.log('✓ verify 全部通过')
}

let bt
const rebuild = () => { clearTimeout(bt); bt = setTimeout(run, 200) }
watch(notes, { recursive: true }, (ev, file) => {
  if (file && file.endsWith('.md')) { console.log(`  ${ev} ${file}`); rebuild() }
})

process.on('SIGINT', () => { process.exit(0) })

console.log(`👁 监听 ${notes}\n改任意 .md 自动重编 + verify，Ctrl+C 退出`)
