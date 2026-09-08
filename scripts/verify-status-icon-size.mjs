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

const vw = 430
async function openCC() {
  await page.mouse.move(vw - 10, 5); await page.mouse.down(); await page.mouse.move(vw - 10, 220, { steps: 12 }); await page.mouse.up()
  await page.waitForTimeout(500)
}
const boxOf = (sel) => page.evaluate((s) => {
  const els = [...document.querySelectorAll(s)]
  return els.map((e) => { const r = e.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) } })
}, sel)

let ok = true
const check = (name, cond, detail) => { if (!cond) ok = false; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

// ---------- 单卡模式 ----------
await openCC()
await page.evaluate(() => { const c = window.__control; c.showDualSim = false; c.dnd = true; c.hotspot = true; c.soundMode = 'ring' })
await page.waitForTimeout(300)

let inds = await boxOf('.cc-status .cc-ind svg')
let natives = await boxOf('.cc-status .sb-icon')
console.log('\n[单卡] 指示图标 svg 尺寸:', JSON.stringify(inds))
console.log('[单卡] 原生图标 svg 尺寸:', JSON.stringify(natives))
const indH = inds.length ? inds[0].h : 0
const natH = natives.length ? natives[0].h : 0
check('单卡: 指示图标已渲染(≥2个)', inds.length >= 2, `count=${inds.length}`)
check('单卡: 指示图标高度≥原生(不再偏小)', indH >= natH - 1, `indH=${indH} natH=${natH}`)

// ---------- 双卡模式 ----------
await page.evaluate(() => { const c = window.__control; c.showDualSim = true })
await page.waitForTimeout(300)
let inds2 = await boxOf('.cc-status .cc-ind svg')
console.log('\n[双卡] 指示图标 svg 尺寸:', JSON.stringify(inds2))
check('双卡: 指示图标已渲染(≥2个)', inds2.length >= 2, `count=${inds2.length}`)

// ---------- 主屏状态栏(StatusBar) ----------
await page.evaluate(() => { const c = window.__control; c.showDualSim = false })
await page.mouse.move(vw / 2, 5); await page.mouse.down(); await page.mouse.move(vw / 2, 300, { steps: 12 }); await page.mouse.up() // 关闭 CC
await page.waitForTimeout(400)
await page.evaluate(() => { const c = window.__control; c.dnd = true; c.hotspot = true })
await page.waitForTimeout(300)
let sbInds = await boxOf('.status-bar .sb-ind svg')
let sbNatives = await boxOf('.status-bar .sb-icon')
console.log('\n[主屏] 指示图标 svg 尺寸:', JSON.stringify(sbInds))
console.log('[主屏] 原生图标 svg 尺寸:', JSON.stringify(sbNatives))
const sbIndH = sbInds.length ? sbInds[0].h : 0
const sbNatH = sbNatives.length ? sbNatives[0].h : 0
check('主屏: 指示图标已渲染(≥2个)', sbInds.length >= 2, `count=${sbInds.length}`)
check('主屏: 指示图标高度≥原生', sbIndH >= sbNatH - 1, `indH=${sbIndH} natH=${sbNatH}`)

await browser.close()
console.log(ok ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(ok ? 0 : 1)
