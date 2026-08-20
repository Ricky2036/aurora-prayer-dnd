/* 三项调整回归：左侧说明移除 / 桌面壁纸 / 状态栏图标 */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const BASE = process.env.PROTO_URL || 'http://127.0.0.1:5175/'
const OUT = new URL('../shots/', import.meta.url).pathname

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 940 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(900)

const shot = (name) => page.screenshot({ path: OUT + name + '.png' })
const screen = page.locator('.lock-screen')
const box = await screen.boundingBox()

/* 1. 左侧说明已移除 */
const captionGone = await page.evaluate(() => !document.querySelector('.stage-caption'))
console.log('caption removed:', captionGone)

/* 2. 锁屏壁纸（TSX 同款） */
await shot('80-lock-wallpaper')

/* 3. 解锁 → 桌面壁纸 */
await page.evaluate(() => {
  const a = document.querySelector('#app').__vue_app__
  a._context.config.globalProperties.$pinia._s.get('system').unlock()
})
await page.waitForTimeout(1100)
await shot('81-home-wallpaper')

/* 4. 状态栏图标检查（锁屏白字版） */
const sbCheck = await page.evaluate(() => {
  const sb = document.querySelector('.status-bar')
  const svgs = sb ? [...sb.querySelectorAll('svg')] : []
  return {
    iconCount: svgs.length,
    time: sb?.querySelector('.sb-time')?.textContent,
    batteryText: sb?.querySelector('.sb-battery-text')?.textContent,
    firstViewBox: svgs[0]?.getAttribute('viewBox'),
    batteryFillW: svgs[2]?.querySelector('rect')?.getAttribute('width')
  }
})
console.log('statusbar:', JSON.stringify(sbCheck))

/* 应用内（深色字）状态栏 */
await page.evaluate(() => {
  const a = document.querySelector('#app').__vue_app__
  a._context.config.globalProperties.$pinia._s.get('system').openApp('settings')
})
await page.waitForTimeout(1600)
await shot('82-sb-dark-mode')

await browser.close()
console.log('ALL DONE')
