import { chromium } from 'playwright'
const PORT = process.argv[2] || '5678'
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

const presets = ['camon', 'note', 'gt', 'hios17']
let ok = true
const check = (n, c, d) => { if (!c) ok = false; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }

for (const id of presets) {
  await page.evaluate((pid) => window.__control.setLayoutPreset(pid), id)
  await page.waitForTimeout(450) // 等 Vue 重渲染 + 0.28s 滑块过渡完成
  const r = await page.evaluate(() => {
    const segs = [...document.querySelectorAll('.pc-seg')]
    const seg = segs.find((s) => [...s.querySelectorAll('.pc-seg-btn')].some((b) => /HiOS|CAMON|NOTE|GT/.test(b.textContent)))
    const thumb = seg.querySelector('.pc-seg-thumb-3')
    const btns = [...seg.querySelectorAll('.pc-seg-btn')]
    const ti = btns.findIndex((b) => b.classList.contains('on'))
    const tr = thumb.getBoundingClientRect()
    const br = btns[ti].getBoundingClientRect()
    return {
      thumbLeft: +tr.left.toFixed(1), thumbRight: +tr.right.toFixed(1), thumbW: +tr.width.toFixed(1),
      btnLeft: +br.left.toFixed(1), btnRight: +br.right.toFixed(1), btnW: +br.width.toFixed(1), idx: ti, n: btns.length
    }
  })
  const dl = Math.abs(r.thumbLeft - r.btnLeft)
  const dr = Math.abs(r.thumbRight - r.btnRight)
  console.log(`[${id}] 段数=${r.n} 高亮左=${r.thumbLeft} 右=${r.thumbRight} / 按钮左=${r.btnLeft} 右=${r.btnRight}`)
  check(`预设 ${id}: 高亮条命中第 ${r.idx} 段`, r.idx === presets.indexOf(id), `idx=${r.idx}`)
  check(`预设 ${id}: 左对齐(误差<2px)`, dl < 2, `Δ左=${dl}`)
  check(`预设 ${id}: 右对齐(误差<2px)`, dr < 2, `Δ右=${dr}`)
}

console.log(errs.length ? '\n控制台错误: ' + errs.join('; ') : '\n无控制台错误')
await browser.close()
console.log(ok ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(ok ? 0 : 1)
