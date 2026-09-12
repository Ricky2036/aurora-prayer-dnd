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

// 屏幕矩形（供「居中 / 跟手缩放」断言换算）
const screenBox = await page.locator('.screen').boundingBox()
const screenCenterX = screenBox.x + screenBox.width / 2
const cardW = Math.round(screenBox.width * 0.64)

/* 采样器：跟手卡在拖拽期的几何。Ricky 2026-09-12 定的三条硬规则：
   ① 缩放锚点与落点都是屏幕中心 → 全程 cx 恒为屏幕中心，不许偏左偏右；
   ② 缩放严格跟随手指，上滑越远越小（单调递减），越过满量程继续变小；
   ③ 绝不淡出 —— opacity 恒为 1，不许「缩到不见」。 */
await page.evaluate(() => {
  window.__sw = { cx: [], s: [], o: [] }
  window.__swStop = false
  const tick = () => {
    if (window.__swStop) return
    const f = document.querySelector('.switcher-card.is-follow')
    if (f) {
      const cs = getComputedStyle(f); const m = new DOMMatrixReadOnly(cs.transform)
      window.__sw.cx.push(+(m.e + f.clientWidth / 2).toFixed(1))
      window.__sw.s.push(+m.a.toFixed(3))
      window.__sw.o.push(+(+cs.opacity).toFixed(2))
    }
    requestAnimationFrame(tick)
  }
  tick()
})

await dwellSwipe()
await page.evaluate(() => { window.__swStop = true })
const sw = await page.evaluate(() => window.__sw)
if (sw.cx.length >= 5) {
  const drift = Math.max(...sw.cx.map((v) => Math.abs(v - screenCenterX)))
  check('跟手缩放全程不横向漂移（锚点=屏幕中心）', drift <= 1.5, `最大偏移=${drift.toFixed(1)}px`)
  check('跟手卡不淡出（opacity 恒 1）', Math.min(...sw.o) === 1, `min opacity=${Math.min(...sw.o)}`)
  // 单调性只校验【拖拽段】（缩放到最小值那一段）；松手后弹簧回到固定终点，
  // 尺度本来就会变大，不属于「跟手」范围。
  let peak = 0
  for (let i = 1; i < sw.s.length; i++) if (sw.s[i] < sw.s[peak]) peak = i
  let monotonic = true
  for (let i = 1; i <= peak; i++) if (sw.s[i] > sw.s[i - 1] + 0.002) monotonic = false
  const minS = sw.s[peak]
  check('缩放随手指单调变小且可小于最终值（无极）', monotonic && minS < cardW / screenBox.width - 0.005, `min scale=${minS} / 最终=${(cardW / screenBox.width).toFixed(3)}（拖拽段 ${peak + 1}/${sw.s.length} 帧）`)
} else {
  check('跟手缩放全程不横向漂移（锚点=屏幕中心）', false, `采样不足 samples=${sw.cx.length}`)
}
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

// 前卡落点必须水平居中（Ricky：上滑要缩放到屏幕中心，不许偏左偏右）
const frontBox = await page.locator('.switcher-card:not(.is-follow)').first().boundingBox()
check(
  '前卡落点在屏幕水平中心',
  Math.abs(frontBox.x + frontBox.width / 2 - screenCenterX) <= 2,
  `卡中心=${(frontBox.x + frontBox.width / 2).toFixed(1)} 屏幕中心=${screenCenterX.toFixed(1)}`
)

// ---- 横滑浏览 ----
// 布局：前卡恒定在屏幕正中，更早的卡向左、更新的卡向右对称堆叠（每层 12.5% 屏宽）。
// 跟手语义（Ricky 2026-09-12 纠正）：手往右拖 → focus 增大 → 全部卡片一起往右走，
// 更早的卡从左侧进场；手往左拖则反之。松手按位移/速度吸附到整卡。
const cardXs = () =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.switcher-card:not(.is-follow)')].map((c) => [
        c.dataset.appId,
        Math.round(c.getBoundingClientRect().x)
      ])
    )
  )
const centeredId = () =>
  page.evaluate((cx) => {
    const cards = [...document.querySelectorAll('.switcher-card:not(.is-follow)')]
    let best = null
    for (const c of cards) {
      const r = c.getBoundingClientRect()
      const d = Math.abs(r.x + r.width / 2 - cx)
      if (!best || d < best.d) best = { d, id: c.dataset.appId }
    }
    return best ? best.id : null
  }, screenCenterX)

