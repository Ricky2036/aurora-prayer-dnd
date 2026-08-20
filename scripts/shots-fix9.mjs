/* 9 项修复回归：叠层退出三手势 / fab 层级 / 锁屏 Home 解锁 / CC 删除徽标 / 时钟 / 分页 / 挖孔 / 控制台 / 亮灭屏 */
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
const cx = box.x + box.width / 2

/* 页面内执行字符串化函数，访问 Pinia store（s = pinia._s） */
const st = (code) => page.evaluate((c) => {
  const a = document.querySelector('#app').__vue_app__
  const s = a._context.config.globalProperties.$pinia._s
  return new Function('s', '"use strict"; return (' + c + ')(s)')(s)
}, code.toString())

const SYS = (expr) => `(s) => { const sys = s.get('system'); return ${expr} }`
const CTRL = (expr) => `(s) => { const c = s.get('control'); return ${expr} }`

/* ---------- 1. 锁屏默认（挖孔 + 状态栏对齐） ---------- */
await shot('70-lock-hole')

/* ---------- 2. 解锁 → 桌面（时钟 widget 放大 + 分页只留搜索） ---------- */
await st(SYS('sys.unlock()'))
await page.waitForTimeout(1100)
await shot('71-home-widgets')

const widgetCheck = await page.evaluate(() => ({
  hasCity: !!document.querySelector('.cw-city'),
  hasDigital: !!document.querySelector('.cw-digital'),
  faceW: document.querySelector('.cw-face')?.getBoundingClientRect().width,
  dots: document.querySelectorAll('.page-indicator .dot').length,
  hasSearch: !!document.querySelector('.search-pill')
}))
console.log('widget/pagination:', JSON.stringify(widgetCheck))

/* ---------- 3. 打开 NC → fab 层级 ---------- */
await page.mouse.move(cx, box.y + 8)
await page.mouse.down()
await page.mouse.move(cx, box.y + 380, { steps: 16 })
await page.mouse.up()
await page.waitForTimeout(900)
await shot('72-nc-fab')
const fabCheck = await page.evaluate(() => {
  const fab = document.querySelector('.nc-clear-fab')
  const cards = [...document.querySelectorAll('.nc-item-wrapper')]
  if (!fab || !cards.length) return null
  return {
    fabZ: getComputedStyle(fab).zIndex,
    maxCardZ: Math.max(...cards.map((c) => +getComputedStyle(c).zIndex)),
    fabRect: (() => { const r = fab.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) } })()
  }
})
console.log('fab:', JSON.stringify(fabCheck))

/* ---------- 4. 点空白关闭 NC ---------- */
await page.mouse.click(cx, box.y + 100)
await page.waitForTimeout(900)
console.log('after backdrop click:', await st(SYS('sys.overlays.notificationCenter.status')))

/* ---------- 5. 再开 NC → 侧滑返回关闭 ---------- */
await page.mouse.move(cx, box.y + 8)
await page.mouse.down()
await page.mouse.move(cx, box.y + 380, { steps: 16 })
await page.mouse.up()
await page.waitForTimeout(900)
await page.mouse.move(box.x + 8, box.y + 400)
await page.mouse.down()
await page.mouse.move(box.x + 130, box.y + 400, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(900)
console.log('after side-swipe:', await st(SYS('sys.overlays.notificationCenter.status')))

/* ---------- 6. 再开 NC → Home 条上滑关闭 ---------- */
await page.mouse.move(cx, box.y + 8)
await page.mouse.down()
await page.mouse.move(cx, box.y + 380, { steps: 16 })
await page.mouse.up()
await page.waitForTimeout(900)
await page.mouse.move(cx, box.y + box.height - 20)
await page.mouse.down()
await page.mouse.move(cx, box.y + box.height - 120, { steps: 10 })
await page.mouse.up()
await page.waitForTimeout(900)
console.log('after home-swipe:', await st(SYS('sys.overlays.notificationCenter.status')))

/* ---------- 7. CC 编辑模式删除徽标完整性 ---------- */
// 先关 NC（点空白），再从右上角下拉开 CC
await page.mouse.click(cx, box.y + 100)
await page.waitForTimeout(900)
await page.mouse.move(cx + 100, box.y + 8) // 右上角 1/4 内
await page.mouse.down()
await page.mouse.move(cx + 100, box.y + 380, { steps: 16 })
await page.mouse.up()
await page.waitForTimeout(900)
await st(CTRL('c.setEditing(true)'))
await page.waitForTimeout(500)
await shot('73-cc-editing-badges')
const badgeCheck = await page.evaluate(() => {
  const badges = [...document.querySelectorAll('.cc-remove-cell, .gb-remove')]
  const clipped = badges.filter((b) => { const r = b.getBoundingClientRect(); return r.width < 15 || r.height < 15 })
  return { total: badges.length, clipped: clipped.map((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } }) }
})
console.log('badges:', JSON.stringify(badgeCheck))

await st(CTRL('c.setEditing(false)'))
await page.mouse.move(cx, box.y + 500)
await page.mouse.down()
await page.mouse.move(cx, box.y + 200, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(800)

/* ---------- 8. 灭屏 → 亮屏回锁屏 ---------- */
await st(SYS('sys.powerOff()'))
await page.waitForTimeout(400)
await shot('74-screen-off')
console.log('after powerOff:', await st(SYS('sys.baseLayer + "|" + sys.screenOn')))

await st(SYS('sys.powerOn()'))
await page.waitForTimeout(800)
await shot('75-screen-on-lock')
console.log('after powerOn:', await st(SYS('sys.baseLayer + "|" + sys.screenOn')))

/* ---------- 9. 锁屏 Home 条上滑解锁 ---------- */
await page.mouse.move(cx, box.y + box.height - 20)
await page.mouse.down()
await page.mouse.move(cx, box.y + box.height - 140, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(1100)
console.log('after lock home-swipe:', await st(SYS('sys.baseLayer')))
await shot('76-home-unlock-by-indicator')

await browser.close()
console.log('ALL DONE')
