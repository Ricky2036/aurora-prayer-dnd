/* 校验：JBL 磁贴已从默认布局下线（NOTE 里消失，CAMON / GT 也没被泄漏进来）
 * 用法: node scripts/verify-no-jbl.mjs [port] */
import { chromium } from 'playwright'

const PORT = process.argv[2] || '5555'
const URL = `http://127.0.0.1:${PORT}/`

/* 本机 playwright 版本与缓存里的 chromium 版本对不上时用 executablePath 兜底
 * （可用 PLAYWRIGHT_CHROME 环境变量覆盖） */
const CHROME_FALLBACK =
  process.env.PLAYWRIGHT_CHROME ||
  '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const browser = await chromium.launch({ executablePath: CHROME_FALLBACK })
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2
})
const page = await ctx.newPage()
await page.goto(URL, { waitUntil: 'networkidle' })

// 打开控制中心（沿用 shots-cc.mjs 的做法：从屏幕顶部右侧下拉）
const box = await page.locator('.phone-screen, .device-screen, body').first().boundingBox()
await page.mouse.move(box.x + box.width - 30, box.y + 8)
await page.mouse.down()
await page.mouse.move(box.x + box.width - 30, box.y + 320, { steps: 18 })
await page.mouse.up()
await page.waitForTimeout(700)

async function tileIds() {
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll('.cc-cell, [data-cc-id]')]
    return cells.map((el) => el.getAttribute('data-cc-id') || el.dataset.id || '').filter(Boolean)
  })
}

const results = {}
for (const preset of ['camon', 'note', 'gt']) {
  await page.evaluate((p) => window.__control.setLayoutPreset(p), preset)
  await page.waitForTimeout(500)
  const ids = await tileIds()
  results[preset] = ids
  await page.screenshot({ path: `shots/50-cc-no-jbl-${preset}.png` })
  console.log(`\n[${preset.toUpperCase()}] 共 ${ids.length} 个磁贴`)
  console.log('  ' + ids.join(', '))
  console.log(`  JBL 出现次数: ${ids.filter((i) => i === 'jbl').length}`)
}

console.log('\n===== 结论 =====')
for (const [preset, ids] of Object.entries(results)) {
  const n = ids.filter((i) => i === 'jbl').length
  console.log(`${preset.toUpperCase()}: ${n === 0 ? 'PASS 无 JBL' : `FAIL 仍有 ${n} 个 JBL`}`)
}
console.log(`\nNOTE 磁贴数 ${results.note.length}（改动前应为 ${results.note.length + 1}，即少 1 个 JBL）`)
console.log(`NOTE 是否仍含 joyHeart: ${results.note.includes('joyHeart') ? 'PASS' : 'FAIL'}`)
console.log(`GT 是否仍含 liquidCooling/shoulderKey: ${results.gt.includes('liquidCooling') && results.gt.includes('shoulderKey') ? 'PASS' : 'FAIL'}`)

await browser.close()
