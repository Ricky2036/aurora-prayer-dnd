import { chromium } from 'playwright'
const PORT = process.argv[2] || '5555'
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const browser = await chromium.launch({ executablePath: CHROME })
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, hasTouch: true })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

const REMOVED = ['darkMode', 'autoRotate', 'motionComfort'] // 深色模式 / 红外遥控 / 晕动舒缓
let allOk = true
const check = (name, cond, detail) => { if (!cond) allOk = false; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

// 打开控制中心（顶部下滑）
async function openCC() {
  const vw = 430
  await page.mouse.move(vw - 10, 5); await page.mouse.down(); await page.mouse.move(vw - 10, 240, { steps: 14 }); await page.mouse.up()
  await page.waitForTimeout(600)
}
async function readCells() {
  return page.evaluate(() => [...document.querySelectorAll('.cc-grid .cc-cell')].map((c) => c.dataset.id))
}
async function setPreset(id) {
  await page.evaluate((p) => window.__control.setLayoutPreset(p), id)
  await page.waitForTimeout(250)
}

await openCC()

// ---- tOS16 回归：NOTE / GT 仍应包含被 tOS17 删除的 3 个开关 ----
for (const id of ['note', 'gt']) {
  await setPreset(id)
  const ids = await readCells()
  for (const r of REMOVED) check(`tOS16 ${id}: 仍含 ${r}`, ids.includes(r), `total=${ids.length}`)
}

// ---- tOS17：NOTE 17 / GT 17 必须剔除 3 个开关，并保留各自独占项 ----
const cases = {
  note17: { exclusive: ['joyHeart'], total: 22 },
  gt17: { exclusive: ['liquidCooling', 'shoulderKey'], total: 23 }
}
for (const [id, cfg] of Object.entries(cases)) {
  await setPreset(id)
  const ids = await readCells()
  for (const r of REMOVED) check(`tOS17 ${id}: 不含 ${r}`, !ids.includes(r), `total=${ids.length}`)
  for (const e of cfg.exclusive) check(`tOS17 ${id}: 含独占项 ${e}`, ids.includes(e))
  check(`tOS17 ${id}: 磁贴总数 = ${cfg.total}`, ids.length === cfg.total, `actual=${ids.length}`)
}

await page.screenshot({ path: 'shots/tos17-cc.png' })
console.log('\n截图: shots/tos17-cc.png')
console.log(errs.length ? '\n控制台错误: ' + errs.join('; ') : '\n无控制台错误')
await browser.close()
console.log(allOk ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(allOk ? 0 : 1)
