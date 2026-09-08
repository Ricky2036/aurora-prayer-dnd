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
    const rows = [...document.querySelectorAll('.pc-card-row')]
    if (!rows.length) return { rows: 0 }
    const row = rows[0]
    const groups = [...row.querySelectorAll('.pc-inline-toggle')].map((g) => {
      const r = g.getBoundingClientRect()
      return {
        text: g.textContent.trim(),
        x: Math.round(r.x),
        y: Math.round(r.y),
        cx: Math.round(r.x + r.width / 2),
        cy: Math.round(r.y + r.height / 2),
        on: !!g.querySelector('input')?.checked
      }
    })
    const cardRect = row.closest('.pc-card').getBoundingClientRect()
    return {
      rows: rows.length,
      groups,
      cardH: Math.round(cardRect.height),
      cardCy: Math.round(cardRect.y + cardRect.height / 2)
    }
  })
  console.log(`\n[${tag}] .pc-card-row 数量 = ${data.rows}`)
  if (!data.rows) return data
  data.groups.forEach((g) => console.log(`  「${g.text}」 x=${g.x} cy=${g.cy} on=${g.on}`))
  if (data.groups.length === 2) {
    const [a, b] = data.groups
    const sameRow = Math.abs(a.cy - b.cy) <= 2
    const cardCenterOk = Math.abs(a.cy - data.cardCy) <= 2 && Math.abs(b.cy - data.cardCy) <= 2
    console.log(`  同一行: ${sameRow ? 'PASS' : `FAIL (Δcy=${a.cy - b.cy})`}`)
    console.log(`  卡片内垂直居中: ${cardCenterOk ? 'PASS' : 'FAIL'}（卡片高 ${data.cardH}）`)
    console.log(`  左右分布: ${a.x < b.x ? 'PASS' : 'FAIL'}`)
  }
  return data
}

await report('初始')

// 点击两个开关，确认还能用
await page.locator('.pc-inline-toggle').nth(0).click()
await page.waitForTimeout(200)
await page.locator('.pc-inline-toggle').nth(1).click()
await page.waitForTimeout(300)
await report('点击后')

const panel = page.locator('.proto-console')
await panel.screenshot({ path: 'shots/51-cc-console-merged-row.png' })
await page.screenshot({ path: 'shots/52-cc-console-full.png' })
await browser.close()
