import { chromium } from 'playwright'
const PORT = process.argv[2] || '5678'
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const browser = await chromium.launch({ executablePath: CHROME })
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, hasTouch: true })
const page = await ctx.newPage()
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

// 切到 hios17 预设
await page.evaluate(() => { window.__control.setLayoutPreset('hios17') })
await page.waitForTimeout(300)

// 打开控制中心
const vw = 430
await page.mouse.move(vw - 10, 5); await page.mouse.down(); await page.mouse.move(vw - 10, 220, { steps: 12 }); await page.mouse.up()
await page.waitForTimeout(600)

// 读取每个磁贴的 grid 位置
const tiles = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.cc-grid .cc-cell')]
  return cells.map((cell) => {
    const id = cell.dataset.id
    const s = getComputedStyle(cell)
    return { id, gridRow: s.gridRowStart, gridColumn: s.gridColumnStart, gridRowEnd: s.gridRowEnd, gridColumnEnd: s.gridColumnEnd }
  })
})

// 期望的 HiOS 17 布局（r 起点, c 起点, 行数, 列数）
const expected = {
  mediaPlayer: { r: 1, c: 1, w: 2, h: 2 },
  data: { r: 1, c: 3, w: 2, h: 1 },
  wifi: { r: 2, c: 3, w: 2, h: 1 },
  airplane: { r: 3, c: 1, w: 1, h: 1 },
  bluetooth: { r: 3, c: 2, w: 1, h: 1 },
  mediaControls: { r: 3, c: 3, w: 2, h: 2 },
  hotspot: { r: 4, c: 1, w: 2, h: 1 },
  joyConnect: { r: 5, c: 1, w: 2, h: 1 },
  sound: { r: 5, c: 3, w: 2, h: 1 },
  flashlight: { r: 6, c: 1, w: 1, h: 1 },
  location: { r: 6, c: 2, w: 1, h: 1 },
  rotationLock: { r: 6, c: 3, w: 1, h: 1 },
  dnd: { r: 6, c: 4, w: 1, h: 1 },
  calculator: { r: 7, c: 1, w: 1, h: 1 },
  batterySaver: { r: 7, c: 2, w: 1, h: 1 },
  screenRecord: { r: 7, c: 3, w: 1, h: 1 },
  scan: { r: 7, c: 4, w: 1, h: 1 },
  darkMode: { r: 8, c: 1, w: 1, h: 1 },
  autoRotate: { r: 8, c: 2, w: 1, h: 1 },
  share: { r: 8, c: 3, w: 1, h: 1 },
  cast: { r: 8, c: 4, w: 1, h: 1 }
}

let allOk = true
const check = (name, cond, detail) => { if (!cond) allOk = false; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

// 解析 "span 2" / "2" 形式的 grid-end 值
const parseSpan = (v) => {
  if (typeof v !== 'string') return Number(v) || 1
  const m = v.match(/span\s+(\d+)/)
  if (m) return Number(m[1])
  return Number(v) || 1
}

check('磁贴总数 = 21', tiles.length === 21, `actual=${tiles.length}`)

// 验证每个磁贴的位置
for (const [id, exp] of Object.entries(expected)) {
  const t = tiles.find((x) => x.id === id)
  if (!t) { check(id + ' 存在', false, '未渲染'); continue }
  const rOk = String(t.gridRow) === String(exp.r) && parseSpan(t.gridRowEnd) === exp.h
  const cOk = String(t.gridColumn) === String(exp.c) && parseSpan(t.gridColumnEnd) === exp.w
  check(`${id} @ r${exp.r}c${exp.c} ${exp.w}x${exp.h}`, rOk && cOk, `actual=r${t.gridRow} span ${parseSpan(t.gridRowEnd)} c${t.gridColumn} span ${parseSpan(t.gridColumnEnd)}`)
}

// 截一张图存证
await page.screenshot({ path: 'shots/hios17-cc.png' })
console.log('\n截图: shots/hios17-cc.png')

await browser.close()
console.log(allOk ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(allOk ? 0 : 1)
