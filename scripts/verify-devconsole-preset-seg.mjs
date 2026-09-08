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

// 切到「控制中心」页签
await page.locator('.pc-tab-bar .pc-tab-btn', { hasText: '控制中心' }).click()
await page.waitForTimeout(300)

// 两行按钮都显示 CAMON / NOTE / GT，靠行首文案区分版本 —— 所以按「行 + 标签」定位
const PRESETS = [
  { id: 'camon', row: 'tOS 16', label: 'CAMON' },
  { id: 'note', row: 'tOS 16', label: 'NOTE' },
  { id: 'gt', row: 'tOS 16', label: 'GT' },
  { id: 'hios17', row: 'tOS 17', label: 'CAMON' },
  { id: 'note17', row: 'tOS 17', label: 'NOTE' },
  { id: 'gt17', row: 'tOS 17', label: 'GT' }
]
let ok = true
const check = (n, c, d) => { if (!c) ok = false; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }

// ---- 结构：默认布局只有一张卡片，内含 tOS16 / tOS17 两行，按钮统一为 CAMON/NOTE/GT ----
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
    rows
  }
})
if (struct.missingCard) {
  check('默认布局卡片存在', false, '找不到标题为「默认布局」的卡片')
} else {
  check('默认布局合并为一张卡片', struct.cardCount === 1, `匹配卡片数=${struct.cardCount}`)
  check('含 tOS16 / tOS17 两行', struct.rows.length === 2, `行数=${struct.rows.length}`)
  check('第 1 行文案 = tOS 16', struct.rows[0]?.tag === 'tOS 16', `actual=${struct.rows[0]?.tag}`)
  check('第 2 行文案 = tOS 17', struct.rows[1]?.tag === 'tOS 17', `actual=${struct.rows[1]?.tag}`)
  const want = ['CAMON', 'NOTE', 'GT']
  for (const [i, r] of struct.rows.entries()) {
    check(`第 ${i + 1} 行按钮 = CAMON/NOTE/GT`, JSON.stringify(r.labels) === JSON.stringify(want), `actual=${r.labels.join('/')}`)
  }
}

// ---- 高亮条对齐：逐预设切换，测所在行的 thumb 是否贴合对应按钮 ----
for (const p of PRESETS) {
  await page.evaluate((pid) => window.__control.setLayoutPreset(pid), p.id)
  await page.waitForTimeout(450) // 等 Vue 重渲染 + 0.28s 滑块过渡完成
  const r = await page.evaluate(({ rowTag, label }) => {
    const row = [...document.querySelectorAll('.pc-preset-row')].find(
      (x) => x.querySelector('.pc-preset-tag')?.textContent.trim() === rowTag
    )
    if (!row) return { missing: 'row' }
    const seg = row.querySelector('.pc-seg')
    const btn = [...seg.querySelectorAll('.pc-seg-btn')].find((b) => b.textContent.trim() === label)
    if (!btn) return { missing: 'btn' }
    const tr = seg.querySelector('.pc-seg-thumb-3').getBoundingClientRect()
    const br = btn.getBoundingClientRect()
    return {
      thumbLeft: +tr.left.toFixed(1), thumbRight: +tr.right.toFixed(1),
      btnLeft: +br.left.toFixed(1), btnRight: +br.right.toFixed(1),
      idx: [...seg.querySelectorAll('.pc-seg-btn')].indexOf(btn),
      n: seg.querySelectorAll('.pc-seg-btn').length,
      on: btn.classList.contains('on')
    }
  }, { rowTag: p.row, label: p.label })
  if (r.missing) { check(`预设 ${p.id}: ${p.row} 行 / ${p.label} 按钮存在`, false, `找不到 ${r.missing}`); continue }
  const dl = Math.abs(r.thumbLeft - r.btnLeft)
  const dr = Math.abs(r.thumbRight - r.btnRight)
  console.log(`[${p.id}] ${p.row}·${p.label} 段数=${r.n} 高亮左=${r.thumbLeft} 右=${r.thumbRight} / 按钮左=${r.btnLeft} 右=${r.btnRight}`)
  check(`预设 ${p.id}: 按钮高亮(on)`, r.on)
  check(`预设 ${p.id}: 高亮条命中第 ${r.idx} 段`, true)
  check(`预设 ${p.id}: 左对齐(误差<2px)`, dl < 2, `Δ左=${dl}`)
  check(`预设 ${p.id}: 右对齐(误差<2px)`, dr < 2, `Δ右=${dr}`)

  // 6 个按钮同属一张卡片 → 全局只能有 1 个高亮，另一行的滑块必须隐藏
  const solo = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.pc-card')].find(
      (c) => c.querySelector('.pc-card-title')?.textContent.trim() === '默认布局'
    )
    return {
      onCount: card.querySelectorAll('.pc-seg-btn.on').length,
      idleThumbs: card.querySelectorAll('.pc-seg-thumb-3.is-idle').length,
      visibleThumbs: [...card.querySelectorAll('.pc-seg-thumb-3')].filter(
        (t) => getComputedStyle(t).opacity !== '0'
      ).length
    }
  })
  check(`预设 ${p.id}: 仅 1 个按钮高亮`, solo.onCount === 1, `on=${solo.onCount}`)
  check(
    `预设 ${p.id}: 仅 1 个滑块可见（另一行隐藏）`,
    solo.visibleThumbs === 1 && solo.idleThumbs === 1,
    `visible=${solo.visibleThumbs} idle=${solo.idleThumbs}`
  )
}

console.log(errs.length ? '\n控制台错误: ' + errs.join('; ') : '\n无控制台错误')
await browser.close()
console.log(ok ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(ok ? 0 : 1)
