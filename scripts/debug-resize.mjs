/* 验证 resize 1x1→2x1 时其他图标的 FLIP 位移动画 */
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

await page.evaluate(() => { document.querySelector('#app').__vue_app__._context.config.globalProperties.$pinia._s.get('system').unlock() })
await page.waitForTimeout(1000)
await page.mouse.move(cx + 100, box.y + 8)
await page.mouse.down()
await page.mouse.move(cx + 100, box.y + 380, { steps: 16 })
await page.mouse.up()
await page.waitForTimeout(900)
await page.evaluate(() => { document.querySelector('#app').__vue_app__._context.config.globalProperties.$pinia._s.get('control').setEditing(true) })
await page.waitForTimeout(400)

/* monkey-patch animate */
await page.evaluate(() => {
  window.__animCount = 0
  window.__animLog = []
  const orig = Element.prototype.animate
  Element.prototype.animate = function (...args) {
    window.__animCount++
    window.__animLog.push({ id: this.dataset?.id || this.closest('.cc-cell')?.dataset?.id, from: args[0]?.[0]?.transform })
    return orig.apply(this, args)
  }
})

/* 找 flashlight 的伸缩手柄位置 */
const handle = await page.evaluate(() => {
  const cell = [...document.querySelectorAll('.cc-cell')].find((c) => c.dataset.id === 'flashlight')
  const h = cell.querySelector('.gb-resize')
  const r = h.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
})
console.log('resize handle:', JSON.stringify(handle))

/* mouse 拖动手柄右移 70px（超过 45px 阈值 → 1x1→2x1） */
await page.mouse.move(handle.x, handle.y)
await page.mouse.down()
await page.mouse.move(handle.x + 70, handle.y, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(900) // 等 width transition + FLIP

const result = await page.evaluate(() => ({
  animCount: window.__animCount,
  animLog: window.__animLog,
  flashlightW: (() => { const r = [...document.querySelectorAll('.cc-cell')].find((c) => c.dataset.id === 'flashlight').getBoundingClientRect(); return Math.round(r.width) })(),
  active: [...document.querySelectorAll('.cc-cell')].filter((c) => c.getAnimations().length).length
}))
console.log('resize FLIP:', JSON.stringify(result))

await page.screenshot({ path: OUT + '83-resize-flip.png' })
await browser.close()
console.log('DONE')
