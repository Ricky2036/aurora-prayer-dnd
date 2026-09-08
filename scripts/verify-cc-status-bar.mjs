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
async function tap(id) {
  await page.click(`[data-id="${id}"] .gb-wrap`, { force: true })
  await page.waitForTimeout(350)
}
// 取 CC 状态行里所有 .cc-ind 图标的 path 集合（每个指示器的全部 path d）
async function ccIndicators() {
  return page.evaluate(() => {
    const inds = [...document.querySelectorAll('.cc-status .cc-ind')]
    return inds.map((el) => [...el.querySelectorAll('svg path')].map((p) => p.getAttribute('d')))
  })
}
// 取某磁贴 .l-icon 的全部 path d
async function tilePaths(id) {
  return page.evaluate((tid) => {
    const cell = document.querySelector(`[data-id="${tid}"]`)
    const icon = cell && cell.querySelector('.l-icon')
    return icon ? [...icon.querySelectorAll('svg path')].map((p) => p.getAttribute('d')) : []
  }, id)
}
// 找哪个磁贴的 .l-icon path 集与本指示器完全一致（同源证明）
async function matchTile(paths) {
  if (!paths.length) return null
  return page.evaluate((ds) => {
    const cells = [...document.querySelectorAll('[data-id]')]
    for (const cell of cells) {
      for (const icon of cell.querySelectorAll('.l-icon')) {
        const cellDs = [...icon.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
        if (cellDs.length === ds.length && ds.every((d, i) => d === cellDs[i])) return cell.getAttribute('data-id')
      }
    }
    return null
  }, paths)
}

const setOff = async () => {
  await page.evaluate(() => { const c = window.__control; c.dnd = false; c.hotspot = false; c.soundMode = 'ring' })
  await page.waitForTimeout(150)
}
let ok = true
const check = (name, cond, detail) => { if (!cond) ok = false; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

await openCC()
await setOff()
let inds = await ccIndicators()
check('CC打开且全关 → 状态行无指示器', inds.length === 0, `count=${inds.length}`)

await tap('dnd')
inds = await ccIndicators()
let m = await matchTile(inds[0] || [])
check('启用勿扰 → CC状态行出现 1 个指示器(moon)', inds.length === 1, `count=${inds.length}`)
check('勿扰指示器与 dnd 开关按钮同源', m === 'dnd', `匹配磁贴: ${m}`)

await tap('dnd') // 关
await tap('hotspot')
inds = await ccIndicators()
m = await matchTile(inds[0] || [])
check('启用热点 → CC状态行出现 1 个指示器(radio)', inds.length === 1, `count=${inds.length}`)
check('热点指示器与 hotspot 开关按钮同源', m === 'hotspot', `匹配磁贴: ${m}`)

await tap('hotspot') // 关
await tap('sound') // ring->vibrate
inds = await ccIndicators()
m = await matchTile(inds[0] || [])
check('响铃→振动 → CC状态行出现 1 个指示器(vibrate)', inds.length === 1, `count=${inds.length}`)
check('振动指示器与 sound 开关按钮同源', m === 'sound', `匹配磁贴: ${m}`)

await tap('sound') // vibrate->mute
inds = await ccIndicators()
m = await matchTile(inds[0] || [])
check('振动→静音 → CC状态行出现 1 个指示器(bellOff)', inds.length === 1, `count=${inds.length}`)
check('静音指示器与 sound 开关按钮同源', m === 'sound', `匹配磁贴: ${m}`)

// 全开：勿扰 + 热点 + 振动 同时
await tap('sound') // mute->ring
await tap('dnd'); await tap('hotspot'); await tap('sound') // ring->vibrate
inds = await ccIndicators()
check('勿扰+热点+振动 同开 → CC状态行 3 个指示器', inds.length === 3, `count=${inds.length}`)

await browser.close()
console.log(ok ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(ok ? 0 : 1)
