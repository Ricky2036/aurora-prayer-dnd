/**
 * App Switcher（最近任务切换器）冒烟校验 —— 固定层级堆叠版。
 *
 * 场景链：
 *   解锁 → 依次开 5 个应用 → 上滑停驻进切换器（含「手指微抖」用例）
 *   → 几何体检（最多四层 / 阶梯露边 / 左边缘不出屏 / 标签 / 底部按钮）
 *   → 背景层差异位移实测（第五轮：stair 几何级数，不再是 8:3:2:1）
 *   → 横滑方向 → 层级恒定逐帧不变量 → 桌面路径跟手入场（第五轮）
 *   → 点卡片恢复 → 上滑移除 → 快滑回桌面
 *
 * 用法：node scripts/verify-app-switcher.mjs [port]
 */
import { chromium } from 'playwright'
import { DECK } from '../src/utils/switcherDeck.js'

/* 层间位移的比例契约来自纯函数模块，避免脚本里再抄一份魔数（第五轮：0.55）。 */
const STAIR_DECAY = DECK.STAIR_DECAY

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
const SPAN = cardW * 0.85 // 一整层的拖动距离（DECK.FOCUS_SPAN_FRAC，对齐参考视频实测 0.87）
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

/* ---- 修正 A/B/C（2026-09-12 第三轮：Ricky 提交参考视频后的布局修正）----
   A. 卡片整体在【删除按钮上方】居中 —— 判定：图标顶到状态栏底的留白 === 卡底到按钮顶的留白；
   B. 背景层与顶卡【上下居中对齐】—— 判定：所有层垂直中心一致，且上下内缩对称；
   C. 图标放大到 24px，并纳入整体居中的 blockH。 */
{
  const trashBox = await page.locator('.switcher-trash').boundingBox()
  const safeTopPx = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.screen')).getPropertyValue('--safe-top'))
  )
  const byIdx = [...rows].sort((a, b) => a.idx - b.idx)
  const focusCard = byIdx[0]
  const cardBottom = focusCard.y + focusCard.h
  const labelBox = await page.locator('.switcher-card-label').first().boundingBox()
  const iconBox = await page.evaluate(() => {
    const l = document.querySelector('.switcher-card-label')
    const el = l && l.firstElementChild
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }
  })

  const gapTop = labelBox.y - safeTopPx
  const gapBottom = trashBox.y - cardBottom
  check(
    '修正 A：图标行 + 卡片作为整体，在删除按钮上方居中',
    Math.abs(gapTop - gapBottom) <= 2.5,
    `上留白=${gapTop.toFixed(1)} 下留白=${gapBottom.toFixed(1)}（状态栏底=${safeTopPx} 按钮顶=${trashBox.y.toFixed(1)}）`
  )
  check(
    '修正 A：卡片整体已下移（旧版卡顶 84 / 卡底 680，上留白 84 vs 下留白 160 明显偏上）',
    focusCard.y > 140 && focusCard.y < 195,
    `卡顶=${focusCard.y.toFixed(1)} 卡底=${cardBottom.toFixed(1)}（期望 ≈ 167 / 763）`
  )

  const centers = byIdx.map((r) => r.y + r.h / 2)
  check(
    '修正 B：所有卡片与顶卡上下居中对齐（垂直中心一致）',
    Math.max(...centers) - Math.min(...centers) <= 1,
    `中心=${centers.map((v) => v.toFixed(1)).join(' / ')}`
  )
  const insetsTop = byIdx.map((r) => r.y - focusCard.y)
  const insetsBot = byIdx.map((r) => cardBottom - (r.y + r.h))
  check(
    '修正 B：背景层上下内缩对称（不再整体上浮）',
    byIdx.every((_, i) => Math.abs(insetsTop[i] - insetsBot[i]) <= 1),
    `上内缩=${insetsTop.map((v) => v.toFixed(1)).join('/')} 下内缩=${insetsBot.map((v) => v.toFixed(1)).join('/')}`
  )

  check(
    '修正 C：应用图标放大到 24px（原 18px）',
    !!iconBox && Math.abs(iconBox.w - 24) <= 1.5 && Math.abs(iconBox.h - 24) <= 1.5,
    iconBox ? `图标 ${iconBox.w}×${iconBox.h}` : '未找到图标'
  )
  check(
    '修正 C：图标行高 24px（已纳入整体居中的 blockH）',
    Math.abs(labelBox.height - 24) <= 1.5,
    `label 高=${labelBox.height.toFixed(1)}`
  )
}

