/**
 * App Switcher（最近任务切换器）冒烟校验 —— 固定层级堆叠版。
 *
 * 场景链：
 *   解锁 → 依次开 5 个应用 → 上滑停驻进切换器（含「手指微抖」用例）
 *   → 几何体检（最多四层 / 阶梯露边 / 左边缘不出屏 / 标签 / 底部按钮）
 *   → 8:3:2:1 差异位移实测 → 横滑方向 → 层级恒定逐帧不变量
 *   → 点卡片恢复 → 上滑移除 → 快滑回桌面
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

// 依次开 5 个应用（上限 5）→ 最近列表 [calculator, camera, phone, clock, settings]
const OPENED = ['settings', 'clock', 'phone', 'camera', 'calculator']
for (const id of OPENED) {
  await page.evaluate((a) => window.__system.openApp(a), id)
  await page.waitForTimeout(320)
}
let s = await S()
check(
  '最近列表 = [calculator, camera, phone, clock, settings]',
  JSON.stringify(s.recent) === JSON.stringify(['calculator', 'camera', 'phone', 'clock', 'settings']),
  s.recent.join('/')
)

// ---- 上滑停驻（dwell）----
// jitter: 松手前手指保持「微抖」（±2px）—— 旧实现每次 pointermove 都重计 0.2s，
// 微抖会让计时器永远凑不满 → 进不了 Recently（Ricky 原话：停留时间太长，很难激活）。
async function dwellSwipe({ jitter = false, travel = 400 } = {}) {
  const cx = 215
  const startY = 925
  await page.mouse.move(cx, startY)
  await page.mouse.down()
  const steps = Math.round(travel / 10)
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx, startY - i * 10, { steps: 1 })
    await page.waitForTimeout(14)
  }
  if (jitter) {
    // 300ms 的「停住但微抖」：±2px，步进 25ms
    for (let i = 0; i < 12; i++) {
      await page.mouse.move(cx + (i % 2 ? 2 : -2), startY - travel, { steps: 1 })
      await page.waitForTimeout(25)
    }
  } else {
    await page.waitForTimeout(300)
  }
  await page.mouse.up()
  await page.waitForTimeout(700)
}

// 快速上滑（速度高、无停顿 → 回桌面，不进切换器）
async function flickSwipe() {
  const cx = 215
  const startY = 925
  await page.mouse.move(cx, startY)
  await page.mouse.down()
  await page.mouse.move(cx, startY - 500, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(700)
}

/* 快速上滑 → 停住 400ms → 松手。
   这是 Ricky 反馈「上滑后有停留就应该进 Recent，现在很难激活」的复现用例：
   速度采样器若不带时间衰减，松手时会带回「停住之前」的快甩速度 →
   停驻激活被速度门槛误杀 → 手指明明停了，却回到桌面。 */
async function fastPauseSwipe() {
  const cx = 215
  const startY = 925
  await page.mouse.move(cx, startY)
  await page.mouse.down()
  await page.mouse.move(cx, startY - 420, { steps: 4 })
  await page.waitForTimeout(400)
  await page.mouse.up()
  await page.waitForTimeout(900)
}

// 屏幕矩形 / 期望几何
const screenBox = await page.locator('.screen').boundingBox()
const screenCenterX = screenBox.x + screenBox.width / 2
const cardW = Math.round(screenBox.width * 0.64)
const SPAN = cardW * 0.6 // 一整层的拖动距离
const expectStair = [0, 0.12, 0.186, 0.222].map((f) => Math.round(cardW * f))

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

await dwellSwipe({ jitter: true })
await page.evaluate(() => { window.__swStop = true })
s = await S()
check('「停留但手指微抖」也能激活切换器（dwell 容差 4px / 120ms）', s.switcher === true, `switcher=${s.switcher}`)
const sw = await page.evaluate(() => window.__sw)
if (sw.cx.length >= 5) {
  const drift = Math.max(...sw.cx.map((v) => Math.abs(v - screenCenterX)))
  check('跟手缩放全程不横向漂移（锚点=屏幕中心）', drift <= 1.5, `最大偏移=${drift.toFixed(1)}px`)
  check('跟手卡不淡出（opacity 恒 1）', Math.min(...sw.o) === 1, `min opacity=${Math.min(...sw.o)}`)
  let peak = 0
  for (let i = 1; i < sw.s.length; i++) if (sw.s[i] < sw.s[peak]) peak = i
  let monotonic = true
  for (let i = 1; i <= peak; i++) if (sw.s[i] > sw.s[i - 1] + 0.002) monotonic = false
  const minS = sw.s[peak]
  check(
    '缩放随手指单调变小且可小于最终值（无极）',
    monotonic && minS < cardW / screenBox.width - 0.005,
    `min scale=${minS} / 最终=${(cardW / screenBox.width).toFixed(3)}（拖拽段 ${peak + 1}/${sw.s.length} 帧）`
  )
} else {
  check('跟手缩放全程不横向漂移（锚点=屏幕中心）', false, `采样不足 samples=${sw.cx.length}`)
}

