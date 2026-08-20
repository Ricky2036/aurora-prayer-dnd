/* 诊断 CC FLIP：用合成 DragEvent 走完整拖拽链路，统计 element.animate 调用 */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const BASE = process.env.PROTO_URL || 'http://127.0.0.1:5175/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 940 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()) })
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(900)

const box = await page.locator('.lock-screen').boundingBox()
const cx = box.x + box.width / 2

await page.evaluate(() => {
  const a = document.querySelector('#app').__vue_app__
  a._context.config.globalProperties.$pinia._s.get('system').unlock()
})
await page.waitForTimeout(1000)
await page.mouse.move(cx + 100, box.y + 8)
await page.mouse.down()
await page.mouse.move(cx + 100, box.y + 380, { steps: 16 })
await page.mouse.up()
await page.waitForTimeout(900)
await page.evaluate(() => {
  const a = document.querySelector('#app').__vue_app__
  a._context.config.globalProperties.$pinia._s.get('control').setEditing(true)
})
await page.waitForTimeout(400)

/* monkey-patch animate */
await page.evaluate(() => {
  window.__animCount = 0
  window.__animLog = []
  const orig = Element.prototype.animate
  Element.prototype.animate = function (...args) {
    window.__animCount++
    window.__animLog.push({ id: this.dataset?.id, from: args[0]?.[0]?.transform })
    return orig.apply(this, args)
  }
})

/* 目标：flashlight（第 7 个 cell，grid r 从 0 开始）拖到 bluetooth 位置 */
const pos = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.cc-cell')]
  const f = cells.find((c) => c.dataset.id === 'flashlight')
  const b = cells.find((c) => c.dataset.id === 'bluetooth')
  const grid = document.querySelector('.cc-grid')
  const gr = grid.getBoundingClientRect()
  return {
    fx: f.getBoundingClientRect().x + f.getBoundingClientRect().width / 2,
    fy: f.getBoundingClientRect().y + f.getBoundingClientRect().height / 2,
    bx: b.getBoundingClientRect().x + b.getBoundingClientRect().width / 2,
    by: b.getBoundingClientRect().y + b.getBoundingClientRect().height / 2,
    gx: gr.x,
    gy: gr.y,
    flashRect: (() => { const r = f.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) } })()
  }
})
console.log('targets:', JSON.stringify(pos))

/* 模拟连续跨格拖拽：中间格 → 目标格（两次 hoverTimer），统计 FLIP 次数 */
const dtHandle = await page.evaluate((t) => {
  const grid = document.querySelector('.cc-grid')
  const cells = [...document.querySelectorAll('.cc-cell')]
  const src = cells.find((c) => c.dataset.id === 'flashlight')
  const dt = new DataTransfer()
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: t.fx, clientY: t.fy }))
  window.__dt = dt
  return true
}, pos)
await page.waitForTimeout(80)

/* 第 1 段：拖到中间（x 前进 1/2）→ hoverTimer#1 */
await page.evaluate((t) => {
  const grid = document.querySelector('.cc-grid')
  grid.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__dt, clientX: t.fx + (t.bx - t.fx) * 0.5, clientY: t.fy }))
}, pos)
await page.waitForTimeout(220) // hoverTimer(120ms) 触发 + watch + FLIP

const mid1 = await page.evaluate(() => ({ animCount: window.__animCount, log: window.__animLog }))
console.log('after seg1:', JSON.stringify(mid1))

/* 第 2 段：拖到目标 → hoverTimer#2 */
await page.evaluate((t) => {
  const grid = document.querySelector('.cc-grid')
  grid.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__dt, clientX: t.bx, clientY: t.by }))
}, pos)
await page.waitForTimeout(220)

const mid2 = await page.evaluate(() => ({ animCount: window.__animCount, log: window.__animLog }))
console.log('after seg2:', JSON.stringify(mid2))

/* drop */
await page.evaluate((t) => {
  const grid = document.querySelector('.cc-grid')
  grid.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__dt, clientX: t.bx, clientY: t.by }))
}, pos)
await page.waitForTimeout(600)

const end = await page.evaluate(() => ({
  animCount: window.__animCount,
  order: [...document.querySelectorAll('.cc-cell')].map((c) => c.dataset.id).slice(0, 12),
  flashlightRect: (() => { const r = [...document.querySelectorAll('.cc-cell')].find((c) => c.dataset.id === 'flashlight').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) } })()
}))
console.log('end:', JSON.stringify(end))

await browser.close()
console.log('DONE')
