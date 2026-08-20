import { chromium } from 'file:///Users/jingzhan.chen/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs'

const BASE = process.env.PROTO_URL || 'http://127.0.0.1:5175/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 940 } })
page.on('console', (m) => console.log('[console]', m.text()))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(600)

// 监听 click 是否到达
await page.evaluate(() => {
  const stack = document.querySelector('.ln-stack')
  stack.addEventListener('click', () => console.log('ln-stack clicked'), true)
  document.querySelector('.lock-notifications').addEventListener('click', () => console.log('lock-notifications clicked'), true)
})

const before = await page.evaluate(() => !!document.querySelector('.ln-list'))
console.log('expanded before:', before)
await page.locator('.ln-stack').click()
await page.waitForTimeout(500)
const after = await page.evaluate(() => !!document.querySelector('.ln-list'))
console.log('expanded after:', after)

await browser.close()