check('切换器 DOM 渲染', (await page.locator('.app-switcher').count()) === 1)
await page.waitForTimeout(500) // 等进场弹簧把进度推到 1，跟手卡让位给堆叠卡

/* 堆叠几何读取 */
const deck = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.switcher-card.is-deck')].map((c) => {
      const r = c.getBoundingClientRect()
      const cs = getComputedStyle(c)
      return {
        id: c.dataset.appId,
        idx: +c.dataset.index,
        depth: +c.dataset.depth,
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        cx: r.x + r.width / 2,
        z: +cs.zIndex,
        origin: cs.transformOrigin
      }
    })
  )
const centeredId = async () => {
  const rows = await deck()
  let best = null
  for (const r of rows) {
    const d = Math.abs(r.cx - screenCenterX)
    if (!best || d < best.d) best = { d, id: r.id }
  }
  return best ? best.id : null
}

/* ---- 规则⑤ 最多四层 ---- */
let rows = await deck()
check('同时最多渲染 4 层（第 5 张被剔除）', rows.length === 4, `渲染 ${rows.length} 张：${rows.map((r) => r.id).join(',')}`)
check('最旧的应用（settings）不渲染卡片', !rows.some((r) => r.id === 'settings'), rows.map((r) => r.id).join(','))

/* ---- 规则④ 阶梯式缩小、露出越来越少 ---- */
{
  const byDepth = [...rows].sort((a, b) => a.idx - b.idx)
  const lefts = byDepth.map((r) => r.x)
  const exposures = []
  for (let i = 1; i < byDepth.length; i++) exposures.push(lefts[i - 1] - lefts[i])
  const scales = byDepth.map((r) => r.w / cardW)
  check(
    '背景层左边缘逐个左移（阶梯铺开）',
    lefts.every((v, i) => i === 0 || v < lefts[i - 1] - 5),
    `lefts=${lefts.map((v) => v.toFixed(1)).join(' / ')}`
  )
  check(
    '露出宽度递减（上层露出 33 / 下层 18 / 10）',
    exposures.every((v, i) => i === 0 || v < exposures[i - 1] - 2),
    `exposures=${exposures.map((v) => v.toFixed(1)).join(' / ')}（期望 ≈ 33 / 18 / 10）`
  )
  check(
    '按层等比缩小（0.94^k）',
    scales[0] > scales[1] && scales[1] > scales[2] && Math.abs(scales[1] - 0.94) < 0.02,
    `scales=${scales.map((v) => v.toFixed(3)).join(' / ')}`
  )
  check(
    '缩放锚点是左上角（下层才藏得住）',
    byDepth.every((r) => r.origin.startsWith('0px 0px')),
    byDepth.map((r) => `${r.id}:${r.origin}`).join(' ')
  )
  check(
    '最深背景层左边缘不出屏',
    Math.min(...lefts) >= 0,
    `min left=${Math.min(...lefts).toFixed(1)}px（期望 ≈ ${(screenBox.x + (screenBox.width - cardW) / 2 - cardW * 0.222).toFixed(1)}）`
  )
}

/* ---- 规则① 层级只由列表索引决定 ---- */
{
  const byIndex = ['calculator', 'camera', 'phone', 'clock']
  const zs = byIndex.map((id) => rows.find((r) => r.id === id)?.z)
  check(
    'z 层级仅由列表索引决定（每层恰好差 1，越小越靠上）',
    zs.every((z, i) => (i === 0 ? true : z === zs[i - 1] - 1)) && new Set(zs).size === 4,
    zs.join(' > ')
  )
}

/* ---- 前卡落点必须水平居中 ---- */
{
  const front = rows.find((r) => r.depth === 0)
  check(
    '焦点层落点在屏幕水平中心',
    Math.abs(front.cx - screenCenterX) <= 2,
    `卡中心=${front.cx.toFixed(1)} 屏幕中心=${screenCenterX.toFixed(1)}`
  )
}

