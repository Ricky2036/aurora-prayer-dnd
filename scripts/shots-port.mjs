/* 三个 TSX 移植回归：锁屏新界面 / 通知中心 / 设置通知页 */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const BASE = process.env.PROTO_URL || 'http://127.0.0.1:5175/'
const OUT = new URL('../shots/', import.meta.url).pathname

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 940 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text()) })

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(900)

const shot = (name) => page.screenshot({ path: OUT + name + '.png' })
const screen = page.locator('.lock-screen')
const box = await screen.boundingBox()
const cx = box.x + box.width / 2

const sys = () => page.evaluate(() => document.querySelector('#app').__vue_app__._context.config.globalProperties.$pinia._s.get('system'))

/* ---------- 1. 锁屏默认 ---------- */
await shot('50-lock-default')

/* ---------- 2. 锁屏展开/滚动/收起 ---------- */
await page.mouse.move(cx, box.y + 620)
await page.mouse.wheel(0, -200)
await page.waitForTimeout(700)
await shot('51-lock-expanded')

await page.mouse.wheel(0, -300)
await page.waitForTimeout(700)
await shot('52-lock-scrolled')

await page.mouse.wheel(0, 900)
await page.waitForTimeout(700)
await shot('53-lock-collapsed-back')

/* ---------- 3. 解锁 ---------- */
await sys().then(async (s) => { await s; }) // dummy
await page.evaluate(() => {
  const a = document.querySelector('#app').__vue_app__
  a._context.config.globalProperties.$pinia._s.get('system').unlock()
})
await page.waitForTimeout(1100)
await shot('54-home-after-unlock')

/* ---------- 4. 下拉通知中心 ---------- */
await page.mouse.move(cx, box.y + 8)
await page.mouse.down()
await page.mouse.move(cx, box.y + 380, { steps: 16 })
await page.mouse.up()
await page.waitForTimeout(900)
await shot('55-nc-port')

await page.mouse.move(cx, box.y + 500)
await page.mouse.wheel(0, 400)
await page.waitForTimeout(700)
await shot('56-nc-stacked')

/* 强制关闭 NC 状态（避免 spring 动画异步干扰后续步骤） */
await page.evaluate(() => {
  const a = document.querySelector('#app').__vue_app__
  const s = a._context.config.globalProperties.$pinia._s.get('system')
  for (const k of Object.keys(s.overlays)) s.overlays[k] = { status: 'closed', progress: 0 }
})
await page.waitForTimeout(400)

/* ---------- 5. 设置 → 通知页 ---------- */
await page.evaluate(() => {
  const a = document.querySelector('#app').__vue_app__
  a._context.config.globalProperties.$pinia._s.get('system').openApp('settings')
})
// 等待 AppWindow mount（含 hero 动画 ~430ms）
await page.waitForSelector('.settings-app', { timeout: 10000 })
await page.waitForTimeout(800) // 等 hero 动画完成
await shot('57-settings-home')

// 点「通知」cell 进入通知页
await page.locator('.list-cell', { has: page.locator('.lc-title', { hasText: '通知' }) }).first().click({ force: true })
await page.waitForTimeout(800)
await shot('57b-settings-notif')

await page.locator('.ns-type-card', { hasText: '锁屏通知' }).first().click({ force: true })
await page.waitForTimeout(800)
await shot('58-settings-lockscreen')

// 返回主视图
await page.evaluate(() => { const b = document.querySelector('.ns-back'); if (b) b.click() })
await page.waitForTimeout(700)
// 悬浮通知子页：evaluate 点击对应卡片
await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.ns-type-card')]
  const c = cards.find(el => el.textContent.includes('悬浮通知'))
  if (c) c.click()
})
await page.waitForTimeout(700)
await shot('59-settings-floating')

await page.evaluate(() => { const b = document.querySelector('.ns-back'); if (b) b.click() })
await page.waitForTimeout(700)
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.ns-row.tappable')]
  if (rows[0]) rows[0].click()
})
await page.waitForTimeout(700)
await shot('60-settings-appdetail')

await browser.close()
console.log('ALL DONE')
