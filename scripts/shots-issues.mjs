/* 截图：CC 响铃展开 2x1（问题1）+ 通知设置页顶部（问题5） */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const BASE = process.env.PROTO_URL || 'http://127.0.0.1:5175/'
const OUT = new URL('../shots/', import.meta.url).pathname
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 940 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(900)

const box = await page.locator('.lock-screen').boundingBox()
const cx = box.x + box.width / 2
const st = (code) => page.evaluate((c) => {
  const a = document.querySelector('#app').__vue_app__
  const s = a._context.config.globalProperties.$pinia._s
  return new Function('s', '"use strict"; return (' + c + ')(s)')(s)
}, code.toString())

await st(`(s) => { s.get('system').unlock() }`)
await page.waitForTimeout(1000)

/* CC：右上角下拉 */
await page.mouse.move(cx + 100, box.y + 8)
await page.mouse.down()
await page.mouse.move(cx + 100, box.y + 380, { steps: 16 })
await page.mouse.up()
await page.waitForTimeout(900)

/* 编辑模式 → 把响铃(sound) resize 成 2x1 */
await st(`(s) => { s.get('control').setEditing(true) }`)
await page.waitForTimeout(400)
const handle = await page.evaluate(() => {
  const cell = [...document.querySelectorAll('.cc-cell')].find((c) => c.dataset.id === 'sound')
  const h = cell.querySelector('.gb-resize')
  const r = h.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
await page.mouse.move(handle.x, handle.y)
await page.mouse.down()
await page.mouse.move(handle.x + 70, handle.y, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(900)
await st(`(s) => { s.get('control').setEditing(false) }`)
await page.waitForTimeout(400)
await page.screenshot({ path: OUT + '90-cc-sound-2x1.png' })
console.log('90 done')

/* 关闭 CC，进设置 → 通知页 */
await page.mouse.move(cx, box.y + 500)
await page.mouse.down()
await page.mouse.move(cx, box.y + 200, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(800)
await st(`(s) => { s.get('system').openApp('settings') }`)
await page.waitForSelector('.settings-app', { timeout: 10000 })
await page.waitForTimeout(1000)
await page.locator('.list-cell', { has: page.locator('.lc-title', { hasText: '通知' }) }).first().click({ force: true })
await page.waitForTimeout(900)
await page.screenshot({ path: OUT + '91-notif-top.png' })
console.log('91 done')

/* 滚动后看状态栏透出 */
await page.evaluate(() => { const p = document.querySelector('.ns-page'); if (p) p.scrollTop = 200 })
await page.waitForTimeout(500)
await page.screenshot({ path: OUT + '92-notif-scrolled.png' })
console.log('92 done')

await browser.close()
console.log('DONE')