/* ---- 规则⑥⑦ 背景层差异位移实测（第五轮：比例改为 stair 的几何级数）----
   从静止（焦点=calculator）按住横拖半层（0.5 × SPAN），逐卡量位移：
     · 各层【同向】（都右移）、逐层递减 —— 成立；
     · 层间比例 = STAIR_DECAY（0.55），不再是第四轮的 8:3:2:1。

   为什么必须放弃 8:3:2:1（Ricky 第四轮写的比例）：
     「一整层的净位移」= stair(d) − stair(d−1)。而静止态的露出宽度
     （33 / 18 / 10px —— 来自参考视频实测定标，本脚本上面已断言）把 stair(1)
     钉死在 33 → 层 1 一整层最多只能走 33px。要让它走 142px（= 0.375 × 顶卡 378px，
     即 8:3:2:1 要求的值）就必须叠加「牵连」位移，而牵连必须在 u→1 时归零
     （层 1 得落到居中槽位 frontX）→ 数学上必然产生回退。
     第四轮实测回退 77px，正是 Ricky 第五轮反馈的「往右滑、卡片却在往左移动」。
     ⇒ 第五轮取「不得回退」为最高优先，层间比例随之变成 stair 的幂（0.55^k）。 */
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
    moved.length >= 3 && moved.every((m, i) => (i === 0 ? m.d > 40 : m.d > 0 && m.d < moved[i - 1].d)),
    moved.map((m) => `L${m.idx}:${m.d.toFixed(1)}`).join(' ')
  )
  if (moved.length >= 3) {
    /* 只比【背景层】（L1 起）之间的比例：L0 是正在离场的顶卡，走的是幂律斜坡
       （378 × a^1.6），与背景层的 stair 推进不是同一个函数，不该混在一个比例里。 */
    const bg = moved.slice(1).map((m) => m.d)
    const ratios = []
    for (let k = 1; k < bg.length; k++) ratios.push(bg[k] / bg[k - 1])
    const worst = ratios.length ? Math.max(...ratios.map((v) => Math.abs(v - STAIR_DECAY) / STAIR_DECAY)) : 1
    check(
      `背景层位移比例 ≈ stair 衰减 0.55（实测 ${bg.map((v) => v.toFixed(1)).join(' : ')}，比例 ${ratios.map((v) => v.toFixed(3)).join(' : ')}）`,
      ratios.length >= 1 && worst <= 0.25,
      `最大偏差 ${(worst * 100).toFixed(0)}%（目标 ${STAIR_DECAY}；8:3:2:1 已证明与「不得回退」互斥，见上方注释）`
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

/* ---- 第五轮·问题②：桌面上滑期必须有【可见反馈】（跟手升起）----
   Ricky 第五轮原话：「先从桌面上滑的手感非常差，很难激活多任务。」
   根因 A：deck 被 `v-if="system.appSwitcherOpen"` 门控，而桌面路径没有跟手卡
   → 上滑全程屏幕上一张卡都没有，只剩一层黑遮罩 = 盲滑（修复前实测 p≈0.58 时 deckCount=0）。
   现在手势期间就渲染 deck，入场进度直接跟随 switcherProgress。
   判据：上滑过程中卡片必须在屏上，且随进度【单调升起 + 单调变亮】。 */
{
  const trace = []
  await page.mouse.move(215, 925)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(215, 925 - i * 14, { steps: 1 })
    await page.waitForTimeout(45)
    trace.push(
      await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.switcher-card.is-deck')].map((c) => ({
          i: +c.dataset.index,
          y: +c.getBoundingClientRect().y.toFixed(1),
          op: +getComputedStyle(c).opacity
        }))
        const dim = document.querySelector('.switcher-dim')
        return {
          p: +window.__system.switcherProgress.toFixed(3),
          n: cards.length,
          c0: cards.find((c) => c.i === 0) || null,
          dim: dim ? +getComputedStyle(dim).opacity : null
        }
      })
    )
  }
  const seen = trace.filter((t) => t.n > 0 && t.c0)
  const rises = seen.every((t, k) => k === 0 || t.c0.y <= seen[k - 1].c0.y + 1)
  const brightens = seen.every((t, k) => k === 0 || t.c0.op >= seen[k - 1].c0.op - 0.02)
  const dimSync = seen.every((t) => Math.abs(t.dim - t.p) < 0.02)
  const mid = trace[Math.floor(trace.length / 2)]
  check(
    '第五轮·问题②：桌面上滑过程中屏幕上有卡片（不再是盲滑）',
    seen.length === trace.length && mid.n >= 3,
    `${trace.length} 个采样点全部有卡；中途卡数=${mid.n}；进度 ${trace[0].p} → ${trace[trace.length - 1].p}`
  )
  check(
    '第五轮·问题②：卡片随上滑【单调升起 + 单调变亮】，遮罩同步（跟手）',
    seen.length >= 8 && rises && brightens && dimSync,
    `y: ${seen[0]?.c0?.y} → ${seen[seen.length - 1]?.c0?.y}；` +
      `opacity: ${seen[0]?.c0?.op} → ${seen[seen.length - 1]?.c0?.op}；遮罩与进度同步=${dimSync}`
  )
  await page.mouse.up()
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    if (window.__system.appSwitcherOpen) window.__system.closeSwitcher()
  })
  await page.waitForTimeout(500)
}

