/* 调试：抽屉右滑关闭链路 */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const PAGE_URL = process.env.PROTO_URL || 'http://127.0.0.1:5173/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(PAGE_URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

const box = await page.locator('.screen').boundingBox()
const cx = box.x + box.width / 2
// 解锁
await page.mouse.move(cx, box.y + box.height * 0.75)
await page.mouse.down()
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(cx, box.y + box.height * (0.75 - 0.5 * i / 20))
  await page.waitForTimeout(8)
}
await page.mouse.up()
await page.waitForTimeout(1200)

const dump = () => page.evaluate(() => JSON.stringify(window.__system.overlays.appLibrary))

// 左滑打开
const midY = box.y + box.height * 0.5
await page.mouse.move(box.x + box.width * 0.8, midY)
await page.mouse.down()
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(box.x + box.width * (0.8 - 0.6 * i / 20), midY)
  await page.waitForTimeout(8)
}
await page.mouse.up()
await page.waitForTimeout(300)
console.log('after open swipe:', await dump())
await page.waitForTimeout(1500)
console.log('after settle wait:', await dump())

// 检查 .app-library 元素与事件命中
const hit = await page.evaluate(() => {
  const el = document.querySelector('.app-library')
  if (!el) return 'no element'
  const r = el.getBoundingClientRect()
  const t = document.elementFromPoint(r.x + r.width * 0.5, r.y + r.height * 0.5)
  return { hit: t?.className?.slice?.(0, 40), mounted: true }
})
console.log('library element:', JSON.stringify(hit))

// 右滑关闭
await page.mouse.move(box.x + box.width * 0.2, midY)
await page.mouse.down()
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(box.x + box.width * (0.2 + 0.6 * i / 20), midY)
  await page.waitForTimeout(8)
}
await page.waitForTimeout(200)
console.log('mid close swipe:', await dump())
await page.mouse.up()
await page.waitForTimeout(300)
console.log('after close swipe:', await dump())
await page.waitForTimeout(1200)
console.log('final:', await dump())

await browser.close()
