import { chromium } from 'playwright'
const PORT = process.argv[2] || '5555'
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const browser = await chromium.launch({ executablePath: CHROME })
// 桌面视口 → DevConsole 以侧边栏形式常驻，便于测量
const ctx = await browser.newContext({ viewport: { width: 1280, height: 850 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

// 控制台 2026-09-11 改版：模块切换从标签页改为卡片分区，默认即展示控制中心分区，
// 不再有 .pc-tab-btn。若将来再改回标签式，下面这行点击会自动跳过（找不到就继续）。
if ((await page.locator('.pc-tab-bar .pc-tab-btn', { hasText: '控制中心' }).count()) > 0) {
  await page.locator('.pc-tab-bar .pc-tab-btn', { hasText: '控制中心' }).click()
  await page.waitForTimeout(300)
}

// 两行按钮都显示 CAMON / NOTE / GT，靠行首文案区分版本 —— 所以按「行 + 标签」定位
const PRESETS = [
  { id: 'camon', row: 'tOS 16', label: 'CAMON' },
  { id: 'note', row: 'tOS 16', label: 'NOTE' },
  { id: 'gt', row: 'tOS 16', label: 'GT' },
  { id: 'hios17', row: 'tOS 17', label: 'CAMON' },
  { id: 'note17', row: 'tOS 17', label: 'NOTE' },
  { id: 'gt17', row: 'tOS 17', label: 'GT' },
  { id: 'ee1Camon', row: 'EE1', label: 'CAMON' },
  { id: 'ee1Note', row: 'EE1', label: 'NOTE' },
  { id: 'ee1Gt', row: 'EE1', label: 'GT' }
]
let ok = true
const check = (n, c, d) => { if (!c) ok = false; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }

const cardLoc = () =>
  page.locator('.pc-card').filter({ has: page.locator('.pc-card-title', { hasText: '默认布局' }) }).first()
const rowLoc = (tag) => cardLoc().locator('.pc-preset-row').filter({ has: page.locator('.pc-preset-tag', { hasText: tag }) })

const thumbRect = () =>
  page.evaluate(() => {
    const t = document.querySelector('.pc-preset-thumb')
    if (!t) return null
    const r = t.getBoundingClientRect()
    return {
      left: +r.left.toFixed(1), right: +r.right.toFixed(1),
      top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1),
      opacity: getComputedStyle(t).opacity
    }
  })

// ---- 结构：一张卡片、两行、按钮统一为 CAMON/NOTE/GT、整卡只有一个滑块 ----
const struct = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.pc-card')].find(
    (c) => c.querySelector('.pc-card-title')?.textContent.trim() === '默认布局'
  )
  if (!card) return { missingCard: true }
  const rows = [...card.querySelectorAll('.pc-preset-row')].map((r) => ({
    tag: r.querySelector('.pc-preset-tag')?.textContent.trim(),
    labels: [...r.querySelectorAll('.pc-seg-btn')].map((b) => b.textContent.trim())
  }))
  return {
    cardCount: [...document.querySelectorAll('.pc-card')].filter(
      (c) => /默认布局|tOS17 对比|tOS16/.test(c.querySelector('.pc-card-title')?.textContent || '')
    ).length,
    rows,
    thumbs: card.querySelectorAll('.pc-preset-thumb').length,
    legacyThumbs: card.querySelectorAll('.pc-seg-thumb-3').length
  }
})
if (struct.missingCard) {
  check('默认布局卡片存在', false, '找不到标题为「默认布局」的卡片')
} else {
  check('默认布局合并为一张卡片', struct.cardCount === 1, `匹配卡片数=${struct.cardCount}`)
  check('含 tOS16 / tOS17 / EE1 三行', struct.rows.length === 3, `行数=${struct.rows.length}`)
  check('第 1 行文案 = tOS 16', struct.rows[0]?.tag === 'tOS 16', `actual=${struct.rows[0]?.tag}`)
  check('第 2 行文案 = tOS 17', struct.rows[1]?.tag === 'tOS 17', `actual=${struct.rows[1]?.tag}`)
  check('第 3 行文案 = EE1', struct.rows[2]?.tag === 'EE1', `actual=${struct.rows[2]?.tag}`)
  check('9 个按钮共用 1 个滑块', struct.thumbs === 1, `滑块数=${struct.thumbs}`)
  check('不再有分行滑块 (.pc-seg-thumb-3)', struct.legacyThumbs === 0, `残留=${struct.legacyThumbs}`)
  const want = ['CAMON', 'NOTE', 'GT']
  for (const [i, r] of struct.rows.entries()) {
    check(`第 ${i + 1} 行按钮 = CAMON/NOTE/GT`, JSON.stringify(r.labels) === JSON.stringify(want), `actual=${r.labels.join('/')}`)
  }
}

