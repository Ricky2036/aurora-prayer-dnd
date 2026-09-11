/**
 * 控制台：隐私指示 / 双卡显示 开关的行为回归校验。
 *
 * 背景（Ricky 2026-09-09）：这两项一度被改成「一张卡 + 两个双态按钮」，
 * 最终改回「两张卡 + .pc-switch 开关」。
 *
 * 注意：校验的是**功能行为**（存在两个开关、点它能切换 store），
 * 不绑定具体 DOM 结构 —— 控制台改版（标签式/分组式）不应让本脚本失效，
 * 只有「开关没了/点了没反应/默认值变了」才算回归。
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
  await page.waitForTimeout(1200)
  // 移动端控制台藏在悬浮球后面的抽屉里
  if (label === '移动') {
    await page.locator('.fab-btn').click()
    await page.waitForTimeout(600)
  }
  console.log(`\n--- ${label} ---`)

  // 找到「隐私指示」「双卡显示」各自的开关。
  // 控制台布局变过几次：最早是 .pc-card-duo 两张卡，2026-09-11 后改成
  // .pc-duo-row 一行两列 —— 所以优先按最小容器 .pc-duo-item 定位，
  // 找不到再退回 .pc-card，避免 hasText 同时命中包含两项的父容器。
  const findSwitch = async (title) => {
    for (const sel of ['.pc-duo-item', '.pc-card']) {
      const el = page.locator(sel, { hasText: title }).first()
      if ((await el.count()) > 0) return { el, switches: await el.locator('.pc-switch').count() }
    }
    return { el: null, switches: 0 }
  }

  const privacy = await findSwitch('隐私指示')
  const dual = await findSwitch('双卡显示')
  check(`${label}: 存在「隐私指示」项`, privacy.el !== null)
  check(`${label}: 存在「双卡显示」项`, dual.el !== null)
  if (privacy.el) check(`${label}: 隐私指示有开关`, privacy.switches >= 1)
  if (dual.el) check(`${label}: 双卡显示有开关`, dual.switches >= 1)
  // 双态按钮（已被否决的方案）不应回归
  check(`${label}: 没有残留的双态按钮`, (await page.locator('.pc-toggle-btn').count()) === 0)

  const init = await page.evaluate(() => [window.__control.showPrivacyIndicators, window.__control.showDualSim])
  check(`${label}: 默认都关闭`, init[0] === false && init[1] === false, JSON.stringify(init))

  if (privacy.el && privacy.switches >= 1) {
    await privacy.el.locator('.pc-switch').first().click()
    await page.waitForTimeout(400)
    check(`${label}: 点隐私指示开关 → 开`, (await page.evaluate(() => window.__control.showPrivacyIndicators)) === true)
    await privacy.el.locator('.pc-switch').first().click()
    await page.waitForTimeout(400)
    check(`${label}: 再点 → 关`, (await page.evaluate(() => window.__control.showPrivacyIndicators)) === false)
  }
  if (dual.el && dual.switches >= 1) {
    await dual.el.locator('.pc-switch').first().click()
    await page.waitForTimeout(400)
    check(`${label}: 点双卡显示开关 → 开`, (await page.evaluate(() => window.__control.showDualSim)) === true)
  }

  check(`${label}: 无控制台报错`, errs.length === 0, errs.slice(0, 2).join(' | '))
  await ctx.close()
}

await browser.close()
console.log(allOk ? '\n全部通过 ✅' : '\n存在失败 ❌')
process.exit(allOk ? 0 : 1)
