/* M6 视觉校验：应用抽屉 + 搜索 */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'
import { mkdirSync } from 'fs'

const PAGE_URL = process.env.PROTO_URL || 'http://127.0.0.1:5173/'
const OUT = new URL('../shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
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
await page.waitForTimeout(900)

// 左滑打开应用抽屉（从桌面中部向左拖）
const midY = box.y + box.height * 0.5
await page.mouse.move(box.x + box.width * 0.8, midY)
await page.mouse.down()
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(box.x + box.width * (0.8 - 0.6 * i / 20), midY)
  await page.waitForTimeout(8)
}
await page.mouse.up()
await page.waitForTimeout(1000)
await page.screenshot({ path: OUT + '20-app-library.png' })

// 搜索过滤
await page.locator('.al-header input').fill('相')
await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '21-library-search.png' })

// 右滑关闭抽屉
await page.locator('.al-header input').fill('')
await page.mouse.move(box.x + box.width * 0.2, midY)
await page.mouse.down()
for (let i = 1; i <= 20; i++) {
  await page.mouse.move(box.x + box.width * (0.2 + 0.6 * i / 20), midY)
  await page.waitForTimeout(8)
}
await page.mouse.up()
await page.waitForTimeout(900)
await page.screenshot({ path: OUT + '22-library-closed.png' })

await browser.close()
console.log('library shots saved')