/* 逐帧层级不变量（Ricky 2026-09-12 第二条：最顶部的卡片不许跑到下面去）：
   任意时刻，屏幕【中心处最上层】的卡片必须 = 离屏幕中心【最近】的卡片。
   旧公式 `100 - Math.round(ao*10)` 粒度太粗，相邻两张卡在交叉点附近（ao 相差 < 0.05）
   算出完全相同的 z → 浏览器只能用 DOM 顺序兜底 → 索引更大的「出场卡」永远赢 →
   进场卡被盖住。实测修复前：去程 6 帧、回程 8 帧违反。 */
await page.evaluate((cx) => {
  window.__hs = { n: 0, bad: [] }
  const tick = () => {
    const cards = [...document.querySelectorAll('.switcher-card')]
    if (cards.length >= 2) {
      const rows = cards.map((c) => {
        const r = c.getBoundingClientRect()
        return { id: c.dataset.appId, mid: r.x + r.width / 2, y: r.y + r.height / 2 }
      })
      let near = rows[0]
      for (const r of rows) if (Math.abs(r.mid - cx) < Math.abs(near.mid - cx)) near = r
      const top = document.elementFromPoint(cx, rows[0].y)?.closest?.('.switcher-card')?.dataset?.appId
      window.__hs.n++
      if (top && top !== near.id) window.__hs.bad.push(`${top} 压在最近的 ${near.id} 之上`)
    }
    requestAnimationFrame(tick)
  }
  tick()
}, screenCenterX)

// 按住横拖：分段移动后停住，读「手在拖、卡也在跟着动」的实时状态
async function holdDrag(fromX, toX) {
  await page.mouse.move(fromX, 500)
  await page.mouse.down()
  const steps = 24
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + (toX - fromX) * (i / steps), 500, { steps: 1 })
    await page.waitForTimeout(10)
  }
  await page.waitForTimeout(120)
  return cardXs()
}

// ① 手往右拖 → 每张卡都必须往右走
let beforeXs = await cardXs()
let during = await holdDrag(140, 370)
{
  const moved = Object.entries(during).map(([id, x]) => ({ id, d: x - (beforeXs[id] ?? x) }))
  check(
    '横滑：手往右拖 → 每张卡都往右走',
    moved.length > 0 && moved.every((m) => m.d > 8),
    moved.map((m) => `${m.id}${m.d > 0 ? '+' : ''}${m.d}`).join(' ')
  )
}
await page.mouse.up()
await page.waitForTimeout(800)
{
  const frontId = Object.keys(beforeXs)[0]
  const bx = await page.locator('.switcher-card:not(.is-follow)').first().boundingBox()
  check('松手后原前卡向右让出', bx.x > beforeXs[frontId] + 30, `Δx=${(bx.x - beforeXs[frontId]).toFixed(1)}`)
  const c = await centeredId()
  check('右滑吸附后居中卡 = 第 2 张（clock）', c === 'clock', `centered=${c}`)
}

// ② 手往左拖 → 每张卡都必须往左走
beforeXs = await cardXs()
during = await holdDrag(370, 140)
{
  const moved = Object.entries(during).map(([id, x]) => ({ id, d: x - (beforeXs[id] ?? x) }))
  check(
    '横滑：手往左拖 → 每张卡都往左走',
    moved.length > 0 && moved.every((m) => m.d < -8),
    moved.map((m) => `${m.id}${m.d > 0 ? '+' : ''}${m.d}`).join(' ')
  )
}
await page.mouse.up()
await page.waitForTimeout(800)
{
  const c = await centeredId()
  check('左滑松手吸附回原卡（phone 居中）', c === 'phone', `centered=${c}`)
}

// ③ 快速右滑 → 居中 clock（供下面的「点卡片恢复」用）
await page.mouse.move(215, 500)
await page.mouse.down()
await page.mouse.move(380, 500, { steps: 3 })
await page.mouse.up()
await page.waitForTimeout(800)
{
  const c = await centeredId()
  check('快滑后居中卡 = clock', c === 'clock', `centered=${c}`)
}

const hs = await page.evaluate(() => window.__hs)
check(
  '横滑全程「中心最上层 = 离中心最近」（层级不错乱）',
  hs.bad.length === 0 && hs.n > 30,
  `采样 ${hs.n} 帧，违反 ${hs.bad.length} 次${hs.bad.length ? '：' + hs.bad.slice(0, 3).join('；') : ''}`
)

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
