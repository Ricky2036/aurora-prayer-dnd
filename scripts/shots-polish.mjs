/* 细节优化回归：锁屏堆叠 → 展开 → 下拉 NC → 侧滑返回 */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const BASE = process.env.PROTO_URL || 'http://127.0.0.1:5175/'
const OUT = new URL('../shots/', import.meta.url).pathname

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 940 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(800)

// 1. 锁屏：通知堆叠折叠态
await page.screenshot({ path: OUT + '30-lock-stack.png' })

// 2. 点击堆叠 → 展开列表
await page.locator('.ln-stack').click()
await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '31-lock-expanded.png' })

// 3. 下拉通知中心（从顶部热区拖拽）
const screen = await page.locator('.screen-view').boundingBox()
const cx = screen.x + screen.width / 2
await page.mouse.move(cx, screen.y + 8)
await page.mouse.down()
await page.mouse.move(cx, screen.y + 300, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(700)
await page.screenshot({ path: OUT + '32-nc-liquid.png' })

// 4. NC 打开态上滑关闭
await page.mouse.move(cx, screen.y + 500)
await page.mouse.down()
await page.mouse.move(cx, screen.y + 200, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(700)
await page.screenshot({ path: OUT + '33-nc-closed-back.png' })

// 5. 解锁 → 打开信息 → 左缘右滑回桌面
await page.mouse.move(cx, screen.y + 700)
await page.mouse.down()
await page.mouse.move(cx, screen.y + 200, { steps: 14 })
await page.mouse.up()
await page.waitForTimeout(900)
await page.locator('.app-grid .app-icon').first().click() // 信息在桌面第一个？点开任意 app
await page.waitForTimeout(900)
await page.screenshot({ path: OUT + '34-app-open.png' })

// 6. 左缘右滑返回
await page.mouse.move(screen.x + 6, screen.y + 420)
await page.mouse.down()
await page.mouse.move(screen.x + 200, screen.y + 420, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(900)
await page.screenshot({ path: OUT + '35-side-back-home.png' })

await browser.close()
console.log('done')