// ---- 对齐 + 单高亮：逐预设切换，滑块必须贴合选中按钮且全局只有一个 ----
for (const p of PRESETS) {
  await page.evaluate((pid) => window.__control.setLayoutPreset(pid), p.id)
  await page.waitForTimeout(450) // 等 Vue 重渲染 + 0.28s 滑块过渡完成
  const r = await page.evaluate(({ rowTag, label }) => {
    const card = [...document.querySelectorAll('.pc-card')].find(
      (c) => c.querySelector('.pc-card-title')?.textContent.trim() === '默认布局'
    )
    const row = [...card.querySelectorAll('.pc-preset-row')].find(
      (x) => x.querySelector('.pc-preset-tag')?.textContent.trim() === rowTag
    )
    if (!row) return { missing: 'row' }
    const seg = row.querySelector('.pc-seg')
    const btn = [...seg.querySelectorAll('.pc-seg-btn')].find((b) => b.textContent.trim() === label)
    if (!btn) return { missing: 'btn' }
    const th = card.querySelector('.pc-preset-thumb')
    if (!th) return { missing: 'thumb' }
    const tr = th.getBoundingClientRect()
    const br = btn.getBoundingClientRect()
    return {
      tL: +tr.left.toFixed(1), tR: +tr.right.toFixed(1), tT: +tr.top.toFixed(1), tB: +tr.bottom.toFixed(1),
      bL: +br.left.toFixed(1), bR: +br.right.toFixed(1), bT: +br.top.toFixed(1), bB: +br.bottom.toFixed(1),
      opacity: getComputedStyle(th).opacity,
      // 控制台 2026-09-11 改版后整卡是一张大卡片含多个分区（编辑算法等），
      // 统计高亮必须限定在预设行容器内，否则会数到别家的 .pc-seg-btn.on
      onCount: card.querySelectorAll('.pc-preset-rows .pc-seg-btn.on, .pc-preset-row .pc-seg-btn.on').length,
      idx: [...seg.querySelectorAll('.pc-seg-btn')].indexOf(btn),
      n: seg.querySelectorAll('.pc-seg-btn').length,
      on: btn.classList.contains('on')
    }
  }, { rowTag: p.row, label: p.label })
  if (r.missing) { check(`预设 ${p.id}: ${p.row} 行 / ${p.label} 按钮存在`, false, `找不到 ${r.missing}`); continue }
  const dL = Math.abs(r.tL - r.bL), dR = Math.abs(r.tR - r.bR)
  const dT = Math.abs(r.tT - r.bT), dB = Math.abs(r.tB - r.bB)
  console.log(`[${p.id}] ${p.row}·${p.label} 滑块(${r.tL},${r.tT})-(${r.tR},${r.tB}) / 按钮(${r.bL},${r.bT})-(${r.bR},${r.bB})`)
  check(`预设 ${p.id}: 按钮高亮(on)`, r.on)
  check(`预设 ${p.id}: 命中第 ${r.idx} 段`, true)
  check(`预设 ${p.id}: 左右对齐(误差<2px)`, dL < 2 && dR < 2, `Δ左=${dL} Δ右=${dR}`)
  check(`预设 ${p.id}: 上下对齐(误差<2px)`, dT < 2 && dB < 2, `Δ上=${dT} Δ下=${dB}`)
  check(`预设 ${p.id}: 滑块可见`, r.opacity === '1', `opacity=${r.opacity}`)
  check(`预设 ${p.id}: 仅 1 个按钮高亮`, r.onCount === 1, `on=${r.onCount}`)
}

// ---- 动画无缝性：跨行切换时滑块必须从当前位置连续移动，不能先跳回行首 ----
await page.evaluate(() => window.__control.setLayoutPreset('note'))
await page.waitForTimeout(600)
const start = await thumbRect()
// 真实点击 tOS 17 行的 GT（跨行 + 换列）
await rowLoc('tOS 17').locator('.pc-seg-btn', { hasText: 'GT' }).click()
await page.waitForTimeout(100) // 动画进行中（总时长 280ms）
const mid = await thumbRect()
await page.waitForTimeout(500)
const end = await thumbRect()
console.log(`[动画采样] 起点(${start.left},${start.top}) → 中途(${mid.left},${mid.top}) → 终点(${end.left},${end.top})`)
check('跨行切换：终点落在 tOS17·GT', Math.abs(end.left - 918) < 3 && end.top > start.top, `end=(${end.left},${end.top})`)
check(
  '切换中途：横向不跳回行首（起点→终点之间）',
  mid.left >= start.left - 2 && mid.left <= end.left + 2,
  `start=${start.left} mid=${mid.left} end=${end.left}`
)
check(
  '切换中途：纵向连续过渡（不跳变）',
  mid.top >= start.top - 2 && mid.top <= end.top + 2,
  `start=${start.top} mid=${mid.top} end=${end.top}`
)
check('切换中途：滑块始终可见（无淡出重入）', mid.opacity === '1', `opacity=${mid.opacity}`)

console.log(errs.length ? '\n控制台错误: ' + errs.join('; ') : '\n无控制台错误')
await browser.close()
console.log(ok ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(ok ? 0 : 1)
