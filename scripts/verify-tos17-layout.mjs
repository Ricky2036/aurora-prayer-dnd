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
// CAMON 17（hios17）走 HIOS17_ITEMS：只去掉深色主题 + 红外遥控，
// 并加回 tOS16 CAMON 有而它缺的 截屏(screenshot) / 灯效(boost)
const CAMON17_REMOVED = ['darkMode', 'autoRotate']
const CAMON17_ADDED = ['screenshot', 'boost']
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
for (const id of ['camon', 'note', 'gt']) {
  await setPreset(id)
  const ids = await readCells()
  for (const r of REMOVED) check(`tOS16 ${id}: 仍含 ${r}`, ids.includes(r), `total=${ids.length}`)
}

// ---- tOS17：NOTE 17 / GT 17 必须剔除 3 个开关；CAMON 17 去掉 2 个并加回截屏/灯效 ----
const cases = {
  hios17: { removed: CAMON17_REMOVED, added: CAMON17_ADDED, exclusive: [], total: 21 },
  note17: { removed: REMOVED, exclusive: ['joyHeart'], total: 22 },
  gt17: { removed: REMOVED, exclusive: ['liquidCooling', 'shoulderKey'], total: 23 }
}
for (const [id, cfg] of Object.entries(cases)) {
  await setPreset(id)
  const ids = await readCells()
  for (const r of cfg.removed) check(`tOS17 ${id}: 不含 ${r}`, !ids.includes(r), `total=${ids.length}`)
  for (const a of cfg.added || []) check(`tOS17 ${id}: 含加回的 ${a}`, ids.includes(a), `total=${ids.length}`)
  for (const e of cfg.exclusive) check(`tOS17 ${id}: 含独占项 ${e}`, ids.includes(e))
  check(`tOS17 ${id}: 磁贴总数 = ${cfg.total}`, ids.length === cfg.total, `actual=${ids.length}`)
}

// ---- 收尾三个磁贴：所有默认布局统一为 快速分享 / 扫一扫 / 钱包 ----
const TAIL = ['cast', 'scan', 'calculator']
for (const id of ['camon', 'note', 'gt', 'hios17', 'note17', 'gt17']) {
  await setPreset(id)
  const ids = await readCells()
  const tail = ids.slice(-3)
  check(
    `${id}: 收尾三个 = 快速分享/扫一扫/钱包`,
    JSON.stringify(tail) === JSON.stringify(TAIL),
    `actual=${tail.join('/')}`
  )
}

await page.screenshot({ path: 'shots/tos17-cc.png' })
console.log('\n截图: shots/tos17-cc.png')
console.log(errs.length ? '\n控制台错误: ' + errs.join('; ') : '\n无控制台错误')
await browser.close()
console.log(allOk ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(allOk ? 0 : 1)
