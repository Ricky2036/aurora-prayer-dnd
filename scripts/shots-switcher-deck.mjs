/**
 * 视觉复核：Recent 堆叠（固定层级）逐档定格。
 *
 * 产出 shots/deck/*.png：
 *   00-entrance  上滑跟手到一半（跟手卡缩放中）
 *   10-rest      静止态：焦点层居中 + 3 层左侧阶梯
 *   20-q1 / 30-mid / 40-q3  横拖 1/4、1/2、3/4 层（扇开 + 顶卡右移）
 *   50-next      松手吸附到第 2 张
 *   60-back      反向拖 1/2 层（顶卡从左回收）
 *   70-nc        通知中心（确认共享圆钮渲染正常）
 *
 * 用法：node scripts/shots-switcher-deck.mjs [port]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const PORT = process.argv[2] || '5555'
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const OUT = 'shots/deck'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME })
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  const info = await page.evaluate(() =>
    [...document.querySelectorAll('.switcher-card.is-deck')].map((c) => {
      const r = c.getBoundingClientRect()
      return `${c.dataset.appId}@${Math.round(r.x)}/${(r.width / 275).toFixed(2)}x/z${getComputedStyle(c).zIndex}`
    }).join('  ')
  )
  console.log(name.padEnd(12), info)
}

await page.evaluate(() => window.__system.unlock())
await page.waitForTimeout(350)
for (const id of ['settings', 'clock', 'phone', 'camera', 'calculator']) {
  await page.evaluate((a) => window.__system.openApp(a), id)
  await page.waitForTimeout(300)
}

/* 进入切换器：上滑 400px 后停住 300ms 再松手 */
const cx = 215
const startY = 925
async function enterSwitcher() {
  await page.mouse.move(cx, startY)
  await page.mouse.down()
  for (let i = 1; i <= 40; i++) {
    await page.mouse.move(cx, startY - i * 10, { steps: 1 })
    await page.waitForTimeout(13)
  }
  await page.waitForTimeout(300)
  await page.mouse.up()
  await page.waitForTimeout(700)
}

// 跟手半程定格
await page.mouse.move(cx, startY)
await page.mouse.down()
for (let i = 1; i <= 22; i++) {
  await page.mouse.move(cx, startY - i * 10, { steps: 1 })
  await page.waitForTimeout(13)
}
await shot('00-entrance')
await page.waitForTimeout(220)
await page.mouse.up()
await page.waitForTimeout(900)
await shot('10-rest')

/* 横拖定格：按住不放，逐档定格（一气呵成，避免重复 pointerdown 把牌堆拖回原位） */
const SPAN = 275 * 0.6
async function glide(fromX, toX, steps = 12) {
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + (toX - fromX) * (i / steps), 500, { steps: 1 })
    await page.waitForTimeout(9)
  }
  await page.waitForTimeout(90)
}

const X0 = 150
await page.mouse.move(X0, 500)
await page.mouse.down()
let cur = X0
for (const [name, frac] of [['20-q1', 0.25], ['30-mid', 0.5], ['40-q3', 0.75], ['45-full', 1]]) {
  const target = X0 + SPAN * frac
  await glide(cur, target)
  cur = target
  await shot(name)
}
await page.mouse.up()
await page.waitForTimeout(1000)
await shot('50-next')

// 反向：从静止（camera 居中）往左拖半层
await page.mouse.move(X0, 500)
await page.mouse.down()
await glide(X0, X0 - SPAN * 0.5, 14)
await shot('60-back')
await glide(X0 - SPAN * 0.5, X0, 14)
await page.mouse.up()
await page.waitForTimeout(900)

// 通知中心：确认共享圆钮（GlassCircleButton）渲染与层级
await page.evaluate(() => window.__system.closeSwitcher())
await page.waitForTimeout(400)
await page.evaluate(() => window.__system.settleOverlay('notificationCenter', true))
await page.waitForTimeout(900)
await shot('70-nc')
const fab = await page.evaluate(() => {
  const slot = document.querySelector('.nc-clear-fab-slot')
  const btn = slot?.querySelector('button')
  if (!btn) return null
  const cs = getComputedStyle(btn)
  const r = btn.getBoundingClientRect()
  return {
    shared: btn.classList.contains('glass-circle-btn'),
    size: `${Math.round(r.width)}×${Math.round(r.height)}`,
    blur: cs.backdropFilter || cs.webkitBackdropFilter,
    z: getComputedStyle(slot).zIndex
  }
})
console.log('nc fab:', JSON.stringify(fab))

console.log('console errors:', errs.length ? errs.slice(0, 3).join(' | ') : 'none')
await browser.close()
