import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('desktop uses pointer events, dwell paging and gesture cancellation cleanup', async () => {
  const source = await read('../src/components/system/HomeScreen.vue')
  assert.match(source, /pointercancel/)
  assert.match(source, /releasePointerCapture/)
  assert.match(source, /onWindowBlur/)
  assert.match(source, /setTimeout\(\(\) =>[\s\S]*400/)
  assert.match(source, /resolveDesktopPage/)
  assert.match(source, /previewPages/)
  assert.match(source, /clientPointToHome/)
  assert.match(source, /root\.offsetWidth \/ rect\.width/)
  assert.match(source, /\.drag-ghost\{position:absolute/)
})

test('motion polish includes FLIP, removal animation and reduced-motion support', async () => {
  const [grid, dock] = await Promise.all([
    read('../src/components/system/AppGrid.vue'),
    read('../src/components/system/DockBar.vue')
  ])
  assert.match(grid, /getBoundingClientRect/)
  assert.match(grid, /duration:220/)
  assert.match(grid, /is-removing/)
  assert.match(grid, /prefers-reduced-motion/)
  assert.match(dock, /is-removing/)
})

test('desktop grid preserves square widgets and the original icon spacing', async () => {
  const grid = await read('../src/components/system/AppGrid.vue')
  assert.match(grid, /grid-template-rows:69\.5px 69\.5px repeat\(4,79px\)/)
  assert.match(grid, /row-gap:20px/)
  assert.match(grid, /\.home-item\.is-widget \{[^}]*aspect-ratio:1\/1/)
  assert.doesNotMatch(grid, /\.home-item\.is-large \{ align-items:stretch; \}/)
})

test('folders expose all four sizes, renaming and app drag-out', async () => {
  const [home, overlay] = await Promise.all([
    read('../src/components/system/HomeScreen.vue'),
    read('../src/components/home/HomeFolderOverlay.vue')
  ])
  assert.match(home, /\[\[1,1\],\[2,1\],\[1,2\],\[2,2\]\]/)
  assert.match(home, /createSelectedFolder/)
  assert.match(home, /removeAppFromFolder/)
  assert.match(overlay, /文件夹名称/)
})

test('page dots replace search during paging and restore it after five seconds', async () => {
  const [home, indicator] = await Promise.all([
    read('../src/components/system/HomeScreen.vue'),
    read('../src/components/ui/PageIndicator.vue')
  ])
  assert.match(home, /restoreSearchAfterPaging/)
  assert.match(home, /}, 5000\)/)
  assert.match(home, /:show-pages="showPageDots"/)
  assert.match(indicator, /showPages && count > 1/)
  assert.match(indicator, /indicator-swap/)
})

test('dock editing, protected uninstall and library filtering are wired to home state', async () => {
  const [home, dock, library] = await Promise.all([
    read('../src/components/system/HomeScreen.vue'),
    read('../src/components/system/DockBar.vue'),
    read('../src/components/system/AppLibrary.vue')
  ])
  assert.match(home, /核心应用不可卸载/)
  assert.match(home, /moveToDock/)
  assert.match(home, /moveFromDock/)
  assert.match(home, /壁纸与个性化：开发中/)
  assert.match(dock, /repeat\(4,1fr\)/)
  assert.match(library, /home\.appInstalled/)
})
