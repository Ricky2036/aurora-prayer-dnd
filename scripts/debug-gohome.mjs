/* 调试：goHome 状态链路 */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const PAGE_URL = process.env.PROTO_URL || 'http://127.0.0.1:5173/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(PAGE_URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

// 解锁
const box = await page.locator('.screen').boundingBox()
const cx = box.x + box.width / 2
await page.mouse.move(cx, box.y + box.height * 0.75)
await page.mouse.down()
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(cx, box.y + box.height * (0.75 - 0.5 * i / 20))
  await page.waitForTimeout(8)
}
await page.mouse.up()
await page.waitForTimeout(800)

await page.locator('.dock-bar .app-icon').first().click()
await page.waitForTimeout(800)
console.log('state after open:', await page.evaluate(() => ({
  base: window.__system.baseLayer, app: window.__system.activeAppId
})))

// 直接在 store 里调 goHome，验证 AppWindow watcher
await page.evaluate(() => window.__system.goHome())
await page.waitForTimeout(200)
console.log('after store.goHome():', await page.evaluate(() => ({
  base: window.__system.baseLayer, app: window.__system.activeAppId
})))
await page.waitForTimeout(800)
console.log('after 800ms:', await page.evaluate(() => ({
  base: window.__system.baseLayer, app: window.__system.activeAppId,
  count: document.querySelectorAll('.app-window').length
})))

// 再测点击
await page.locator('.dock-bar .app-icon').first().click()
await page.waitForTimeout(800)
await page.locator('.home-indicator').click()
await page.waitForTimeout(300)
console.log('after indicator click:', await page.evaluate(() => ({
  base: window.__system.baseLayer, app: window.__system.activeAppId
})))

await browser.close()
