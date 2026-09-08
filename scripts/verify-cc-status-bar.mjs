/* 校验 CC 状态行指示器与对应开关按钮同源。
 * 注意：蓝牙(currentBlue) 现常驻状态行（bluetooth 默认 true），
 *       故功能指示器计数需排除 'bluetooth' 这颗常量。
 * 用法: node scripts/verify-cc-status-bar.mjs [port] */
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
  await page.mouse.move(vw - 10, 5)
  await page.mouse.down()
  await page.mouse.move(vw - 10, 220, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(500)
}
async function tap(id) {
  await page.click(`[data-id="${id}"] .gb-wrap`, { force: true })
  await page.waitForTimeout(350)
}
// 取 CC 状态行里所有 .cc-ind 图标对应的开关磁贴 data-id（同源证明）
async function ccIndTileIds() {
  return page.evaluate(() => {
    const inds = [...document.querySelectorAll('.cc-status .cc-ind')]
    const cells = [...document.querySelectorAll('[data-id]')]
    return inds.map((el) => {
      const ds = [...el.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
      for (const cell of cells) {
        for (const icon of cell.querySelectorAll('.l-icon')) {
          const cellDs = [...icon.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
          if (cellDs.length === ds.length && ds.every((d, i) => d === cellDs[i])) return cell.getAttribute('data-id')
        }
      }
      return 'unknown'
    })
  })
}
// 取指定 data-key 的状态指示器对应的开关磁贴 data-id（同源证明，按 key 精确定位，不依赖 DOM 顺序）
async function matchIndicator(key) {
  return page.evaluate((k) => {
    const el = document.querySelector(`.cc-status .cc-ind[data-key="${k}"]`)
    if (!el) return null
    const ds = [...el.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
    const cells = [...document.querySelectorAll('[data-id]')]
    for (const cell of cells) {
      for (const icon of cell.querySelectorAll('.l-icon')) {
        const cd = [...icon.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
        if (cd.length === ds.length && ds.every((d, i) => d === cd[i])) return cell.getAttribute('data-id')
      }
    }
    return null
  }, key)
}

const setOff = async () => {
  await page.evaluate(() => {
    const c = window.__control
    c.dnd = false
    c.hotspot = false
    c.soundMode = 'ring'
    c.bluetooth = true
  })
  await page.waitForTimeout(150)
}
let ok = true
const check = (name, cond, detail) => {
  if (!cond) ok = false
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}
// 功能指示器 = 状态行图标中除蓝牙常量外的部分
const funcIds = (ids) => ids.filter((id) => id !== 'bluetooth').sort()

await openCC()
await setOff()
let ids = await ccIndTileIds()
check('CC打开且全关 → 状态行仅蓝牙常量', funcIds(ids).length === 0, `ids=${JSON.stringify(ids)}`)
check('状态行 含蓝牙常量', ids.includes('bluetooth'), `ids=${JSON.stringify(ids)}`)

await tap('dnd')
ids = await ccIndTileIds()
let m = await matchIndicator('dnd')
check('启用勿扰 → CC状态行功能指示器={moon}', JSON.stringify(funcIds(ids)) === JSON.stringify(['dnd']), `func=${JSON.stringify(funcIds(ids))}`)
check('勿扰指示器与 dnd 开关按钮同源', m === 'dnd', `匹配磁贴: ${m}`)

await tap('dnd') // 关
await tap('hotspot')
ids = await ccIndTileIds()
m = await matchIndicator('hotspot')
check('启用热点 → CC状态行功能指示器={radio}', JSON.stringify(funcIds(ids)) === JSON.stringify(['hotspot']), `func=${JSON.stringify(funcIds(ids))}`)
check('热点指示器与 hotspot 开关按钮同源', m === 'hotspot', `匹配磁贴: ${m}`)

await tap('hotspot') // 关
await tap('sound') // ring->vibrate
ids = await ccIndTileIds()
check('响铃→振动 → CC状态行功能指示器={sound}', JSON.stringify(funcIds(ids)) === JSON.stringify(['sound']), `func=${JSON.stringify(funcIds(ids))}`)

await tap('sound') // vibrate->mute
ids = await ccIndTileIds()
check('振动→静音 → CC状态行功能指示器={sound}', JSON.stringify(funcIds(ids)) === JSON.stringify(['sound']), `func=${JSON.stringify(funcIds(ids))}`)

// 全开：勿扰 + 热点 + 振动 同时
await tap('sound') // mute->ring
await tap('dnd')
await tap('hotspot')
await tap('sound') // ring->vibrate
ids = await ccIndTileIds()
check('勿扰+热点+振动 同开 → 功能指示器={dnd,hotspot,sound}', JSON.stringify(funcIds(ids)) === JSON.stringify(['dnd', 'hotspot', 'sound']), `func=${JSON.stringify(funcIds(ids))}`)
check('蓝牙常量仍在', ids.includes('bluetooth'), `ids=${JSON.stringify(ids)}`)

await browser.close()
console.log(ok ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(ok ? 0 : 1)