/* ---- UI 三改：卡片左上角图标+名称 / 去掉「x 个应用正在进行」/ 删除按钮与通知中心同款 ---- */
{
  const label = await page.evaluate(() => {
    const el = document.querySelector('.switcher-card-label')
    if (!el) return null
    const card = el.closest('.switcher-card')
    const lr = el.getBoundingClientRect()
    const cr = card.getBoundingClientRect()
    return {
      text: el.textContent.trim(),
      kids: el.children.length,
      inCard: card.dataset.appId,
      dx: lr.x - cr.x,
      above: cr.y - lr.bottom
    }
  })
  check('卡片左上角显示应用图标 + 名称', !!label && label.text.length > 0 && label.kids >= 2, JSON.stringify(label))
  check('标签贴在焦点卡左上角（卡顶上方）', !!label && Math.abs(label.dx) <= 4 && label.above > 0 && label.above < 14, label ? `dx=${label.dx.toFixed(1)} above=${label.above.toFixed(1)}` : 'null')
  check('只有一张卡带标签（不重复刷）', (await page.locator('.switcher-card-label').count()) === 1)

  check('底部「x 个应用正在进行」文案已移除', (await page.locator('.switcher-count').count()) === 0)

  const trash = await page.evaluate(() => {
    const b = document.querySelector('.switcher-dock button')
    if (!b) return null
    const cs = getComputedStyle(b)
    const r = b.getBoundingClientRect()
    return {
      shared: b.classList.contains('glass-circle-btn'),
      w: Math.round(r.width),
      h: Math.round(r.height),
      radius: cs.borderRadius,
      blur: cs.backdropFilter || cs.webkitBackdropFilter,
      bg: cs.backgroundColor
    }
  })
  check(
    '删除按钮 = 通知中心同款磨砂圆钮（52×52 / blur24 / 8% 白）',
    !!trash && trash.shared && trash.w === 52 && trash.h === 52 && /blur\(24px\)/.test(trash.blur || '') && /rgba\(255, 255, 255, 0\.08\)/.test(trash.bg),
    JSON.stringify(trash)
  )
}

/* ---- 规则⑥⑦ 8:3:2:1 差异位移实测 ----
   从静止（焦点=calculator）按住横拖半层（0.5 × SPAN），逐卡量位移：
   顶层 : 第二层 : 第三层 : 第四层 应接近 8 : 3 : 2 : 1（顶层走的最多、逐层递减）。 */
{
  const rest = await deck()
  const restX = Object.fromEntries(rest.map((r) => [r.id, r.x]))
  const startX = 150
  const px = Math.round(SPAN / 2)
  await page.mouse.move(startX, 500)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(startX + (px * i) / 20, 500, { steps: 1 })
    await page.waitForTimeout(8)
  }
  await page.waitForTimeout(80)
  const peak = await deck()
  // 拖回原位再松手，保证下一秒的断言从「焦点=calculator」这个已知状态出发
  for (let i = 20; i >= 0; i--) {
    await page.mouse.move(startX + (px * i) / 20, 500, { steps: 1 })
    await page.waitForTimeout(8)
  }
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(700)

  const moved = peak
    .filter((r) => r.idx <= 3) // 只取四个槽位（第 5 张可能在拖动中短暂进入 DOM）
    .map((r) => ({ id: r.id, idx: r.idx, d: r.x - (restX[r.id] ?? r.x) }))
    .sort((a, b) => a.idx - b.idx)
  check(
    '拖动期各层同向位移且逐层递减',
    moved.length >= 3 && moved.every((m, i) => (i === 0 ? m.d > 40 : m.d < moved[i - 1].d - 3)),
    moved.map((m) => `L${m.idx}:${m.d.toFixed(1)}`).join(' ')
  )
  if (moved.length >= 3) {
    const rel = moved.map((m) => m.d / moved[moved.length - 1].d)
    // 4 张卡按 8:3:2:1 归一；只有 3 张时去掉最深层 → 8:3:2
    const target = (moved.length >= 4 ? [8, 3, 2, 1] : [8, 3, 2]).slice(0, rel.length)
    const worst = Math.max(...rel.map((v, i) => Math.abs(v - target[i]) / target[i]))
    check(
      `水平位移比例 ≈ ${target.join(':')}（实测 ${rel.map((v) => v.toFixed(2)).join(':')}）`,
      worst <= 0.45,
      `最大偏差 ${(worst * 100).toFixed(0)}%`
    )
  }
  check('半层拖动松手后回到原焦点（calculator 居中）', (await centeredId()) === 'calculator', `centered=${await centeredId()}`)
}

