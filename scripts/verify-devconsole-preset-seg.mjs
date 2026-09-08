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

const LABELS = { camon: 'CAMON', note: 'NOTE', gt: 'GT', hios17: 'HiOS 17', note17: 'NOTE 17', gt17: 'GT 17' }
const presets = ['camon', 'note', 'gt', 'hios17', 'note17', 'gt17']
let ok = true
const check = (n, c, d) => { if (!c) ok = false; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }

for (const id of presets) {
  await page.evaluate((pid) => window.__control.setLayoutPreset(pid), id)
  await page.waitForTimeout(450) // 等 Vue 重渲染 + 0.28s 滑块过渡完成
  const r = await page.evaluate((label) => {
    const btn = [...document.querySelectorAll('.pc-seg-btn')].find((b) => b.textContent.trim() === label)
    if (!btn) return { missing: true }
    const seg = btn.closest('.pc-seg')
    const thumb = seg.querySelector('.pc-seg-thumb-3')
    const tr = thumb.getBoundingClientRect()
    const br = btn.getBoundingClientRect()
    return {
      thumbLeft: +tr.left.toFixed(1), thumbRight: +tr.right.toFixed(1),
      btnLeft: +br.left.toFixed(1), btnRight: +br.right.toFixed(1),
      idx: [...seg.querySelectorAll('.pc-seg-btn')].indexOf(btn),
      n: seg.querySelectorAll('.pc-seg-btn').length
    }
  }, LABELS[id])
  if (r.missing) { check(`预设 ${id}: 按钮存在`, false, '找不到对应 label 的按钮'); continue }
  const dl = Math.abs(r.thumbLeft - r.btnLeft)
  const dr = Math.abs(r.thumbRight - r.btnRight)
  console.log(`[${id}] 段数=${r.n} 高亮左=${r.thumbLeft} 右=${r.thumbRight} / 按钮左=${r.btnLeft} 右=${r.btnRight}`)
  check(`预设 ${id}: 高亮条命中第 ${r.idx} 段`, true)
  check(`预设 ${id}: 左对齐(误差<2px)`, dl < 2, `Δ左=${dl}`)
  check(`预设 ${id}: 右对齐(误差<2px)`, dr < 2, `Δ右=${dr}`)
}

console.log(errs.length ? '\n控制台错误: ' + errs.join('; ') : '\n无控制台错误')
await browser.close()
console.log(ok ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(ok ? 0 : 1)
