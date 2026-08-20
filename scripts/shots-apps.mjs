/* M5 视觉校验：逐个核心应用截图 */
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

async function openGridIcon(name) {
  await page.locator(`.app-grid .app-icon:has-text("${name}")`).click()
  await page.waitForTimeout(900)
}
async function openDockIcon(index) {
  await page.locator('.dock-bar .app-icon').nth(index).click()
  await page.waitForTimeout(900)
}
async function goHome() {
  await page.locator('.home-indicator').click()
  await page.waitForTimeout(800)
}

// 设置首页
await openGridIcon('设置')
await page.screenshot({ path: OUT + '10-settings.png' })
// 二级页：显示与亮度
await page.locator('.list-cell:has-text("显示与亮度")').click()
await page.waitForTimeout(700)
await page.screenshot({ path: OUT + '11-settings-display.png' })
await goHome()

// 信息列表 → 对话
await openDockIcon(1)
await page.screenshot({ path: OUT + '12-messages.png' })
await page.locator('.conversation-cell').first().click()
await page.waitForTimeout(600)
// 发一条消息
await page.locator('.ci-field input').fill('原型验收通过了吗？')
await page.locator('.ci-send').click()
await page.waitForTimeout(1600)
await page.screenshot({ path: OUT + '13-messages-chat.png' })
await goHome()

// 电话键盘
await openDockIcon(0)
await page.locator('.key').nth(1).click() // 2
await page.locator('.key').nth(4).click() // 5
await page.locator('.key').nth(8).click() // 9
await page.screenshot({ path: OUT + '14-phone-keypad.png' })
await page.locator('.tab-item').first().click()
await page.waitForTimeout(300)
await page.screenshot({ path: OUT + '15-phone-recents.png' })
await goHome()

// 日历
await openGridIcon('日历')
await page.screenshot({ path: OUT + '16-calendar.png' })
await goHome()

// 相机
await openDockIcon(3)
await page.locator('.viewfinder').click({ position: { x: 120, y: 200 } })
await page.waitForTimeout(400)
await page.locator('.shutter').click()
await page.waitForTimeout(300)
await page.screenshot({ path: OUT + '17-camera.png' })
await goHome()

await browser.close()
console.log('app shots saved')
