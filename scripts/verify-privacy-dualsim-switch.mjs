/**
 * 控制台「控制中心」标签页：隐私指示 / 双卡显示 两张小卡 + 开关 的回归校验。
 *
 * 背景（Ricky 2026-09-09）：这两项一度被改成「一张卡 + 两个双态按钮」，
 * 最终改回「.pc-card-duo 两张卡 + .pc-switch 开关」。这个脚本用来锁住最终形态，
 * 免得以后再被改回去。
 *
 * 用法：node scripts/verify-privacy-dualsim-switch.mjs [port]
 */
import { chromium } from 'playwright'

const PORT = process.argv[2] || '5555'
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

let allOk = true
const check = (name, cond, detail) => {
  if (!cond) allOk = false
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

const browser = await chromium.launch({ executablePath: CHROME })

for (const [label, viewport] of [
  ['桌面', { width: 1440, height: 900 }],
  ['移动', { width: 430, height: 932 }]
]) {
  const ctx = await browser.newContext({ viewport, hasTouch: label === '移动' })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  // 移动端控制台藏在悬浮球后面的抽屉里
  if (label === '移动') {
    await page.locator('.fab-btn').click()
    await page.waitForTimeout(500)
  }
  await page.locator('.pc-tab-btn', { hasText: '控制中心' }).click()
  await page.waitForTimeout(500)
  console.log(`\n--- ${label} ---`)

  const titles = await page.evaluate(() =>
    [...document.querySelectorAll('.pc-card-title')].map((t) => t.textContent.trim())
  )
  check(`${label}: 两张卡标题 = 隐私指示 / 双卡显示`, titles.includes('隐私指示') && titles.includes('双卡显示'), titles.join('/'))

  check(`${label}: 双底板容器 .pc-card-duo 存在`, (await page.locator('.pc-card-duo').count()) === 1)
  check(`${label}: 没有残留的双态按钮`, (await page.locator('.pc-toggle-btn').count()) === 0)

  const privacyCard = page.locator('.pc-card', { hasText: '隐私指示' }).first()
  const dualCard = page.locator('.pc-card', { hasText: '双卡显示' }).first()
  check(`${label}: 隐私指示卡有开关`, (await privacyCard.locator('.pc-switch').count()) === 1)
  check(`${label}: 双卡显示卡有开关`, (await dualCard.locator('.pc-switch').count()) === 1)

  const init = await page.evaluate(() => [window.__control.showPrivacyIndicators, window.__control.showDualSim])
  check(`${label}: 默认都关闭`, init[0] === false && init[1] === false, JSON.stringify(init))

  await privacyCard.locator('.pc-switch').click()
  await page.waitForTimeout(400)
  check(`${label}: 点隐私指示开关 → 开`, (await page.evaluate(() => window.__control.showPrivacyIndicators)) === true)

  await privacyCard.locator('.pc-switch').click()
  await page.waitForTimeout(400)
  check(`${label}: 再点 → 关`, (await page.evaluate(() => window.__control.showPrivacyIndicators)) === false)

  await dualCard.locator('.pc-switch').click()
  await page.waitForTimeout(400)
  check(`${label}: 点双卡显示开关 → 开`, (await page.evaluate(() => window.__control.showDualSim)) === true)

  check(`${label}: 无控制台报错`, errs.length === 0, errs.slice(0, 2).join(' | '))
  await ctx.close()
}

await browser.close()
console.log(allOk ? '\n全部通过 ✅' : '\n存在失败 ❌')
process.exit(allOk ? 0 : 1)
