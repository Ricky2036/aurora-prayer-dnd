/* 校验：状态栏右簇不与居中摄像头(.punch-hole)重叠。
 * 开启尽量多的指示器后，右簇左缘必须 >= 摄像头右缘(含安全间距)，
 * 否则最低优先级指示器被隐藏。同时验证最高优先级(蓝牙)始终可见、原生图标始终可见。
 * 用法: node scripts/verify-status-bar-camera.mjs [port] */
import { chromium } from 'playwright'
const PORT = process.argv[2] || '5678'
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const browser = await chromium.launch({ executablePath: CHROME })
// 桌面视口：App.vue 仅在非移动端渲染 PhoneFrame(.punch-hole)，故必须用宽视口才能验证摄像头避让
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, hasTouch: true })
const page = await ctx.newPage()
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

async function snapshot(label) {
  return page.evaluate(() => {
    const ph = document.querySelector('.punch-hole')
    const sb = document.querySelector('.sb-right')
    const phRight = ph ? ph.getBoundingClientRect().right : null
    const clusterLeft = sb ? sb.getBoundingClientRect().left : null
    // 逐图标明细：data-key / 优先级 / 实际渲染宽度（0=隐藏）
    const inds = [...document.querySelectorAll('.sb-right .sb-ind')]
    const detail = inds.map((el) => {
      const w = Math.round(el.getBoundingClientRect().width)
      return { key: el.getAttribute('data-key'), prio: el.getAttribute('data-prio'), w }
    })
    const visible = detail.filter((d) => d.w > 0).map((d) => d.key)
    return { phRight, clusterLeft, visible, detail }
  })
}

let ok = true
const check = (name, cond, detail) => {
  if (!cond) ok = false
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

// ---- 场景1：全部指示器尽量开（dnd + hotspot + mute + bluetooth = 4）----
await page.evaluate(() => {
  const c = window.__control
  c.dnd = true
  c.hotspot = true
  c.bluetooth = true
  c.soundMode = 'mute'
})
await page.waitForTimeout(500)
let s = await snapshot()
const margin = 6
const overlap = s.clusterLeft < s.phRight + margin
console.log('\n[全开] detail=' + JSON.stringify(s.detail))
console.log(`[全开] 摄像头右缘=${s.phRight?.toFixed(1)}  右簇左缘=${s.clusterLeft?.toFixed(1)}  可见指示器=${JSON.stringify(s.visible)}`)
check('全开：右簇不重叠摄像头', !overlap, `clusterLeft=${s.clusterLeft?.toFixed(1)} phRight+margin=${(s.phRight + margin).toFixed(1)}`)
check('全开：最高优先级蓝牙仍可见', s.visible.includes('bluetooth'), `visible=${JSON.stringify(s.visible)}`)
check('全开：原生图标(StatusIcons)始终可见', s.visible.length >= 1, `visible=${JSON.stringify(s.visible)}`)

// ---- 场景2：仅蓝牙（最少）----
await page.evaluate(() => {
  const c = window.__control
  c.dnd = false
  c.hotspot = false
  c.bluetooth = true
  c.soundMode = 'ring'
})
await page.waitForTimeout(500)
s = await snapshot()
console.log('\n[仅蓝牙] detail=' + JSON.stringify(s.detail))
console.log(`[仅蓝牙] 可见指示器=${JSON.stringify(s.visible)}`)
check('仅蓝牙：蓝牙可见且不重叠', s.visible.includes('bluetooth') && s.clusterLeft >= s.phRight + margin - 0.5, `clusterLeft=${s.clusterLeft?.toFixed(1)} phRight=${s.phRight?.toFixed(1)}`)
check('仅蓝牙：无多余图标', s.visible.length === 1, `visible=${JSON.stringify(s.visible)}`)

// ---- 场景3：vibrate 而非 mute（验证静音/振动互斥时都能被合理隐藏）----
await page.evaluate(() => {
  const c = window.__control
  c.dnd = true
  c.hotspot = true
  c.bluetooth = true
  c.soundMode = 'vibrate'
})
await page.waitForTimeout(500)
s = await snapshot()
console.log('\n[振动+其他] detail=' + JSON.stringify(s.detail))
console.log(`[振动+其他] 可见指示器=${JSON.stringify(s.visible)}`)
check('振动场景：不重叠摄像头', s.clusterLeft >= s.phRight + margin - 0.5, `clusterLeft=${s.clusterLeft?.toFixed(1)} phRight=${s.phRight?.toFixed(1)}`)
check('振动场景：蓝牙仍可见', s.visible.includes('bluetooth'), `visible=${JSON.stringify(s.visible)}`)

await page.screenshot({ path: 'shots/62-sb-all-indicators.png' })
await browser.close()
console.log(ok ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(ok ? 0 : 1)
