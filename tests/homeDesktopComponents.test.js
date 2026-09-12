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
  assert.match(source, /previewOrder/)
  assert.match(source, /insertionIndexAtPoint/)
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

test('desktop grid renders adaptive pixel frames and preserves square widgets', async () => {
  const grid = await read('../src/components/system/AppGrid.vue')
  assert.match(grid, /position:absolute/)
  assert.match(grid, /translate3d\(\$\{p\.x\}px,\$\{p\.y\}px,0\)/)
  assert.match(grid, /profile\.iconSize \* profile\.compactScale/)
  assert.match(grid, /\.home-item\.is-widget \{[^}]*aspect-ratio:1\/1/)
  assert.doesNotMatch(grid, /\.home-item\.is-large \{ align-items:stretch; \}/)
})

test('desktop observes the unscaled viewport and derives dock and indicator geometry from its profile', async () => {
  const [home, dock] = await Promise.all([
    read('../src/components/system/HomeScreen.vue'),
    read('../src/components/system/DockBar.vue')
  ])
  assert.match(home, /new ResizeObserver/)
  assert.match(home, /root\.offsetWidth/)
  assert.match(home, /root\.offsetHeight/)
  assert.match(home, /home\.setViewport/)
  assert.match(home, /home\.profile\.indicatorY/)
  assert.match(dock, /profile\.dockRect\.height/)
  assert.match(dock, /profile\.height-profile\.dockRect\.bottom/)
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
  assert.match(home, /:show-pages="home\.editing \|\| showPageDots"/)
  assert.match(indicator, /v-if="showPages"/)
  assert.match(indicator, /indicator-swap/)
})

test('desktop edit mode matches the reference action and selection surfaces', async () => {
  const [home, grid, folder] = await Promise.all([
    read('../src/components/system/HomeScreen.vue'),
    read('../src/components/system/AppGrid.vue'),
    read('../src/components/home/HomeFolderOverlay.vue')
  ])
  assert.match(home, /class="edit-actions home-editor"/)
  assert.match(home, /class="edit-dashboard home-editor"/)
  assert.match(home, /class="layout-picker home-editor"/)
  assert.match(home, /<DockBar v-if="!home\.editing"/)
  assert.match(home, /removeSelectedFromDesktop/)
  assert.doesNotMatch(grid, /class="remove-badge"/)
  assert.match(grid, /\.selection-mark \{[^}]*right:-\d+px/)
  assert.match(grid, /backdrop-filter:blur\(12px\) saturate\(180%\)/)
  assert.match(folder, /background:transparent/)
  assert.doesNotMatch(folder, /class="folder-close"/)
})

test('short app presses remain native clicks and empty taps exit editing', async () => {
  const home = await read('../src/components/system/HomeScreen.vue')
  assert.match(home, /captureTarget:event\.currentTarget, captureEl:null/)
  assert.match(home, /pointer\.captureTarget\.setPointerCapture/)
  assert.match(home, /exitEditingOnTap:home\.editing/)
  assert.match(home, /home\.setEditing\(false\)/)
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
