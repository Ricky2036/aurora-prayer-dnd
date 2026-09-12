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

test('folders close from blank glass and render special app icons through AppIcon', async () => {
  const [overlay, folder] = await Promise.all([
    read('../src/components/home/HomeFolderOverlay.vue'),
    read('../src/components/home/HomeFolder.vue')
  ])
  assert.match(overlay, /onOverlayClick/)
  assert.match(overlay, /folder-panel-app,.folder-title/)
  assert.match(overlay, /@pointerdown\.stop/)
  assert.doesNotMatch(folder, /getApp\(appId\)\?\.image/)
  assert.match(folder, /<AppIcon :app="getApp\(appId\)"/)
})

test('desktop accepts dominant horizontal trackpad wheel gestures for paging', async () => {
  const source = await read('../src/components/system/HomeScreen.vue')
  assert.match(source, /function onWheel/)
  assert.match(source, /Math\.abs\(event\.deltaX\) <= Math\.abs\(event\.deltaY\)/)
  assert.match(source, /wheelDeltaX/)
  assert.match(source, /@wheel="onWheel"/)
})

test('item long press starts direct drag without entering desktop editing', async () => {
  const [home, grid, dock] = await Promise.all([
    read('../src/components/system/HomeScreen.vue'),
    read('../src/components/system/AppGrid.vue'),
    read('../src/components/system/DockBar.vue')
  ])
  assert.match(home, /setTimeout\(\(\) => \{[\s\S]*startItemDrag\(pointer\.startX,pointer\.startY\)/)
  assert.doesNotMatch(home, /home\.setEditing\(true\); pointer\.mode = 'item-ready'/)
  assert.match(home, /source\?\.cloneNode\(true\)/)
  assert.match(home, /grabX:point\.x-left,grabY:point\.y-top/)
  assert.match(home, /suppressClick\(pointer\.itemId\)/)
  assert.match(grid, /suppressClickId/)
  assert.match(dock, /suppressClickId/)
})

test('empty long press and touch or trackpad pinch enter desktop editing', async () => {
  const home = await read('../src/components/system/HomeScreen.vue')
  assert.match(home, /onRootPointerDownCapture/)
  assert.match(home, /pinch\.initial-distance >= 36/)
  assert.match(home, /distance <= pinch\.initial\*\.86/)
  assert.match(home, /event\.ctrlKey/)
  assert.match(home, /pinchWheelDelta >= 24/)
  assert.match(home, /system\.baseLayer !== 'home'/)
  assert.match(home, /setTimeout\(enterEditingFromEmptyPress,450\)/)
  assert.match(home, /function enterEditingFromEmptyPress\(\)[\s\S]*releasePointerCapture[\s\S]*home\.setEditing\(true\)/)
})

test('clock and calendar use one canonical vector canvas at every rendered size', async () => {
  const icon = await read('../src/components/ui/AppIcon.vue')
  assert.match(icon, /class="clock-face" width="100%" height="100%" viewBox="0 0 60 60"/)
  assert.match(icon, /class="calendar-face" width="100%" height="100%" viewBox="0 0 60 60"/)
  assert.match(icon, /class="calendar-weekday"/)
  assert.match(icon, /class="calendar-date"/)
  assert.match(icon, /v-for="i in 12"/)
  assert.doesNotMatch(icon, /compactSpecial|is-compact-special/)
})

test('folder overlay launches apps from controlled anchors and animates every icon from its source rect', async () => {
  const [home, overlay, icon, folder] = await Promise.all([
    read('../src/components/system/HomeScreen.vue'), read('../src/components/home/HomeFolderOverlay.vue'),
    read('../src/components/ui/AppIcon.vue'), read('../src/components/home/HomeFolder.vue')
  ])
  assert.match(icon, /launchOnClick/)
  assert.match(icon, /emit\('activate', anchorRef\.value\)/)
  assert.match(folder, /data-folder-shell/)
  assert.match(folder, /:data-folder-app="appId"/)
  assert.match(home, /function launchFolderApp/)
  assert.match(home, /setLaunchRect\(appId,launchRect\)/)
  assert.match(overlay, /phase\.value = 'opening'/)
  assert.match(overlay, /phase\.value = 'closing'/)
  assert.match(overlay, /rectTransform\(props\.origin\?\.iconRects\?\.\[appId\]/)
  assert.match(overlay, /@click\.stop="launch\(appId,\$event\.currentTarget\.querySelector/)
})

test('folder operation mode exposes a resize handle with transient four-size preview', async () => {
  const [home, grid, folder] = await Promise.all([
    read('../src/components/system/HomeScreen.vue'), read('../src/components/system/AppGrid.vue'), read('../src/components/home/HomeFolder.vue')
  ])
  assert.match(home, /folderOperation = ref/)
  assert.match(home, /folderResize = ref/)
  assert.match(home, /mode:'folder-resize'/)
  assert.match(home, /const hysteresis = 8/)
  assert.match(home, /home\.resizeFolder\(pointer\.folderId,folderResize\.value\.width,folderResize\.value\.height\)/)
  assert.match(grid, /folder-resize-pointerdown/)
  assert.match(folder, /class="folder-resize-handle"/)
  assert.match(folder, /width:36px;height:36px/)
})

test('folder merge candidate arms before committing and flies both icons into stable slots', async () => {
  const [home, grid, folder] = await Promise.all([
    read('../src/components/system/HomeScreen.vue'), read('../src/components/system/AppGrid.vue'), read('../src/components/home/HomeFolder.vue')
  ])
  assert.match(home, /folderMergeCandidate = ref/)
  assert.match(home, /folderMergeCandidate\.value = candidate \? \{ id:candidate,armed:false \}/)
  assert.match(home, /}, 420\)/)
  assert.match(home, /function cloneMergeAnchor/)
  assert.match(home, /function animateMergeAnchors/)
  assert.match(home, /duration:280/)
  assert.match(grid, /is-folder-candidate/)
  assert.match(grid, /folder-candidate-in 140ms/)
  assert.match(folder, /is-merging/)
})
