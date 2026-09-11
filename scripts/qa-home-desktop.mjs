import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const baseURL = process.argv[2] || 'http://127.0.0.1:8888/'
const output = new URL('../.tmp/home-desktop-qa/', import.meta.url)
await mkdir(output, { recursive: true })
const bundledChromium = '/Users/jingzhan.chen/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell'
const browser = await chromium.launch({ headless:true, ...(existsSync(bundledChromium) ? { executablePath:bundledChromium } : {}) })
const context = await browser.newContext({ viewport:{width:1280,height:1000}, recordVideo:{dir:output.pathname,size:{width:1280,height:1000}} })
const page = await context.newPage()
page.on('pageerror',(error)=>console.error('PAGE_ERROR',error.message))
page.on('console',(message)=>{ if (message.type() === 'error') console.error('PAGE_CONSOLE',message.text()) })

async function center(locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected element is not visible')
  return { x:box.x + box.width / 2, y:box.y + box.height / 2 }
}
async function drag(from,to,hold=0) {
  await page.mouse.move(from.x,from.y); await page.mouse.down()
  if (hold) await page.waitForTimeout(hold)
  await page.mouse.move(to.x,to.y,{steps:14}); await page.waitForTimeout(80); await page.mouse.up()
}

try {
  await page.goto(baseURL,{waitUntil:'networkidle'})
  const screenBox = await page.locator('.screen-view').boundingBox()
  await drag({x:screenBox.x+screenBox.width/2,y:screenBox.y+screenBox.height-18},{x:screenBox.x+screenBox.width/2,y:screenBox.y+180})
  const weather = page.locator('[data-home-item="app:weather"]')
  const dragTarget = page.locator('[data-home-item="app:games"]')
  await weather.waitFor({state:'visible'})
  const appTap = await center(weather)
  await page.mouse.click(appTap.x,appTap.y)
  await page.locator('.app-window[data-app-id="weather"]').waitFor({state:'visible'})
  await page.reload({waitUntil:'networkidle'})
  const unlockedScreen = await page.locator('.screen-view').boundingBox()
  await drag({x:unlockedScreen.x+unlockedScreen.width/2,y:unlockedScreen.y+unlockedScreen.height-18},{x:unlockedScreen.x+unlockedScreen.width/2,y:unlockedScreen.y+180})
  await weather.waitFor({state:'visible'})
  const press = await center(weather)
  await page.mouse.move(press.x,press.y); await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up()
  await page.locator('.edit-actions').waitFor({state:'visible'})
  if (await page.locator('.dock-bar').isVisible()) throw new Error('Dock remains visible in desktop edit mode')
  if (await page.locator('.remove-badge').count()) throw new Error('Per-icon remove badges remain in desktop edit mode')
  if (await weather.locator('.selection-mark').textContent()) await weather.evaluate((element) => element.click())
  await page.locator('.edit-dashboard').waitFor({state:'visible'})
  const emptyEditPoint = await page.locator('.home-screen').evaluate((root) => {
    const rect = root.getBoundingClientRect()
    for (let y = rect.top + 110; y < rect.bottom - 170; y += 12) {
      for (let x = rect.left + 8; x < rect.right - 8; x += 12) {
        const target = document.elementFromPoint(x,y)
        if (target && root.contains(target) && !target.closest('[data-home-item],.dock-bar,.home-editor')) return {x,y}
      }
    }
    throw new Error('No tappable desktop background was found')
  })
  await page.mouse.click(emptyEditPoint.x,emptyEditPoint.y)
  await page.locator('.edit-actions').waitFor({state:'hidden'})
  const reenter = await center(weather)
  await page.mouse.move(reenter.x,reenter.y); await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up()
  await page.locator('.edit-actions').waitFor({state:'visible'})
  if (await weather.locator('.selection-mark').textContent()) await weather.evaluate((element) => element.click())
  await page.locator('.edit-dashboard').waitFor({state:'visible'})
  await page.screenshot({path:new URL('edit-unselected.png',output).pathname})
  await weather.evaluate((element) => element.click()); await page.locator('.layout-picker').waitFor({state:'visible'})
  await page.screenshot({path:new URL('edit-selected.png',output).pathname})
  await weather.evaluate((element) => element.click()); await page.locator('.edit-dashboard').waitFor({state:'visible'})
  const items = page.locator('[data-page="0"] [data-home-item]')
  const before = await items.evaluateAll((nodes)=>nodes.map((node)=>node.dataset.homeItem))
  const reorderFrom = await center(weather), reorderTo = await center(dragTarget)
  await page.mouse.move(reorderFrom.x,reorderFrom.y); await page.mouse.down()
  await page.mouse.move(reorderTo.x,reorderTo.y,{steps:14}); await page.waitForTimeout(120)
  const activeGhosts = await page.locator('.drag-ghost').count()
  const ghostCenter = await center(page.locator('.drag-ghost'))
  if (Math.hypot(ghostCenter.x-reorderTo.x,ghostCenter.y-reorderTo.y) > 18) {
    throw new Error(`Drag ghost escaped pointer: pointer=${JSON.stringify(reorderTo)} ghost=${JSON.stringify(ghostCenter)}`)
  }
  await page.mouse.up()
  await page.waitForTimeout(260)
  const after = await items.evaluateAll((nodes)=>nodes.map((node)=>node.dataset.homeItem))
  if (!activeGhosts) throw new Error('Pointer drag did not create a floating mirror')
  if (before.join('|') === after.join('|')) throw new Error(`Pointer reorder did not change desktop order: ${before.join(',')}`)
  if (await page.locator('.drag-ghost').count()) throw new Error('Drag ghost remained after pointerup')
  const reverse = await center(page.locator('[data-home-item="app:files"]'))
  await page.mouse.move(reverse.x,reverse.y); await page.mouse.down()
  await page.mouse.move(reverse.x-45,reverse.y,{steps:6}); await page.mouse.move(reverse.x,reverse.y,{steps:6}); await page.mouse.up()
  if (await page.locator('.drag-ghost').count()) throw new Error('Reverse drag left a ghost')
  const folderSource = await center(page.locator('[data-home-item="app:files"]'))
  const folderTarget = await center(page.locator('[data-home-item="app:notes"]'))
  await page.mouse.move(folderSource.x,folderSource.y); await page.mouse.down()
  await page.mouse.move(folderTarget.x,folderTarget.y,{steps:12}); await page.waitForTimeout(460); await page.mouse.up()
  const compactFolder = page.locator('.home-folder:not(.large) .folder-apps').first()
  await compactFolder.waitFor({state:'visible'})
  const folderGrid = await compactFolder.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)
  if (folderGrid !== 3) throw new Error(`Compact folder has ${folderGrid} columns instead of 3`)
  const folderBox = await compactFolder.boundingBox()
  const firstFolderAppBox = await compactFolder.locator('.folder-app').first().boundingBox()
  if (!folderBox || !firstFolderAppBox || firstFolderAppBox.x-folderBox.x > 12 || firstFolderAppBox.y-folderBox.y > 12) {
    throw new Error('Compact folder apps do not start at the top-left corner')
  }
  const finalOrder = await items.evaluateAll((nodes)=>nodes.map((node)=>node.dataset.homeItem))
  await page.reload({waitUntil:'networkidle'})
  const restored = await items.evaluateAll((nodes)=>nodes.map((node)=>node.dataset.homeItem))
  if (restored.join('|') !== finalOrder.join('|')) throw new Error('Desktop order was not restored from localStorage')
  const restoredScreen = await page.locator('.screen-view').boundingBox()
  await drag({x:restoredScreen.x+restoredScreen.width/2,y:restoredScreen.y+restoredScreen.height-18},{x:restoredScreen.x+restoredScreen.width/2,y:restoredScreen.y+180})
  await page.waitForTimeout(700)
  const pageItem = page.locator('[data-page="0"] [data-home-item]').last()
  const pageItemCenter = await center(pageItem)
  await page.mouse.move(pageItemCenter.x,pageItemCenter.y); await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up()
  await page.locator('.edit-actions').waitFor({state:'visible'})
  const editingPageItemCenter = await center(pageItem)
  await page.mouse.move(editingPageItemCenter.x,editingPageItemCenter.y); await page.mouse.down()
  await page.mouse.move(restoredScreen.x+restoredScreen.width-8,editingPageItemCenter.y,{steps:14}); await page.waitForTimeout(460); await page.mouse.up()
  await page.locator('.page-dots').waitFor({state:'visible'})
  await page.reload({waitUntil:'networkidle'})
  const pagingScreen = await page.locator('.screen-view').boundingBox()
  await drag({x:pagingScreen.x+pagingScreen.width/2,y:pagingScreen.y+pagingScreen.height-18},{x:pagingScreen.x+pagingScreen.width/2,y:pagingScreen.y+180})
  await page.waitForTimeout(700)
  await drag({x:pagingScreen.x+pagingScreen.width/2,y:pagingScreen.y+pagingScreen.height/2},{x:pagingScreen.x+pagingScreen.width-30,y:pagingScreen.y+pagingScreen.height/2})
  await page.locator('.page-dots').waitFor({state:'visible'})
  await page.waitForTimeout(4600)
  if (!await page.locator('.page-dots').isVisible()) throw new Error('Page dots returned to search before five seconds')
  await page.locator('.search-pill').waitFor({state:'visible',timeout:1000})
  await page.screenshot({path:new URL('desktop-final.png',output).pathname})
  console.log(JSON.stringify({ok:true,beforeCount:before.length,afterCount:after.length,restored:true}))
} finally {
  await context.close(); await browser.close()
}
