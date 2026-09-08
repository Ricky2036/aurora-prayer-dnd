/* 校验：
 * 1) 双卡第 2 行右侧只剩蓝牙一颗图标
 * 2) 这颗蓝牙与「蓝牙按钮」复用同一个图标（path d 完全一致）
 * 3) 移动数据 2x1 卡片标题 = 中国电信（走 i18n）
 * 用法: node scripts/verify-status-bluetooth.mjs [port] */
import { chromium } from 'playwright'

const PORT = process.argv[2] || '5678'
const CHROME_FALLBACK =
  process.env.PLAYWRIGHT_CHROME ||
  '/Users/jingzhan.chen/Workbuddy/2026-08-02-23-04-06/node_modules/.bin/x'

const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROME ||
    '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
})
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 })
const page = await ctx.newPage()
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })

// 打开控制中心（从屏幕顶部右侧下拉）
const box = await page.locator('.phone-screen, .device-screen, body').first().boundingBox()
await page.mouse.move(box.x + box.width - 30, box.y + 8)
await page.mouse.down()
await page.mouse.move(box.x + box.width - 30, box.y + 320, { steps: 18 })
await page.mouse.up()
await page.waitForTimeout(700)

// 打开双卡
await page.evaluate(() => window.__control.setShowDualSim(true))
await page.waitForTimeout(400)

const data = await page.evaluate(() => {
  const sub = document.querySelector('.cc-status-sub-icons')
  const svgs = sub ? [...sub.querySelectorAll('svg')] : []
  const btCell = document.querySelector('[data-id="bluetooth"]')
  const btBtnSvg = btCell?.querySelector('.l-icon svg')
  const dataCell = document.querySelector('[data-id="data"]')
  const pillTitle = dataCell?.querySelector('.cc-pill-title')?.textContent.trim()
  const carriers = [...document.querySelectorAll('.cc-carrier')].map((e) => e.textContent.trim())
  return {
    allIds: [...document.querySelectorAll('[data-id]')].map((e) => e.getAttribute('data-id')),
    btCellFound: !!btCell,
    dataCellFound: !!dataCell,
    subIconCount: svgs.length,
    subSvgInfo: svgs.map((s) => {
      const r = s.getBoundingClientRect()
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        stroke: s.getAttribute('stroke'),
        fill: s.getAttribute('fill'),
        strokeWidth: s.getAttribute('stroke-width'),
        firstPathD: (s.querySelector('path')?.getAttribute('d') || '').slice(0, 60)
      }
    }),
    btBtnFirstPathD: (btBtnSvg?.querySelector('path')?.getAttribute('d') || '').slice(0, 60),
    pillTitle,
    carriers
  }

})

console.log('\n=== 双卡第 2 行右侧图标 ===')
console.log(`图标数量: ${data.subIconCount} （期望 1）`)
data.subSvgInfo.forEach((s) =>
  console.log(`  svg ${s.w}x${s.h} fill=${s.fill} stroke=${s.stroke} stroke-width=${s.strokeWidth}`)
)
console.log(`  path d 前 60 字符: ${data.subSvgInfo[0]?.firstPathD}`)

console.log('\n=== 与蓝牙按钮图标对比 ===')
console.log(`  找到蓝牙磁贴: ${data.btCellFound}`)
if (!data.btCellFound) console.log(`  所有 data-id: ${JSON.stringify(data.allIds)}`)
const same = data.subIconCount === 1 && !!data.btBtnFirstPathD && data.subSvgInfo[0].firstPathD === data.btBtnFirstPathD
console.log(`  按钮 path d 前 60 字符: ${data.btBtnFirstPathD || '(空)'}`)
console.log(`  复用同一图标: ${same ? 'PASS' : 'FAIL'}`)

console.log('\n=== 移动数据卡片标题 ===')
console.log(`  找到 data 磁贴: ${data.dataCellFound}`)
console.log(`  标题: 「${data.pillTitle}」 ${data.pillTitle === '中国电信' ? 'PASS' : 'FAIL'}`)
console.log(`  状态行运营商: ${JSON.stringify(data.carriers)}`)

// 放大截图状态行 + 数据卡片
const status = page.locator('.cc-status')
await status.screenshot({ path: 'shots/53-cc-status-bluetooth.png' })
await page.screenshot({ path: 'shots/54-cc-dual-sim.png' })
await browser.close()
