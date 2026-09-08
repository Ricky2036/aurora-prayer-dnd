/* 校验：热点 / 静音 / 振动 / 勿扰 启用后状态栏显示对应图标（且与开关按钮同源）
 * 用法: node scripts/verify-status-bar.mjs [port] */
import { chromium } from 'playwright'

const PORT = process.argv[2] || '5678'
const CHROME =
  process.env.PLAYWRIGHT_CHROME ||
  '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'

const browser = await chromium.launch({ executablePath: CHROME })
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

const helper = {
  async set(fn) {
    await page.evaluate(fn)
    await page.waitForTimeout(150)
  },
  /** 返回状态栏右侧每个指示器的全部 path d（数组的数组，支持多 path 图标） */
  async indicators() {
    return page.evaluate(() => {
      const sb = document.querySelector('.status-bar .sb-right')
      if (!sb) return { found: false, count: 0, inds: [] }
      const inds = [...sb.querySelectorAll('.sb-ind')].map((el) =>
        [...el.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
      )
      return { found: true, count: inds.length, inds }
    })
  },
  /** 取某磁贴 LIcon 的全部 path d（按顺序） */
  async tilePaths(dataId) {
    return page.evaluate((id) => {
      const cell = document.querySelector(`[data-id="${id}"]`)
      return [...(cell?.querySelectorAll('.l-icon svg path') || [])].map((p) => p.getAttribute('d'))
    }, dataId)
  },
  /** 在网格里找一个 .l-icon 与给定 path 列表完全一致的磁贴（证明状态栏图标复用了某个开关按钮同款） */
  async findTileWithPaths(paths) {
    if (!paths || !paths.length) return null
    return page.evaluate((ds) => {
      if (!ds || !ds.length) return null
      const cells = [...document.querySelectorAll('[data-id]')]
      for (const cell of cells) {
        // 遍历磁贴内每个 LIcon，逐个比较其 svg 的全部 path（顺序+数量+内容完全一致）
        const icons = [...cell.querySelectorAll('.l-icon')]
        for (const icon of icons) {
          const cellDs = [...icon.querySelectorAll('svg path')].map((p) => p.getAttribute('d'))
          if (cellDs.length === ds.length && ds.every((d, i) => d === cellDs[i])) {
            return cell.getAttribute('data-id')
          }
        }
      }
      return null
    }, paths)
  }
}

let allOk = true
function check(name, cond, detail) {
  const ok = !!cond
  if (!ok) allOk = false
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
}

// 1) 全关 → 0 指示器
await helper.set(() => {
  const c = window.__control
  c.dnd = false; c.doNotDisturb = false; c.hotspot = false; c.soundMode = 'ring'
})
let r = await helper.indicators()
check('全关时状态栏无指示器', r.found && r.count === 0, `count=${r.count}`)

// 2) 热点
await helper.set(() => { window.__control.hotspot = true })
r = await helper.indicators()
check('热点开启 → 1 个指示器', r.count === 1, `count=${r.count}`)
let match = await helper.findTileWithPaths(r.inds[0])
check('热点指示器复用某个开关按钮同款图标', match !== null, `匹配磁贴: ${match}`)

// 3) 勿扰 (控制中心入口 control.dnd)
await helper.set(() => { window.__control.hotspot = false; window.__control.dnd = true })
r = await helper.indicators()
check('勿扰(control.dnd)开启 → 1 个指示器', r.count === 1, `count=${r.count}`)
match = await helper.findTileWithPaths(r.inds[0])
check('勿扰指示器复用某个开关按钮同款图标', match !== null, `匹配磁贴: ${match}`)

// 4) 勿扰 (设置页入口 control.doNotDisturb)
await helper.set(() => { window.__control.dnd = false; window.__control.doNotDisturb = true })
r = await helper.indicators()
check('勿扰(control.doNotDisturb)也点亮状态栏', r.count === 1, `count=${r.count}`)

// 5) 静音
await helper.set(() => { window.__control.doNotDisturb = false; window.__control.soundMode = 'mute' })
r = await helper.indicators()
check('静音 → 1 个指示器', r.count === 1, `count=${r.count}`)
match = await helper.findTileWithPaths(r.inds[0])
check('静音指示器复用某个开关按钮同款图标', match !== null, `匹配磁贴: ${match}`)

// 6) 振动
await helper.set(() => { window.__control.soundMode = 'vibrate' })
r = await helper.indicators()
check('振动 → 1 个指示器', r.count === 1, `count=${r.count}`)
match = await helper.findTileWithPaths(r.inds[0])
check('振动指示器复用某个开关按钮同款图标', match !== null, `匹配磁贴: ${match}`)

// 7) 全开 → 4 个指示器
await helper.set(() => {
  const c = window.__control
  c.hotspot = true; c.dnd = true; c.soundMode = 'vibrate'
})
r = await helper.indicators()
check('热点+勿扰+振动 同时开启 → 3 个指示器（静音/振动互斥，不叠加）', r.count === 3, `count=${r.count}`)

await browser.close()
console.log(allOk ? '\n全部通过 ✅' : '\n有失败项 ❌')
process.exit(allOk ? 0 : 1)
