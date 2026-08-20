/* 视觉校验脚本：对原型各状态截图（lock / home / 交互后） */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'
import { mkdirSync } from 'fs'

const PAGE_URL = process.env.PROTO_URL || 'http://127.0.0.1:5173/'
const OUT = new URL('../shots/', import.meta.url).pathname
const actions = process.argv[2] || 'lock'

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)

await page.screenshot({ path: OUT + '01-lock.png' })

if (actions !== 'lock') {
  // 模拟上滑解锁
  const box = await page.locator('.screen').boundingBox()
  const cx = box.x + box.width / 2
  const startY = box.y + box.height * 0.75
  const endY = box.y + box.height * 0.25
  await page.mouse.move(cx, startY)
  await page.mouse.down()
  const steps = 24
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx, startY + ((endY - startY) * i) / steps)
    await page.waitForTimeout(8)
  }
  await page.mouse.up()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: OUT + '02-home.png' })

  if (actions === 'full') {
    // 点击 Dock 第一个图标（电话）验证打开动画
    await page.locator('.dock-bar .app-icon').first().click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: OUT + '03-app-open.png' })
    // 点 Home 条返回
    await page.locator('.home-indicator').click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: OUT + '04-back-home.png' })

    // 下拉通知中心（从顶部左侧 1/4 处向下拖）
    const ncX = box.x + box.width * 0.3
    await page.mouse.move(ncX, box.y + 4)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(ncX, box.y + 4 + (box.height * 0.55 * i) / 20)
      await page.waitForTimeout(8)
    }
    await page.mouse.up()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: OUT + '05-notification-center.png' })

    // 点热区关闭 NC（等待拖拽抑制期）
    await page.waitForTimeout(500)
    await page.mouse.click(ncX, box.y + 20)
    await page.waitForTimeout(800)

    // 点右侧热区打开控制中心
    await page.mouse.click(box.x + box.width * 0.9, box.y + 20)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: OUT + '06-control-center.png' })
  }
}

await browser.close()
console.log('shots saved to', OUT)