// ---- 桌面路径：从桌面直接上滑停驻开切换器（卡片下场后就位）----
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

/* ---- 修正 D（2026-09-12 第三轮）：松手吸附的连续性与弹性 ----
   抽帧量化参考视频得到的目标：τ ≈ 110ms 的缓出 + 到位时约 6.7% 的轻微过冲回弹。
   放在脚本最末：此处状态干净（桌面路径刚打开、焦点 = 0、4 层齐全），不影响任何后续断言。
   守两条可回归的行为不变量：
     ① 无硬跳变 —— 任意相邻帧、任意相邻两层，间距变化 < 10px
        （旧实现松手瞬间把牵连量硬置零、同时关掉 CSS transition → 一帧 30px+ 的突变）；
     ② 轻微过冲 —— 快甩后新焦点卡越过终点再回落（旧版 ios-deck 是 ζ=1.0 临界阻尼、无弹性）。 */
{
  const startX = 110
  const slowPx = Math.round(SPAN * 0.42) // 明显不足半层 → 松手必回原位
  const flickPx = Math.round(SPAN * 0.62) // 过半 → 必翻一层

  // ---- ① 慢拖 0.42 层（牵连明显）→ 停 150ms → 松手 ----
  await page.evaluate(() => {
    window.__d4 = []
    window.__d4Stop = false
    const tick = () => {
      if (window.__d4Stop) return
      const cards = [...document.querySelectorAll('.switcher-card.is-deck')]
      if (cards.length >= 2) {
        window.__d4.push(
          cards.map((el) => ({
            i: +el.dataset.index,
            x: +new DOMMatrixReadOnly(getComputedStyle(el).transform).e.toFixed(2)
          }))
        )
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
  await page.mouse.move(startX, 500)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(startX + (slowPx * i) / 20, 500, { steps: 1 })
    await page.waitForTimeout(8)
  }
  await page.waitForTimeout(150)
  await page.mouse.up()
  await page.waitForTimeout(700)
  const trace = await page.evaluate(() => { window.__d4Stop = true; return window.__d4 })

  /* 按 data-index 对齐算「相邻两层间距」的逐帧序列。
     卡片会在拖动中进出 DOM（数组长度变化），按下标比较会错位 —— 必须按 index 配对。 */
  const gapsOf = (sample) => {
    const m = new Map()
    const byI = new Map(sample.map((r) => [r.i, r.x]))
    for (const r of sample) {
      const nx = byI.get(r.i + 1)
      if (nx != null) m.set(r.i, r.x - nx)
    }
    return m
  }
  let maxJump = 0
  let jumpAt = -1
  for (let i = 1; i < trace.length; i++) {
    const a = gapsOf(trace[i - 1])
    const b = gapsOf(trace[i])
    for (const [k, v] of b) {
      if (!a.has(k)) continue
      const d = Math.abs(v - a.get(k))
      if (d > maxJump) {
        maxJump = d
        jumpAt = i
      }
    }
  }
  const mid = trace[Math.floor(trace.length * 0.4)]
  const peakGap = mid ? gapsOf(mid).get(0) : null

  /* 第五轮换判据：原判据是「任意相邻帧的层间距变化 < 10px」，它把【弹簧正常的加速段】
     也算成跳变 —— 松手后 focus 从 0.42 弹回 0，顶卡要回走 378×0.42^1.6 ≈ 94px，
     由 ios-deck（τ≈110ms）推进，最快一帧本来就有 12.8px。那不是硬跳变（位置连续），
     只是速度高。真正要守的不变量是【连续性 / 无瞬变】，判据应该与尺度无关：
       单帧位移 ÷ 该卡整段总位移 —— 硬跳变（旧版把牵连硬置零）会一次吃掉 ~100%，
       弹簧推进则均匀摊在十几帧上。这里要求 < 20%。 */
  const byCard = new Map()
  for (const sample of trace) {
    for (const r of sample) {
      if (!byCard.has(r.i)) byCard.set(r.i, [])
      byCard.get(r.i).push(r.x)
    }
  }
  let worstShare = 0
  let worstCard = -1
  let worstStep = 0
  for (const [i, xs] of byCard) {
    if (xs.length < trace.length * 0.6) continue // 只看全程在 DOM 里的卡
    const travel = Math.max(...xs) - Math.min(...xs)
    if (travel < 20) continue
    let step = 0
    for (let k = 1; k < xs.length; k++) step = Math.max(step, Math.abs(xs[k] - xs[k - 1]))
    const share = step / travel
    if (share > worstShare) {
      worstShare = share
      worstCard = i
      worstStep = step
    }
  }
  check(
    '修正 D① / 第五轮：松手无硬跳变（位移连续，单帧最多占整段位移的 20%）',
    worstCard >= 0 && worstShare < 0.2,
    `最大单帧位移占比=${(worstShare * 100).toFixed(0)}%（卡 ${worstCard}，单帧 ${worstStep.toFixed(1)}px）` +
      ` · 层间距最大单帧变化=${maxJump.toFixed(1)}px（第 ${jumpAt}/${trace.length} 帧，属弹簧加速段）` +
      ` · 拖动中最大层间距=${peakGap != null ? peakGap.toFixed(1) : '?'}px`
  )

  // ---- ② 快甩 0.62 层 → 采样第 2 张卡的 x，看是否越过终点再回落 ----
  await page.evaluate(() => {
    window.__d4b = []
    window.__d4bStop = false
    const tick = () => {
      if (window.__d4bStop) return
      const c = document.querySelector('.switcher-card.is-deck[data-index="1"]')
      if (c) window.__d4b.push(+new DOMMatrixReadOnly(getComputedStyle(c).transform).e.toFixed(2))
      requestAnimationFrame(tick)
    }
    tick()
  })
  await page.mouse.move(startX, 500)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(startX + (flickPx * i) / 6, 500, { steps: 1 })
    await page.waitForTimeout(6)
  }
  await page.mouse.up()
  await page.waitForTimeout(800)
  const ft = await page.evaluate(() => { window.__d4bStop = true; return window.__d4b })
  if (ft.length > 12) {
    const peak = Math.max(...ft)
    const iPeak = ft.indexOf(peak)
    const finalX = ft[ft.length - 1]
    check(
      '修正 D②：松手吸附带轻微过冲回弹（ζ=0.65，不是临界阻尼的死板收尾）',
      peak > finalX + 3 && iPeak < ft.length - 3,
      `终点 x=${finalX} 峰值 x=${peak} 过冲=${(peak - finalX).toFixed(1)}px（峰值在第 ${iPeak}/${ft.length} 帧）`
    )
  } else {
    check('修正 D②：松手吸附带轻微过冲回弹（ζ=0.65，不是临界阻尼的死板收尾）', false, `采样不足 ${ft.length}`)
  }
}

/* ---- 第五轮·定律三（2026-09-12）：卡片之间的【相对运动】----
   Ricky 第五轮原话：「最顶部的卡片消失后，继续右滑顶部卡片会非常反直觉的先回到中心位置，
   也就是往右滑的时候卡片在往左移动，导致动画断掉了。」

   第四轮用「牵连包络」去满足 8:3:2:1 与「两卡贴合」，代价就是回退：底卡左缘
   52.7 → 101.9（峰值）→ 77.5，回退 24px；顶卡出屏点附近还有一次 77px 的二次回退。
   根因（数学）：层位置 = frontX − stair(aEff)，而牵连必须在 u→1 时归零
   （第 1 层要落到居中槽位 frontX）→ 任何「有峰值」的牵连都必然回退。
   第五轮直接把牵连删掉，位置只剩槽位推进 → 严格单调。

   现在守的定律（优先级高于第四轮的「贴合」）：
     ③ 不得回退 —— 拖动全程任何一张卡的位置与缩放都随手指严格单调；
   代价（几何必然，已在上面第 2 条断言里量化）：层 1 一整层只走 stair(1) = 33px，
     且顶卡出屏前两卡最多留出 ≈ 77px 的空隙 —— 顶卡左缘到 430 时，居中底卡
     （scale 1）的右缘最多 frontX + cardW = 352.5，必然留 77px。
   本块拖 1.25 层，是为了让采样覆盖【顶卡完全出屏之后】那一段 ——
   第四轮的验证盲区（断言只看到「顶卡还在屏内」）恰好就在那里。 */
{
  const dragPx = Math.round(SPAN * 1.25) // 覆盖「顶卡完全出屏之后」的拖动段
  await page.evaluate(() => {
    window.__e5 = []
    window.__e5Stop = false
    const tick = () => {
      if (window.__e5Stop) return
      const cards = [...document.querySelectorAll('.switcher-card.is-deck')].map((el) => {
        const r = el.getBoundingClientRect()
        return {
          i: +el.dataset.index,
          x: +r.left.toFixed(2),
          r: +r.right.toFixed(2),
          s: +new DOMMatrixReadOnly(getComputedStyle(el).transform).a.toFixed(4)
        }
      })
      if (cards.length >= 2) window.__e5.push(cards)
      requestAnimationFrame(tick)
    }
    tick()
  })
  const startX = 60
  await page.mouse.move(startX, 500)
  await page.mouse.down()
  const steps = 60
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (dragPx * i) / steps, 500, { steps: 1 })
    await page.waitForTimeout(14)
  }
  await page.waitForTimeout(140)
  const trace = await page.evaluate(() => {
    window.__e5Stop = true
    return window.__e5
  })
  await page.mouse.up()
  await page.waitForTimeout(800)

  /* 配对：锁定同一对卡（退出中的顶卡 i 与被它拖着走的 i+1）。
     第一帧 x 最大的那张 = 当前退出的顶卡；之后只统计 index 不变的同一对，
     否则顶卡出屏后配对会漂到下一对，把两张卡的位移混在一起。 */
  const first = trace[0] || []
  // 只取【还在屏内】的最大 x —— 已出屏的旧卡（x ≥ 屏宽）会先被 deckVisible 剔除，
  // 拿它当顶卡的话配对只活 4 帧。
  const firstTop = [...first].filter((c) => c.x < screenBox.width).sort((a, b) => b.x - a.x)[0]
  const TOP_I = firstTop ? firstTop.i : -1
  const NEXT_I = TOP_I + 1
  let minGap = Infinity
  let sepAt = null
  let mono = true
  let scaleMono = true
  let peakDrift = 0
  let growthWhileDragged = false
  let base = null
  let maxNextX = -Infinity
  let frames = 0
  let exitedAt = null // 顶卡完全出屏的第一帧（记下此刻底卡已经走了多少）
  for (const sample of trace) {
    const top = sample.find((c) => c.i === TOP_I)
    const next = sample.find((c) => c.i === NEXT_I)
    if (!top || !next) continue
    frames++
    const onScreen = top.x < screenBox.width // 顶卡还留在屏幕上
    const gap = next.r - top.x
    if (onScreen && gap < minGap) minGap = gap
    if (gap < -1.5 && !sepAt) sepAt = { topX: top.x }
    if (!base) base = { x: next.x, s: next.s }
    /* 第五轮：去掉原来的 `onScreen &&` 前提 —— 第四轮就是靠这个前提「看不到」出屏点
       之后的回退（断言区间与缺陷区间不相交）。现在整段拖动都必须单调。 */
    if (next.x < maxNextX - 0.6) mono = false
    if (!onScreen && exitedAt === null) exitedAt = next.x - base.x
    maxNextX = Math.max(maxNextX, next.x)
    if (next.s < base.s - 1e-6) scaleMono = false
    peakDrift = Math.max(peakDrift, next.x - base.x)
    if (next.x - base.x >= 25 && next.s - base.s >= 0.005) growthWhileDragged = true
  }
  check(
    '第五轮·定律三：背景层【全程】单调右移，绝不回退（含顶卡完全出屏之后）',
    frames >= 20 && mono,
    `最大右移 ${peakDrift.toFixed(1)}px；顶卡出屏那一刻底卡已走 ${exitedAt != null ? exitedAt.toFixed(1) : '?'}px` +
      `（改前：峰值 57px 后回退 24px，出屏点附近还有一次 77px 二次回退）`
  )
  check(
    '第五轮·几何必然：顶卡出屏前两卡会留空隙（≤85px），分离点由纯几何给出',
    frames >= 20 && minGap > -85 && minGap < 0 && (!sepAt || sepAt.topX >= 250),
    `顶卡在屏内时最小重叠=${minGap.toFixed(1)}px（第四轮靠「牵连」强行贴合 → 代价就是回退）；` +
      `分离时顶卡左缘=${sepAt ? sepAt.topX.toFixed(1) : '—'}px（屏宽 ${screenBox.width}）`
  )
  check(
    '第五轮：背景层一整层净位移 = stair(1) ≈ 33px（与第四轮的【净】位移相当，但没有回退）',
    peakDrift >= 28 && peakDrift <= 38,
    `实测 ${peakDrift.toFixed(1)}px（第四轮：峰值 57.3px 回退 24px → 净 ≈ 33px）`
  )
  check(
    '第五轮：位移与放大同时发生（不是先位移再放大）',
    growthWhileDragged && scaleMono,
    `scale 全程单调=${scaleMono} 位移≥25px 时已同步放大=${growthWhileDragged}`
  )
}

check('无控制台报错', errs.length === 0, errs.slice(0, 3).join(' | '))

await page.screenshot({ path: 'shots/app-switcher.png' })
await browser.close()
console.log(allOk ? '\n全部通过 ✅' : '\n存在失败 ❌')
process.exit(allOk ? 0 : 1)
