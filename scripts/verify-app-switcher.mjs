/**
 * App Switcher（最近任务切换器）冒烟校验。
 *
 * 场景链：
 *   解锁 → 依次开 3 个应用（settings → clock → phone）→ 慢速上滑停驻进切换器
 *   → 横滑浏览 → 点卡片恢复 → 再进切换器上滑移除 → 移除当前应用回桌面。
 *
 * 用法：node scripts/verify-app-switcher.mjs [port]
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
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const S = () => page.evaluate(() => ({
  base: window.__system.baseLayer,
  app: window.__system.activeAppId,
  recent: [...window.__system.recentApps],
  switcher: window.__system.appSwitcherOpen
}))

// 解锁
await page.evaluate(() => window.__system.unlock())
await page.waitForTimeout(400)

// 依次开 3 个应用
for (const id of ['settings', 'clock', 'phone']) {
  await page.evaluate((a) => window.__system.openApp(a), id)
  await page.waitForTimeout(350)
}
let s = await S()
check('最近列表 = [phone, clock, settings]', JSON.stringify(s.recent) === JSON.stringify(['phone', 'clock', 'settings']), s.recent.join('/'))

// ---- 慢速上滑停驻（模拟 dwell：慢速度 + 大进度）----
// 直接在 store 层触发手势判定路径不好模拟像素拖拽，这里用真实鼠标手势：
// 从底部上滑 ~40% 屏幕高度，缓慢分段移动后松手（速度低 → dwellOpen）
async function dwellSwipe() {
  const cx = 215
  const startY = 925
  await page.mouse.move(cx, startY)
  await page.mouse.down()
  // 缓慢移动：40 步、每步 20ms → 速度很低
  for (let i = 1; i <= 40; i++) {
    await page.mouse.move(cx, startY - i * 10, { steps: 1 })
    await page.waitForTimeout(20)
  }
  // 关键：松手前先停 350ms 把瞬时速度降到 ~0（dwell 判定是 |velocity| ≤ 0.25），
  // 再补一个 2px 小位移触发最后一次速度采样，保证低速被采到
  await page.waitForTimeout(350)
  await page.mouse.move(cx, startY - 402, { steps: 1 })
  await page.waitForTimeout(60)
  await page.mouse.up()
  await page.waitForTimeout(600)
}

// 快速上滑（速度高 → 回桌面，不进切换器）
async function flickSwipe() {
  const cx = 215
  const startY = 925
  await page.mouse.move(cx, startY)
  await page.mouse.down()
  await page.mouse.move(cx, startY - 500, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(600)
}

await dwellSwipe()
s = await S()
check('停驻手势打开切换器', s.switcher === true, `switcher=${s.switcher}`)
check('切换器 DOM 渲染', (await page.locator('.app-switcher').count()) === 1)
// 跟手卡在进场进度 <1 时存在（is-follow），堆叠卡不含它
const followCount = await page.locator('.switcher-card.is-follow').count()
check('进场跟手卡存在（或已完成让位）', followCount <= 1, `follow=${followCount}`)
await page.waitForTimeout(500) // 等进场弹簧把进度推到 1，跟手卡让位给堆叠卡
const cardCount = await page.locator('.switcher-card:not(.is-follow)').count()
check('渲染 3 张堆叠卡', cardCount === 3, `actual=${cardCount}`)

// 卡片内容存在（拨号键盘是 phone 应用首页）
const firstCardText = await page.locator('.switcher-card:not(.is-follow)').first().innerText()
check('卡片预览有内容（非空白）', firstCardText.trim().length > 0, firstCardText.slice(0, 30))

// ---- 横滑浏览（快滑切到下一张）----
// 小幅度拖拽会按 iOS 行为吸附回原位，所以要用快速甩动（大速度 → 跨卡）
const beforeX = (await page.locator('.switcher-card:not(.is-follow)').nth(1).boundingBox()).x
await page.mouse.move(215, 500)
await page.mouse.down()
await page.mouse.move(60, 500, { steps: 3 })
await page.mouse.up()
await page.waitForTimeout(800)
const afterX = (await page.locator('.switcher-card:not(.is-follow)').nth(1).boundingBox()).x
check('快滑后卡片位移', Math.abs(afterX - beforeX) > 30, `Δx=${Math.abs(afterX - beforeX).toFixed(1)}`)

// ---- 点卡片恢复（快滑后居中的是第 2 张卡 = clock）----
await page.locator('.switcher-card:not(.is-follow)').nth(1).click()
await page.waitForTimeout(500)
s = await S()
check('点卡片恢复应用 + 切换器关闭', s.switcher === false && s.base === 'app' && s.app === 'clock', JSON.stringify(s))

// ---- 再进切换器，上滑移除当前应用（clock） ----
await dwellSwipe()
s = await S()
check('再次进入切换器', s.switcher === true)

// 上滑移除：当前应用 clock 的卡片 —— 进场时居中，直接读 data-app-id 定位
{
  const cardLoc = page.locator('.switcher-card[data-app-id="clock"]')
  const card = await cardLoc.boundingBox()
  const cx = card.x + card.width / 2
  const cy = card.y + card.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx, cy - 220, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(800)
}
s = await S()
check('上滑移除当前应用 → 列表少一个且回桌面', s.recent.length === 2 && !s.recent.includes('clock') && s.base === 'home', JSON.stringify(s))

// ---- 快滑不进切换器（回弹）----
await page.evaluate(() => window.__system.openApp('settings'))
await page.waitForTimeout(400)
await flickSwipe()
s = await S()
check('快速上滑 = 回桌面（不进切换器）', s.switcher === false && s.base === 'home', JSON.stringify(s))

check('无控制台报错', errs.length === 0, errs.slice(0, 3).join(' | '))

await page.screenshot({ path: 'shots/app-switcher.png' })
await browser.close()
console.log(allOk ? '\n全部通过 ✅' : '\n存在失败 ❌')
process.exit(allOk ? 0 : 1)