/* ---- 逐帧层级不变量：z 恒定 + 顶卡永远压在别人之上（规则①） ----
   旧版 z 跟「距焦点远近」算，拖到一半顶层卡会被下面那张盖住（Ricky：最顶部的卡片
   还能跑到下面去）。现在 z 只由列表索引决定 → 任意时刻「索引小的卡」都必须被
   elementFromPoint 命中，且 z 值全程不变。 */
await page.evaluate((cx) => {
  window.__hs = { n: 0, bad: [], zDrift: [], collide: [] }
  const tick = () => {
    const cards = [...document.querySelectorAll('.switcher-card.is-deck')]
    if (cards.length >= 2) {
      const rows = cards.map((c) => {
        const r = c.getBoundingClientRect()
        const cs = getComputedStyle(c)
        return {
          id: c.dataset.appId,
          idx: +c.dataset.index,
          d: +c.dataset.depth,
          z: +cs.zIndex,
          l: r.left,
          r: r.right,
          t: r.top,
          b: r.bottom
        }
      })
      window.__hs.n++
      // ① z 恒定：每张卡的 z 必须 === 10000 - 列表索引（与环境无关）
      for (const r of rows) {
        const expect = 10000 - ['calculator', 'camera', 'phone', 'clock', 'settings'].indexOf(r.id)
        if (r.z !== expect) window.__hs.zDrift.push(`${r.id} z=${r.z} 期望 ${expect}`)
      }
      // ② 背景层永不重叠：层深 ≥ 0 的卡按索引左边缘必须严格递减（间距 > 1.5px）
      const bg = rows.filter((r) => r.d >= 0.02).sort((a, b) => a.idx - b.idx)
      for (let k = 1; k < bg.length; k++) {
        const gap = bg[k - 1].l - bg[k].l
        if (gap < 1.5) window.__hs.collide.push(`${bg[k - 1].id}与${bg[k].id}间距 ${gap.toFixed(1)}px`)
      }
      // ③ 顶卡（z 最大）与任何有交集的卡，交集中点必须命中顶卡
      const top = rows.reduce((a, b) => (b.z > a.z ? b : a))
      for (const o of rows) {
        if (o === top) continue
        const l = Math.max(top.l, o.l)
        const rr = Math.min(top.r, o.r)
        const t = Math.max(top.t, o.t)
        const b = Math.min(top.b, o.b)
        if (rr - l < 20 || b - t < 20) continue
        const sx = (l + rr) / 2
        const sy = (t + b) / 2
        if (sx < 1 || sx > cx * 2 - 1) continue
        const hit = document.elementFromPoint(sx, sy)?.closest?.('.switcher-card')?.dataset?.appId
        if (hit && hit !== top.id) window.__hs.bad.push(`${top.id}(z${top.z}) 被 ${hit} 盖住`)
      }
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
  const out = Object.fromEntries((await deck()).map((r) => [r.id, r.x]))
  return out
}

// ① 手往右拖 → 每张卡都必须往右走
let beforeXs = Object.fromEntries((await deck()).map((r) => [r.id, r.x]))
let during = await holdDrag(140, 370)
{
  // 只比对「拖动前就在场」的卡：拖动中新进入 DOM 的卡没有基准位移可比
  const moved = Object.entries(during)
    .filter(([id]) => beforeXs[id] !== undefined)
    .map(([id, x]) => ({ id, d: x - beforeXs[id] }))
  check(
    '横滑：手往右拖 → 每张卡都往右走',
    moved.length > 0 && moved.every((m) => m.d > 8),
    moved.map((m) => `${m.id}${m.d > 0 ? '+' : ''}${m.d.toFixed(0)}`).join(' ')
  )
}
await page.mouse.up()
await page.waitForTimeout(900)
check('右滑吸附后居中卡 = camera（第 2 张）', (await centeredId()) === 'camera', `centered=${await centeredId()}`)

// ② 旧焦点卡（calculator）必须已经飞出屏幕
{
  const r = await deck()
  const gone = r.find((x) => x.id === 'calculator')
  check('旧焦点卡滑到屏幕外（且仍在 DOM 里保持最上层）', !!gone && gone.x >= screenBox.width - 1, gone ? `x=${gone.x.toFixed(1)} 屏宽=${screenBox.width}` : '未渲染')
}

// ③ 手往左拖 → 每张卡都必须往左走
beforeXs = Object.fromEntries((await deck()).map((r) => [r.id, r.x]))
during = await holdDrag(370, 140)
{
  const moved = Object.entries(during)
    .filter(([id]) => beforeXs[id] !== undefined)
    .map(([id, x]) => ({ id, d: x - beforeXs[id] }))
  check(
    '横滑：手往左拖 → 每张卡都往左走',
    moved.length > 0 && moved.every((m) => m.d < -8),
    moved.map((m) => `${m.id}${m.d > 0 ? '+' : ''}${m.d.toFixed(0)}`).join(' ')
  )
}
await page.mouse.up()
await page.waitForTimeout(900)
check('左滑松手吸附回原卡（calculator 居中）', (await centeredId()) === 'calculator', `centered=${await centeredId()}`)

// ④ 快速右滑（单层位移）→ 居中 camera
await page.mouse.move(215, 500)
await page.mouse.down()
await page.mouse.move(380, 500, { steps: 3 })
await page.mouse.up()
await page.waitForTimeout(900)
check('快滑一层后居中卡 = camera', (await centeredId()) === 'camera', `centered=${await centeredId()}`)

const hs = await page.evaluate(() => window.__hs)
check(
  '横滑全程「顶卡永远压在别人之上」（层级不错乱）',
  hs.bad.length === 0 && hs.n > 30,
  `采样 ${hs.n} 帧，违反 ${hs.bad.length} 次${hs.bad.length ? '：' + hs.bad.slice(0, 3).join('；') : ''}`
)
check(
  '横滑全程每张卡的 z 恒定不变（层级关系不变）',
  hs.zDrift.length === 0,
  `偏离 ${hs.zDrift.length} 次${hs.zDrift.length ? '：' + hs.zDrift.slice(0, 3).join('；') : ''}`
)
check(
  '横滑全程背景层不互相重叠（阶梯始终成立）',
  hs.collide.length === 0,
  `重叠 ${hs.collide.length} 次${hs.collide.length ? '：' + hs.collide.slice(0, 3).join('；') : ''}`
)

// ---- 点卡片恢复（快滑后居中的是 camera）----
await page.locator('.switcher-card[data-app-id="camera"]').click()
await page.waitForTimeout(600)
s = await S()
check('点卡片恢复应用 + 切换器关闭', s.switcher === false && s.base === 'app' && s.app === 'camera', JSON.stringify(s))

// ---- 再进切换器，上滑移除当前应用（camera）----
await fastPauseSwipe()
s = await S()
check('快速上滑 + 停住 400ms → 进切换器（松手不带停住前的旧速度）', s.switcher === true, `switcher=${s.switcher}`)

{
  const cardLoc = page.locator('.switcher-card[data-app-id="camera"]')
  const card = await cardLoc.boundingBox()
  const cx = card.x + card.width / 2
  const cy = card.y + card.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx, cy - 220, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(900)
}
s = await S()
check(
  '上滑移除当前应用 → 列表少一个且回桌面',
  s.recent.length === 4 && !s.recent.includes('camera') && s.base === 'home',
  JSON.stringify(s)
)

// ---- 快滑不进切换器（回弹回桌面）----
await page.evaluate(() => window.__system.openApp('notes'))
await page.waitForTimeout(400)
await flickSwipe()
s = await S()
check('快速上滑 = 回桌面（不进切换器）', s.switcher === false && s.base === 'home', JSON.stringify(s))

// ---- 桌面路径：从桌面直接上滑停驻开切换器（卡片自下方错峰上浮）----
await fastPauseSwipe()
s = await S()
check('桌面直接上滑停驻 → 开切换器（无前台应用可缩放）', s.switcher === true && s.base === 'home', JSON.stringify(s))
await page.waitForTimeout(1000)
{
  const rows = await deck()
  const front = rows.reduce((a, b) => (Math.abs(b.depth) < Math.abs(a.depth) ? b : a), rows[0])
  check(
    '桌面路径渲染 4 层、焦点层居中、无横向偏移',
    rows.length === 4 && Math.abs(front.cx - screenCenterX) <= 2,
    `${rows.length} 层：${rows.map((r) => `${r.id}@${r.x.toFixed(0)}`).join(' ')}`
  )
  const opacities = await page.evaluate(() =>
    [...document.querySelectorAll('.switcher-card.is-deck')].map((c) => +getComputedStyle(c).opacity)
  )
  check('桌面入场结束后全部卡片可见（无残留 opacity 0）', opacities.every((o) => o === 1), opacities.join('/'))
}

check('无控制台报错', errs.length === 0, errs.slice(0, 3).join(' | '))

await page.screenshot({ path: 'shots/app-switcher.png' })
await browser.close()
console.log(allOk ? '\n全部通过 ✅' : '\n存在失败 ❌')
process.exit(allOk ? 0 : 1)
