/* 校验本次三处改动：
 * 1) 单卡：主屏状态栏(.status-bar) 与 CC 单卡状态行(.cc-status-single) 都显示蓝牙
 * 2) Wi-Fi 关闭后状态栏 Wi-Fi 图标不消失（StatusIcons 禁用透明度 0.5，而非 0.25）
 * 3) 双卡：按桌面优先级分段均衡分布——第1行(低优先级 vibrate/mute/hotspot) 与 第2行(高优先级 bluetooth/dnd)，
 *    两段内部各自按优先级升序，整体与桌面状态栏排序规则一致
 * 用法: node scripts/verify-status-bluetooth.mjs [port] */
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
async function setCtl(fn) {
  await page.evaluate(fn)
  await page.waitForTimeout(220)
}
// 取某选择器下所有 .cc-ind 图标，并匹配到对应开关磁贴 (data-id)，证明同源
async function tileIdsIn(sel) {
  return page.evaluate((s) => {
    const inds = [...document.querySelectorAll(s + ' .cc-ind')]
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
  }, sel)
}

let ok = true
const check = (name, cond, detail) => {
  if (!cond) ok = false
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

/* ---------- A. 双卡：按桌面优先级排序（vibrate20 < mute30 < hotspot40 < bluetooth50 < dnd60） ---------- */
await openCC()
await setCtl(() => window.__control.setShowDualSim(true))
await setCtl(() => {
  const c = window.__control
  c.dnd = false
  c.hotspot = false
  c.soundMode = 'ring'
  c.bluetooth = true
})
// 全关（仅蓝牙常量）：第1行无功能指示器，第2行仅蓝牙
let row1 = await tileIdsIn('.cc-status-row:first-child .cc-status-right')
let row2 = await tileIdsIn('.cc-status-sub-icons')
check('双卡第1行 初始无功能指示器', !row1.includes('dnd') && !row1.includes('hotspot') && !row1.includes('sound'), `row1=${JSON.stringify(row1)}`)
check('双卡第2行 仅蓝牙常量', row2.length === 1 && row2[0] === 'bluetooth', `row2=${JSON.stringify(row2)}`)

// 启用 勿扰(dnd,60) + 热点(hotspot,40)
await tap('dnd')
await tap('hotspot')
row1 = await tileIdsIn('.cc-status-row:first-child .cc-status-right')
row2 = await tileIdsIn('.cc-status-sub-icons')
check('双卡第1行 = 热点(hotspot,40)', JSON.stringify(row1) === JSON.stringify(['hotspot']), `row1=${JSON.stringify(row1)}`)
check('双卡第2行 = 蓝牙+勿扰(bluetooth50,dnd60)', JSON.stringify(row2.slice().sort()) === JSON.stringify(['bluetooth', 'dnd'].slice().sort()), `row2=${JSON.stringify(row2)}`)
check('勿扰(高优先级)落第2行、不串第1行', !row1.includes('dnd') && row2.includes('dnd'), `row1=${JSON.stringify(row1)} row2=${JSON.stringify(row2)}`)

// 启用静音(sound/mute,30) → 落第1行(低优先级组 <=40)，第2行不变
await setCtl(() => { window.__control.soundMode = 'mute' })
row1 = await tileIdsIn('.cc-status-row:first-child .cc-status-right')
row2 = await tileIdsIn('.cc-status-sub-icons')
check('双卡第1行 含静音(sound) 且顺序 mute→hotspot', JSON.stringify(row1) === JSON.stringify(['sound', 'hotspot']), `row1=${JSON.stringify(row1)}`)
check('双卡第2行 仍为 蓝牙+勿扰', JSON.stringify(row2.slice().sort()) === JSON.stringify(['bluetooth', 'dnd'].slice().sort()), `row2=${JSON.stringify(row2)}`)

// 第2行蓝牙与蓝牙按钮同源（在 sub-icons 中挑出蓝牙那颗，而非首颗）
const btMatch = await page.evaluate(() => {
  const btn = document.querySelector('[data-id="bluetooth"] .l-icon')
  if (!btn) return false
  const btnDs = [...btn.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
  const subs = [...document.querySelectorAll('.cc-status-sub-icons .cc-ind')]
  return subs.some((el) => {
    const ds = [...el.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
    return ds.length === btnDs.length && ds.every((d, i) => d === btnDs[i])
  })
})
check('第2行蓝牙与蓝牙开关按钮同源', btMatch)

/* ---------- B. 单卡状态行也显示蓝牙，且顺序与桌面优先级一致 ---------- */
await setCtl(() => window.__control.setShowDualSim(false))
await setCtl(() => {
  const c = window.__control
  c.dnd = true
  c.hotspot = true
  c.soundMode = 'vibrate'
  c.bluetooth = true
})
let single = await tileIdsIn('.cc-status-single .cc-status-right')
check('单卡状态行 含蓝牙', single.includes('bluetooth'), `single=${JSON.stringify(single)}`)
// 单卡：顺序须与桌面优先级一致（vibrate20 < mute30 < hotspot40 < bluetooth50 < dnd60 → data-prio 升序）
const singlePrio = await page.evaluate(() => [...document.querySelectorAll('.cc-status-single .cc-status-right .cc-ind')].map((el) => +el.dataset.prio))
const singleAsc = singlePrio.every((p, i, a) => i === 0 || a[i - 1] <= p)
check('单卡状态行 指示器按优先级升序(与桌面一致)', singleAsc, `prios=${JSON.stringify(singlePrio)}`)

/* ---------- C. 主屏状态栏显示蓝牙 ---------- */
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const sbBt = await page.evaluate(() => {
  const inds = [...document.querySelectorAll('.status-bar .sb-ind')]
  const btn = document.querySelector('[data-id="bluetooth"] .l-icon')
  if (!btn) return { found: false }
  const btnDs = [...btn.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
  const hit = inds.find((el) => {
    const ds = [...el.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
    return ds.length === btnDs.length && ds.every((d, i) => d === btnDs[i])
  })
  return { found: !!hit, count: inds.length }
})
check('主屏状态栏 显示蓝牙图标', sbBt.found, `sb-ind 数量=${sbBt.count}`)

/* ---------- D. Wi-Fi 关闭后图标不消失（opacity=0.5） ---------- */
const wifiOpacity = await page.evaluate(async () => {
  const c = window.__control
  c.wifi = false
  await new Promise((r) => setTimeout(r, 250))
  // 主屏状态栏 StatusIcons 顺序: signal, wifi, battery → wifi 是第 2 个 .sb-icon
  const svgs = [...document.querySelectorAll('.status-bar .sb-icon')]
  return svgs.map((s) => s.getAttribute('opacity'))
})
// 关闭 Wi-Fi 后，wifi 那颗 svg 的 opacity 应为 0.5（而非旧版的 0.25 / 0）
const hasHalf = wifiOpacity.some((o) => o === '0.5')
check('Wi-Fi 关闭 → 状态栏 Wi-Fi 图标 opacity=0.5（未消失）', hasHalf, `opacities=${JSON.stringify(wifiOpacity)}`)

await page.screenshot({ path: 'shots/55-status-bluetooth-wifi-off.png' })
await browser.close()
console.log(ok ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(ok ? 0 : 1)
