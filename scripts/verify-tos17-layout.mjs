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

// ---- EE1 CAMON：热点 2x1 → 1x1，定位上移补位，后续图标整体前移 ----
await setPreset('ee1Camon')
{
  const cells = await page.evaluate(() =>
    [...document.querySelectorAll('.cc-grid .cc-cell')].map((c) => {
      const s = getComputedStyle(c)
      return {
        id: c.dataset.id,
        col: s.gridColumnStart,
        span: s.gridColumnEnd,
        row: s.gridRowStart,
        w: c.getBoundingClientRect().width
      }
    })
  )
  const hotspot = cells.find((c) => c.id === 'hotspot')
  const location = cells.find((c) => c.id === 'location')
  const airplane = cells.find((c) => c.id === 'airplane')
  check('EE1: 热点 = 1x1（宽度与飞行模式一致）', Math.abs(hotspot.w - airplane.w) <= 1, `hotspot=${hotspot.w}px airplane=${airplane.w}px`)
  check('EE1: 热点 与 定位 同一行', hotspot && location && hotspot.row === location.row, `hotspot r${hotspot && hotspot.row} location r${location && location.row}`)
  check('EE1: 定位紧接热点（列 +1）', hotspot && location && Number(location.col) === Number(hotspot.col) + 1, `hotspot c${hotspot && hotspot.col} location c${location && location.col}`)
  const ids = cells.map((c) => c.id)
  check('EE1: 定位排序在 热点 之后、设备中心 之前', ids.indexOf('location') === ids.indexOf('hotspot') + 1 && ids.indexOf('location') < ids.indexOf('joyConnect'), `order=${ids.join('>')}`)
  check('EE1: 手电筒前移补上定位原位（在 热点 之后的第二排首位）', ids.indexOf('flashlight') > ids.indexOf('hotspot'), `flashlight@${ids.indexOf('flashlight')}`)
  await page.screenshot({ path: 'shots/ee1-cc.png' })
}

// ---- EE1 系列：在 tOS17 基础上，快速分享(cast) 之前插入 VPN ----
const EE1_REMOVED = ['darkMode', 'autoRotate', 'motionComfort']
for (const [id, exclusive] of Object.entries({
  ee1Camon: [],
  ee1Note: ['joyHeart'],
  ee1Gt: ['liquidCooling', 'shoulderKey']
})) {
  await setPreset(id)
  const ids = await readCells()
  check(`${id}: 含 VPN`, ids.includes('vpn'), `total=${ids.length}`)
  const vpnAt = ids.indexOf('vpn')
  const castAt = ids.indexOf('cast')
  check(`${id}: VPN 排在 快速分享 之前`, vpnAt >= 0 && castAt >= 0 && vpnAt < castAt, `vpn@${vpnAt} cast@${castAt}`)
  for (const r of EE1_REMOVED) check(`${id}: 不含 ${r}（沿用 tOS17 规则）`, !ids.includes(r))
  for (const e of exclusive) check(`${id}: 含独占项 ${e}`, ids.includes(e))
  const tail = ids.slice(-3)
  check(`${id}: 收尾三个 = 快速分享/扫一扫/钱包`, JSON.stringify(tail) === JSON.stringify(['cast', 'scan', 'calculator']), `actual=${tail.join('/')}`)
}

// ---- 倒数第二排顺序：肩键 → 液冷散热 → 灯效 → 晕动舒缓（GT / GT 17 一致）----
const SECOND_LAST = ['shoulderKey', 'liquidCooling', 'boost', 'motionComfort']
// GT 17 按 tOS17 规则去掉了 晕动舒缓，所以只校验前三个的相对顺序
const WANT_SECOND_LAST = {
  gt: ['shoulderKey', 'liquidCooling', 'boost', 'motionComfort'],
  gt17: ['shoulderKey', 'liquidCooling', 'boost']
}
for (const [id, want] of Object.entries(WANT_SECOND_LAST)) {
  await setPreset(id)
  const ids = await readCells()
  const got = ids.filter((x) => SECOND_LAST.includes(x))
  check(
    `${id}: 倒数第二排 = 肩键/液冷散热/灯效${want.length === 4 ? '/晕动舒缓' : ''}`,
    JSON.stringify(got) === JSON.stringify(want),
    `actual=${got.join('/')}`
  )
}

await page.screenshot({ path: 'shots/tos17-cc.png' })
console.log('\n截图: shots/tos17-cc.png')
console.log(errs.length ? '\n控制台错误: ' + errs.join('; ') : '\n无控制台错误')
await browser.close()
console.log(allOk ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(allOk ? 0 : 1)
