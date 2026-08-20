import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const BASE = process.env.PROTO_URL || 'http://127.0.0.1:5175/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 940 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(600)

const screen = await page.locator('.screen-view').boundingBox()
const cx = screen.x + screen.width / 2

// 解锁
await page.mouse.move(cx, screen.y + 700)
await page.mouse.down()
await page.mouse.move(cx, screen.y + 200, { steps: 14 })
await page.mouse.up()
await page.waitForTimeout(900)

// 打开设置（第 4 个图标）
await page.locator('.app-grid .app-icon').nth(3).click()
await page.waitForTimeout(900)

// 检查 side-edge 元素与事件命中
const info = await page.evaluate(() => {
  const se = document.querySelector('.side-edge')
  const r = se.getBoundingClientRect()
  const hit = document.elementFromPoint(r.x + 4, r.y + 300)
  return {
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    hitClass: hit ? hit.className.toString().slice(0, 60) : 'null'
  }
})
console.log('side-edge:', JSON.stringify(info))

// 侧滑手势 + 状态追踪
await page.evaluate(() => {
  window.__log = []
  const se = document.querySelector('.side-edge')
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    se.addEventListener(ev, (e) => window.__log.push(ev + '@' + Math.round(e.clientX)))
  }
})
await page.mouse.move(screen.x + 6, screen.y + 420)
await page.mouse.down()
await page.mouse.move(screen.x + 200, screen.y + 420, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(800)
const log = await page.evaluate(() => ({
  events: window.__log.slice(0, 12),
  baseLayer: window.__pinia ? 'n/a' : undefined,
  homeGestureProgress: document.querySelector('.app-window') ? 'app-mounted' : 'no-app'
}))
console.log(JSON.stringify(log, null, 1))
const finalState = await page.evaluate(() => !!document.querySelector('.app-window'))
console.log('app window still mounted:', finalState)

await browser.close()
