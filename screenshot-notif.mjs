import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, 'screenshots')

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
})
const page = await context.newPage()

await page.goto('http://127.0.0.1:5175/')
await page.waitForTimeout(1200)

// 锁屏上滑解锁（从底部非交互区向上滑）
await page.touchscreen.tap(196, 800)
await page.mouse.move(196, 780)
await page.mouse.down()
await page.mouse.move(196, 300, { steps: 20 })
await page.mouse.up()
await page.waitForTimeout(900)

// 点击“设置”图标
await page.locator('.icon-label', { hasText: '设置' }).first().click()
await page.waitForTimeout(600)

// 点击“通知”行
await page.locator('.lc-title', { hasText: '通知' }).first().click()
await page.waitForTimeout(700)

// 截图：通知设置主页面
await page.screenshot({ path: join(outDir, 'notif-settings-main.png'), fullPage: false })

// 点击“锁屏通知”卡片进入子页
await page.locator('.pm-label', { hasText: '锁屏通知' }).first().click()
await page.waitForTimeout(700)

// 截图：锁屏通知子页
await page.screenshot({ path: join(outDir, 'notif-settings-lock.png'), fullPage: false })

await browser.close()
console.log('Screenshots saved to', outDir)
