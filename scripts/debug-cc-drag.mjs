/* 用合成的 DragEvent 验证控制中心拖拽重排逻辑 */
import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const BASE = process.env.PROTO_URL || 'http://127.0.0.1:5175/'
const OUT = new URL('../shots/', import.meta.url).pathname

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 940 } })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(700)

const screen = await page.locator('.screen-view').boundingBox()
const cx = screen.x + screen.width / 2

// 解锁
await page.mouse.move(cx, screen.y + 700)
await page.mouse.down()
await page.mouse.move(cx, screen.y + 200, { steps: 14 })
await page.mouse.up()
await page.waitForTimeout(900)

// 打开控制中心 → 编辑模式
await page.locator('.edge-cc').click()
await page.waitForTimeout(800)
await page.locator('.cc-header .cc-icon-btn').nth(1).click()
await page.waitForTimeout(400)

// 合成 HTML5 拖拽：flashlight → hotspot 位置
const result = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const grid = document.querySelector('.cc-grid')
  const src = document.querySelector('.cc-cell[data-id="flashlight"]')
  const dst = document.querySelector('.cc-cell[data-id="hotspot"]')
  const sr = src.getBoundingClientRect()
  const dr = dst.getBoundingClientRect()

  const dt = new DataTransfer()
  const mk = (type, x, y) => new DragEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt
  })

  src.dispatchEvent(mk('dragstart', sr.x + sr.width / 2, sr.y + sr.height / 2))
  await sleep(50)
  grid.dispatchEvent(mk('dragover', dr.x + dr.width / 2, dr.y + dr.height / 2))
  await sleep(250) // 等 120ms 防抖雷达
  grid.dispatchEvent(mk('dragover', dr.x + dr.width / 2, dr.y + dr.height / 2))
  await sleep(50)
  grid.dispatchEvent(mk('drop', dr.x + dr.width / 2, dr.y + dr.height / 2))
  await sleep(500)

  const pos = (id) => {
    const el = document.querySelector(`.cc-cell[data-id="${id}"]`)
    return el ? el.style.gridRow + ' / ' + el.style.gridColumn : 'GONE'
  }
  return {
    flashlight: pos('flashlight'),
    hotspot: pos('hotspot'),
    sound: pos('sound')
  }
})
console.log(JSON.stringify(result))
await page.screenshot({ path: OUT + '46-cc-drag-verify.png' })

await browser.close()
