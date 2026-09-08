/* 校验：控制台「隐私指示 + 双卡显示」合并成一行
 * 用法: node scripts/verify-cc-row.mjs [port] */
import { chromium } from 'playwright'

const PORT = process.argv[2] || '5678'
const URL = `http://127.0.0.1:${PORT}/`

const CHROME_FALLBACK =
  process.env.PLAYWRIGHT_CHROME ||
  '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

const browser = await chromium.launch({ executablePath: CHROME_FALLBACK })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

// 切到「控制中心」Tab
await page.locator('.pc-tab-btn', { hasText: '控制中心' }).first().click().catch(async () => {
  await page.locator('.pc-tab-btn').nth(2).click()
})
await page.waitForTimeout(400)

async function report(tag) {
  const data = await page.evaluate(() => {
    const duos = [...document.querySelectorAll('.pc-card-duo')]
    if (!duos.length) return { rows: 0 }
    const cards = [...duos[0].querySelectorAll(':scope > .pc-card')].map((c) => {
      const r = c.getBoundingClientRect()
      const title = c.querySelector('.pc-card-title')?.textContent.trim() || ''
      return {
        text: title,
        x: Math.round(r.x),
        w: Math.round(r.width),
        h: Math.round(r.height),
        cy: Math.round(r.y + r.height / 2),
        on: !!c.querySelector('input')?.checked
      }
    })
    return { rows: duos.length, cards, gap: cards.length === 2 ? Math.round(cards[1].x - (cards[0].x + cards[0].w)) : null }
  })
  console.log(`\n[${tag}] .pc-card-duo 数量 = ${data.rows}`)
  if (!data.rows) return data
  data.cards.forEach((c) => console.log(`  「${c.text}」 x=${c.x} w=${c.w} h=${c.h} cy=${c.cy} on=${c.on}`))
  if (data.cards.length === 2) {
    const [a, b] = data.cards
    console.log(`  同一行: ${Math.abs(a.cy - b.cy) <= 2 ? 'PASS' : `FAIL (Δcy=${a.cy - b.cy})`}`)
    console.log(`  等宽: ${Math.abs(a.w - b.w) <= 1 ? 'PASS' : `FAIL (${a.w} vs ${b.w})`}`)
    console.log(`  等高: ${Math.abs(a.h - b.h) <= 1 ? 'PASS' : `FAIL (${a.h} vs ${b.h})`}`)
    console.log(`  间距: ${data.gap}px`)
  }
  return data
}

await report('初始')

// 点击两个开关，确认还能用
await page.locator('.pc-card-duo .pc-switch-wrap').nth(0).click()
await page.waitForTimeout(200)
await page.locator('.pc-card-duo .pc-switch-wrap').nth(1).click()
await page.waitForTimeout(300)
await report('点击后')

const panel = page.locator('.proto-console')
await panel.screenshot({ path: 'shots/51-cc-console-merged-row.png' })
await page.screenshot({ path: 'shots/52-cc-console-full.png' })
await browser.close()
