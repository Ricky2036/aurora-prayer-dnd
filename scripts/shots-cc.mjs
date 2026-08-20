/* 控制中心回归：打开 → 开关切换 → 编辑模式 → 上滑关闭 */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const BASE = process.env.PROTO_URL || 'http://127.0.0.1:5175/'
const OUT = new URL('../shots/', import.meta.url).pathname

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 940 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(700)

const screen = await page.locator('.screen-view').boundingBox()
const cx = screen.x + screen.width / 2
const rightX = screen.x + screen.width - 30

// 解锁
await page.mouse.move(cx, screen.y + 700)
await page.mouse.down()
await page.mouse.move(cx, screen.y + 200, { steps: 14 })
await page.mouse.up()
await page.waitForTimeout(900)

// 1. 右上角下拉打开控制中心
await page.mouse.move(rightX, screen.y + 8)
await page.mouse.down()
await page.mouse.move(rightX, screen.y + 300, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(800)
await page.screenshot({ path: OUT + '40-cc-android.png' })

// 2. 点飞行模式开关（第 5 个 toggle）
const cells = page.locator('.cc-cell')
console.log('cell count:', await cells.count())
await page.locator('.cc-cell[data-id="airplane"]').click()
await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '41-cc-airplane-on.png' })
await page.locator('.cc-cell[data-id="airplane"]').click() // 关回去

// 3. 编辑模式
await page.locator('.cc-header .cc-icon-btn').nth(1).click()
await page.waitForTimeout(500)
await page.screenshot({ path: OUT + '42-cc-editing.png' })

// 4. 拖拽 flashlight 到 hotspot 位置（HTML5 DnD）
const flash = await page.locator('.cc-cell[data-id="flashlight"]').boundingBox()
const hotspot = await page.locator('.cc-cell[data-id="hotspot"]').boundingBox()
await page.mouse.move(flash.x + flash.width / 2, flash.y + flash.height / 2)
await page.mouse.down()
await page.mouse.move(hotspot.x + hotspot.width / 2, hotspot.y + hotspot.height / 2, { steps: 10 })
await page.waitForTimeout(300)
await page.screenshot({ path: OUT + '43-cc-drag-preview.png' })
await page.mouse.up()
await page.waitForTimeout(600)
await page.screenshot({ path: OUT + '44-cc-after-drop.png' })

// 退出编辑模式
await page.locator('.cc-edit-group .cc-icon-btn').nth(1).click()
await page.waitForTimeout(400)

// 5. 上滑关闭控制中心
await page.mouse.move(cx, screen.y + 500)
await page.mouse.down()
await page.mouse.move(cx, screen.y + 150, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(800)
await page.screenshot({ path: OUT + '45-cc-closed.png' })

await browser.close()
console.log('done')
