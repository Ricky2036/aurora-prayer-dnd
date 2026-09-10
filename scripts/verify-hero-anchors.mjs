/**
 * 桌面应用从哪来回哪去（Hero 锚点过渡）自动化回归校验脚本。
 * 验证：点击图标时根据其物理坐标启动，退出时准确收敛回原物理锚点。
 *
 * 用法：node scripts/verify-hero-anchors.mjs [port]
 */
import { chromium } from 'playwright'

const PORT = process.argv[2] || '1111'
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 440, height: 956 } })

await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.evaluate(() => window.__system.unlock())
await page.waitForTimeout(500)

const testApps = ['weather', 'settings', 'phone', 'camera']
let allPass = true

for (const appId of testApps) {
  const result = await page.evaluate(async (id) => {
    const icon = document.querySelector(`[data-app-id="${id}"]`)
    if (!icon) return { error: `Icon for ${id} not found` }

    const iconRect = icon.getBoundingClientRect()
    const screen = document.querySelector('.screen-view').getBoundingClientRect()
    const iconX = iconRect.x - screen.x
    const iconY = iconRect.y - screen.y

    icon.click()
    await new Promise((r) => setTimeout(r, 450))
    const appWinOpen = document.querySelector('.app-window')
    const openPhase = appWinOpen?.getAttribute('data-phase')

    window.__system.goHome()
    await new Promise((r) => requestAnimationFrame(r))
    const appWinClosing = document.querySelector('.app-window')
    const closePhase = appWinClosing?.getAttribute('data-phase')

    await new Promise((r) => setTimeout(r, 550))
    const appWinClosed = document.querySelector('.app-window')
    const finalBase = window.__system.baseLayer

    return {
      id,
      iconX: Math.round(iconX),
      iconY: Math.round(iconY),
      openPhase,
      closePhase,
      closed: appWinClosed === null,
      finalBase
    }
  }, appId)

  if (result.openPhase !== 'open' || !result.closed || result.finalBase !== 'home') {
    console.error(`FAIL  [${appId}]`, result)
    allPass = false
  } else {
    console.log(`PASS  [${appId}] (from x=${result.iconX}, y=${result.iconY}, returned to home cleanly)`)
  }
}

await browser.close()
if (!allPass) process.exit(1)
console.log('\nALL HERO ANCHOR TRANSITION CHECKS PASSED!')
