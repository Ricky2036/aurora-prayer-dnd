<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getApp } from '../../config/apps'
import { useHomeStore } from '../../stores/homeStore'
import { useSystemStore } from '../../stores/systemStore'
import { moveHomeItem, reflowHomePages, resolveDesktopPage } from '../../utils/homeLayout.js'
import AppGrid from './AppGrid.vue'
import DockBar from './DockBar.vue'
import PageIndicator from '../ui/PageIndicator.vue'
import HomeFolderOverlay from '../home/HomeFolderOverlay.vue'
import ActionModal from '../ui/ActionModal.vue'

const emit = defineEmits(['open-library'])
const system = useSystemStore()
const home = useHomeStore()
const rootRef = ref(null)
const previewPages = ref(null)
const pageDragX = ref(0)
const showPageDots = ref(false)
const dragging = ref(null)
const ghost = ref(null)
const openFolderId = ref(null)
const folderOrigin = ref(null)
const folderTargetId = ref(null)
const dockTargetIndex = ref(null)
const pendingRemoval = ref([])
const toast = ref('')
const removingIds = ref([])
const displayPages = computed(() => previewPages.value || home.pages)
const displayPositions = computed(() => previewPages.value
  ? reflowHomePages(previewPages.value, home.items, home.folders).positions
  : home.positions)
const stripStyle = computed(() => ({
  transform: `translate3d(calc(${-home.currentPage * 100}% + ${pageDragX.value}px),0,0)`,
  transition: pageDragX.value || dragging.value ? 'none' : 'transform 420ms cubic-bezier(.22,.8,.26,1)'
}))
const homeStyle = computed(() => system.unlockProgress <= 0 ? {} : ({
  transform: `scale(${1.12 - system.unlockProgress * .12})`, opacity: .3 + system.unlockProgress * .7
}))
const ghostApp = computed(() => {
  const item = ghost.value && home.items[ghost.value.id]
  return item?.type === 'app' ? getApp(item.appId) : null
})

const justUnlocked = ref(false)
let unlockTimer = null
let pageIndicatorTimer = null
watch(() => system.baseLayer, (layer, previous) => {
  if (layer === 'home' && previous === 'lock') {
    justUnlocked.value = true
    clearTimeout(unlockTimer)
    unlockTimer = setTimeout(() => { justUnlocked.value = false }, 1100)
  }
})

let pressTimer = null
let edgeTimer = null
let folderTimer = null
let pointer = null
function clearTimers() { clearTimeout(pressTimer); clearTimeout(edgeTimer); clearTimeout(folderTimer); pressTimer = null; edgeTimer = null; folderTimer = null }
function revealPageDots() {
  clearTimeout(pageIndicatorTimer)
  pageIndicatorTimer = null
  showPageDots.value = true
}
function restoreSearchAfterPaging() {
  revealPageDots()
  pageIndicatorTimer = setTimeout(() => {
    showPageDots.value = false
    pageIndicatorTimer = null
  }, 5000)
}
function bindWindow() {
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('blur', onWindowBlur)
}
function unbindWindow() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('blur', onWindowBlur)
}
function capture(event) {
  try { event.currentTarget?.setPointerCapture?.(event.pointerId); return event.currentTarget } catch { return null }
}
function clientPointToHome(x, y) {
  const root = rootRef.value
  const rect = root?.getBoundingClientRect()
  if (!root || !rect?.width || !rect?.height) return { x, y }
  return {
    x: (x - rect.left) * (root.offsetWidth / rect.width),
    y: (y - rect.top) * (root.offsetHeight / rect.height)
  }
}
function setGhostPosition(id, clientX, clientY) {
  ghost.value = { id, ...clientPointToHome(clientX, clientY) }
}
function onEmptyPointerDown(event) {
  if (event.button != null && event.button !== 0) return
  if (event.target.closest('[data-home-item],.dock-bar,.home-editor')) return
  pointer = { id:event.pointerId, mode:'page', startX:event.clientX, startY:event.clientY, startedAt:performance.now(), startPage:home.currentPage, captureEl:capture(event) }
  pressTimer = setTimeout(() => { if (pointer?.mode === 'page') { home.setEditing(true); pointer = null; unbindWindow() } }, 450)
  bindWindow()
}
function onItemPointerDown(event, id, page, index) {
  if (event.button != null && event.button !== 0) return
  event.stopPropagation()
  pointer = { id:event.pointerId, mode:home.editing ? 'item-ready' : 'item-press', itemId:id, page, index,
    startX:event.clientX, startY:event.clientY, lastX:event.clientX, lastY:event.clientY, startedAt:performance.now(), startPage:home.currentPage, edgeDirection:0, captureEl:capture(event) }
  if (!home.editing) pressTimer = setTimeout(() => {
    if (!pointer || pointer.itemId !== id) return
    home.setEditing(true); pointer.mode = 'item-ready'
  }, 450)
  else startItemDrag(event.clientX,event.clientY)
  bindWindow()
}
function onDockPointerDown(event, id, index) {
  if (event.button != null && event.button !== 0) return
  event.stopPropagation()
  pointer = { id:event.pointerId, mode:home.editing ? 'item-ready' : 'item-press', itemId:id, page:home.currentPage, index,
    sourceDock:true, startX:event.clientX, startY:event.clientY, lastX:event.clientX, lastY:event.clientY,
    startedAt:performance.now(), startPage:home.currentPage, edgeDirection:0, captureEl:capture(event) }
  if (!home.editing) pressTimer = setTimeout(() => {
    if (!pointer || pointer.itemId !== id) return
    home.setEditing(true); pointer.mode = 'item-ready'
  },450)
  else startItemDrag(event.clientX,event.clientY)
  bindWindow()
}
function startItemDrag(x, y) {
  if (!pointer?.itemId) return
  pointer.mode = 'item-drag'
  previewPages.value = home.pages.map((page) => [...page])
  dragging.value = { id:pointer.itemId, page:pointer.page, index:pointer.index }
  pointer.didMove = false
  setGhostPosition(pointer.itemId, x, y)
}
function trackFolderTarget(x, y) {
  const element = document.elementFromPoint(x, y)?.closest?.('[data-home-item]')
  const id = element?.dataset.homeItem
  const dragged = home.items[dragging.value?.id]
  const target = home.items[id]
  const candidate = dragged?.type === 'app' && id !== dragging.value.id && (target?.type === 'app' || target?.type === 'folder') ? id : null
  if (candidate === pointer.folderCandidate) return
  clearTimeout(folderTimer)
  pointer.folderCandidate = candidate
  folderTargetId.value = null
  if (candidate) folderTimer = setTimeout(() => {
    if (pointer?.folderCandidate === candidate) folderTargetId.value = candidate
  }, 420)
}
function trackDockTarget(x, y) {
  const dock = rootRef.value.querySelector('.dock-bar')
  const rect = dock?.getBoundingClientRect()
  if (!rect || y < rect.top || y > rect.bottom || x < rect.left || x > rect.right) {
    dockTargetIndex.value = null
    return
  }
  dockTargetIndex.value = Math.max(0,Math.min(3,Math.floor((x - rect.left) / (rect.width / 4))))
  folderTargetId.value = null
}
function targetIndexAt(x, y) {
  const grid = rootRef.value.querySelector(`[data-page="${home.currentPage}"]`)
  const rect = grid?.getBoundingClientRect()
  if (!grid || !rect?.width || !rect?.height) return previewPages.value[home.currentPage].length
  const style = getComputedStyle(grid)
  const scaleX = rect.width / grid.offsetWidth
  const scaleY = rect.height / grid.offsetHeight
  const paddingLeft = parseFloat(style.paddingLeft) || 0
  const paddingTop = parseFloat(style.paddingTop) || 0
  const columnGap = parseFloat(style.columnGap) || 0
  const rowGap = parseFloat(style.rowGap) || 0
  const innerWidth = grid.offsetWidth - paddingLeft - (parseFloat(style.paddingRight) || 0)
  const columnWidth = (innerWidth - columnGap * 3) / 4
  const localX = (x - rect.left) / scaleX - paddingLeft
  const localY = (y - rect.top) / scaleY
  const col = Math.max(0, Math.min(3, Math.floor((localX + columnGap / 2) / (columnWidth + columnGap))))
  const rowHeights = style.gridTemplateRows.split(' ').map(parseFloat).filter(Number.isFinite)
  const rowCenters = []
  let rowTop = paddingTop
  for (const height of rowHeights) {
    rowCenters.push(rowTop + height / 2)
    rowTop += height + rowGap
  }
  let row = 0
  for (let index = 1; index < rowCenters.length; index += 1) {
    if (Math.abs(localY - rowCenters[index]) < Math.abs(localY - rowCenters[row])) row = index
  }
  return Math.max(0, Math.min(row * 4 + col, previewPages.value[home.currentPage].length))
}
function updatePreview(x, y) {
  if (!dragging.value || !previewPages.value) return
  trackDockTarget(x, y)
  if (dockTargetIndex.value != null) return
  trackFolderTarget(x, y)
  // 命中文件夹候选时保持原网格不动，让 420ms 停留计时不会因实时让位而丢失目标。
  if (pointer.folderCandidate) return
  const index = targetIndexAt(x, y)
  const next = moveHomeItem(previewPages.value, dragging.value.id, home.currentPage, index)
  previewPages.value = reflowHomePages(next, home.items, home.folders).pages
  dragging.value.page = home.currentPage; dragging.value.index = index
  const rect = rootRef.value.getBoundingClientRect()
  const direction = x < rect.left + 34 ? -1 : x > rect.right - 34 ? 1 : 0
  if (direction === pointer.edgeDirection) return
  clearTimeout(edgeTimer); pointer.edgeDirection = direction
  if (!direction) return
  edgeTimer = setTimeout(() => {
    if (!dragging.value) return
    const requested = home.currentPage + direction
    if (requested < 0) return
    if (requested >= previewPages.value.length) previewPages.value.push([])
    revealPageDots()
    home.currentPage = Math.min(requested, previewPages.value.length - 1)
    dragging.value.page = home.currentPage
    dragging.value.index = previewPages.value[home.currentPage].length
    updatePreview(x, y)
  }, 400)
}
function onPointerMove(event) {
  if (!pointer || event.pointerId !== pointer.id) return
  pointer.lastX = event.clientX; pointer.lastY = event.clientY
  const dx = event.clientX - pointer.startX, dy = event.clientY - pointer.startY
  if (pointer.mode === 'item-press' && Math.hypot(dx,dy) > 9) { clearTimeout(pressTimer); cleanup(false); return }
  if (pointer.mode === 'item-ready' && Math.hypot(dx,dy) > 5) startItemDrag(event.clientX,event.clientY)
  if (pointer.mode === 'folder-app-ready' && Math.hypot(dx,dy) > 5) {
    pointer.mode = 'folder-app-drag'
    setGhostPosition(`app:${pointer.appId}`, event.clientX, event.clientY)
    openFolderId.value = null
  }
  if (pointer.mode === 'folder-app-drag') {
    event.preventDefault()
    setGhostPosition(ghost.value.id, event.clientX, event.clientY)
    return
  }
  if (pointer.mode === 'item-drag') {
    if (Math.hypot(dx,dy) <= 5) return
    pointer.didMove = true
    event.preventDefault(); setGhostPosition(ghost.value.id, event.clientX, event.clientY); updatePreview(event.clientX,event.clientY); return
  }
  if (pointer.mode === 'page') {
    if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return
    clearTimeout(pressTimer)
    if (Math.abs(dy) > Math.abs(dx) * 1.2) { cleanup(false); return }
    revealPageDots()
    event.preventDefault()
    pageDragX.value = ((home.currentPage === 0 && dx > 0) || (home.currentPage === home.pageCount - 1 && dx < 0)) ? dx * .36 : dx
  }
}
function finishItem(cancelled) {
  if (!pointer.didMove) {
    previewPages.value = null; dragging.value = null; ghost.value = null; folderTargetId.value = null; dockTargetIndex.value = null
    return
  }
  if (!cancelled && dragging.value && dockTargetIndex.value != null) {
    home.moveToDock(dragging.value.id,dockTargetIndex.value)
  } else if (!cancelled && dragging.value && folderTargetId.value) {
    const target = home.items[folderTargetId.value]
    if (target?.type === 'folder') home.addAppToFolder(dragging.value.id, folderTargetId.value)
    else if (target?.type === 'app') {
      const location = home.itemLocation(folderTargetId.value) || { page:dragging.value.page, index:dragging.value.index }
      home.createFolder([folderTargetId.value, dragging.value.id], location.page, location.index)
    }
  } else if (!cancelled && dragging.value && pointer.sourceDock) {
    home.moveFromDock(dragging.value.id,dragging.value.page,dragging.value.index)
  } else if (!cancelled && dragging.value) home.moveItem(dragging.value.id, dragging.value.page, dragging.value.index)
  previewPages.value = null; dragging.value = null; ghost.value = null
  folderTargetId.value = null
  dockTargetIndex.value = null
  if (cancelled) home.currentPage = Math.min(pointer.startPage,home.pages.length - 1)
  if (showPageDots.value) restoreSearchAfterPaging()
}
function finishPage(cancelled) {
  const elapsed = Math.max(1, performance.now() - pointer.startedAt)
  const outcome = cancelled ? { page:home.currentPage, openLibrary:false } : resolveDesktopPage({
    currentPage:home.currentPage, pageCount:home.pageCount, delta:pageDragX.value, velocity:pageDragX.value / elapsed,
    threshold:rootRef.value.getBoundingClientRect().width * .18
  })
  home.setPage(outcome.page)
  if (outcome.openLibrary) emit('open-library')
  pageDragX.value = 0
  if (showPageDots.value) restoreSearchAfterPaging()
}
function cleanup(cancelled) {
  if (!pointer) return
  clearTimers()
  if (pointer.mode === 'item-drag') finishItem(cancelled)
  if (pointer.mode === 'folder-app-drag') {
    if (!cancelled) home.removeAppFromFolder(pointer.appId, pointer.folderId, home.currentPage, home.currentItems.length)
    else openFolderId.value = pointer.folderId
    ghost.value = null
  }
  if (pointer.mode === 'page') finishPage(cancelled)
  try { pointer.captureEl?.releasePointerCapture?.(pointer.id) } catch {}
  pointer = null; unbindWindow()
}
function onPointerUp(event) { if (pointer && event.pointerId === pointer.id) cleanup(false) }
function onPointerCancel(event) { if (pointer && event.pointerId === pointer.id) cleanup(true) }
function onWindowBlur() { if (pointer) cleanup(true) }
function showFolder(folderId, element) {
  openFolderId.value = folderId
  folderOrigin.value = element?.getBoundingClientRect?.() || null
}
function onFolderAppPointerDown(event, appId) {
  if (event.button != null && event.button !== 0) return
  event.stopPropagation()
  pointer = { id:event.pointerId, mode:'folder-app-ready', appId, folderId:openFolderId.value,
    startX:event.clientX, startY:event.clientY, lastX:event.clientX, lastY:event.clientY, startedAt:performance.now(), captureEl:capture(event) }
  bindWindow()
}
function createSelectedFolder() {
  const apps = home.selectedItemIds.filter((id) => home.items[id]?.type === 'app')
  if (apps.length >= 2) home.createFolder(apps, home.currentPage, 0)
}
function showToast(message) {
  toast.value = message
  setTimeout(() => { if (toast.value === message) toast.value = '' },1800)
}
function requestRemove(itemId) {
  const item = home.items[itemId]
  if (!item) return
  if (item.type === 'widget' || item.type === 'folder') { animateRemoval([itemId]); return }
  if (!home.canUninstall(item.appId)) { showToast('核心应用不可卸载'); return }
  pendingRemoval.value = [itemId]
}
function requestSelectedRemoval() {
  const ids = home.selectedItemIds.filter((id) => home.items[id]?.type === 'app')
  if (!ids.length) return
  if (ids.some((id) => home.items[id]?.type === 'app' && !home.canUninstall(home.items[id].appId))) {
    showToast('核心应用不可卸载'); return
  }
  pendingRemoval.value = ids
}
function removeSelectedFromDesktop() {
  const ids = [...home.selectedItemIds]
  if (!ids.length) return
  removingIds.value = ids
  setTimeout(() => {
    for (const id of ids) {
      const item = home.items[id]
      if (item?.type === 'app') home.removeFromDesktop(id)
      else if (item?.type === 'widget') home.removeWidget(item.widgetId)
      else if (item?.type === 'folder') home.removeFolder(item.folderId)
    }
    removingIds.value = []
  },180)
}
function confirmRemoval() {
  const ids = [...pendingRemoval.value]
  pendingRemoval.value = []
  animateRemoval(ids)
}
function animateRemoval(ids) {
  removingIds.value = ids
  setTimeout(() => {
    for (const id of ids) {
      const item = home.items[id]
      if (item?.type === 'app') home.uninstallApp(item.appId)
      else if (item?.type === 'widget') home.removeWidget(item.widgetId)
      else if (item?.type === 'folder') home.removeFolder(item.folderId)
    }
    removingIds.value = []
  },180)
}
const selectedFolder = computed(() => {
  if (home.selectedItemIds.length !== 1) return null
  const item = home.items[home.selectedItemIds[0]]
  return item?.type === 'folder' ? home.folders[item.folderId] : null
})
const hasSelection = computed(() => home.selectedItemIds.length > 0)
const canGroupSelection = computed(() => home.selectedItemIds.filter((id) => home.items[id]?.type === 'app').length >= 2)
const canUninstallSelection = computed(() => hasSelection.value && home.selectedItemIds.every((id) => {
  const item = home.items[id]
  return item?.type === 'app' && home.canUninstall(item.appId)
}))
const layoutPresets = ['free','dense','balanced','focus','blank']
const folderSizes = [[1,1],[2,1],[1,2],[2,2]]
function chooseLayoutPreset(index) {
  if (selectedFolder.value && folderSizes[index]) {
    home.resizeFolder(selectedFolder.value.id,...folderSizes[index])
    return
  }
  showToast('布局：开发中')
}
function layoutPresetActive(index) {
  if (!selectedFolder.value) return index === 0
  const size = folderSizes[index]
  return Boolean(size && selectedFolder.value.width === size[0] && selectedFolder.value.height === size[1])
}
onBeforeUnmount(() => { clearTimeout(unlockTimer); clearTimeout(pageIndicatorTimer); clearTimers(); unbindWindow() })
</script>

<template>
  <div ref="rootRef" class="home-screen" :class="{ 'just-unlocked':justUnlocked, 'is-editing':home.editing }" :style="homeStyle" @pointerdown="onEmptyPointerDown" @dragstart.prevent>
    <div class="home-page-strip" :style="stripStyle">
      <section v-for="(page,pageIndex) in displayPages" :key="pageIndex" class="home-page">
        <AppGrid :page-index="pageIndex" :item-ids="page" :items="home.items" :positions="displayPositions[pageIndex]"
          :folders="home.folders" :editing="home.editing" :selected-ids="home.selectedItemIds" :dragging-id="dragging?.id" :folder-target-id="folderTargetId" :removing-ids="removingIds"
          @item-pointerdown="onItemPointerDown" @toggle-select="home.toggleSelected" @open-folder="showFolder" @request-remove="requestRemove" />
      </section>
    </div>
    <div v-if="home.editing" class="edit-actions home-editor">
      <button type="button" :disabled="!canGroupSelection" @click="createSelectedFolder">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3.5 9.5h10l2.2 2.5h12.8v14.5a2 2 0 0 1-2 2h-23a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z"/><path d="M16 15v9M11.5 19.5h9"/></svg>
        <span>成组</span>
      </button>
      <button type="button" :disabled="!hasSelection" @click="removeSelectedFromDesktop">
        <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12"/><path d="M10 16h12"/></svg>
        <span>移除</span>
      </button>
      <button type="button" :disabled="!canUninstallSelection" @click="requestSelectedRemoval">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 10h14l-1.1 17H10.1L9 10Z"/><path d="M12 10V6.5h8V10M6.5 10h19M13.5 14v9M18.5 14v9"/></svg>
        <span>卸载</span>
      </button>
    </div>
    <div class="indicator-wrap"><PageIndicator :count="displayPages.length" :current="home.currentPage" :show-pages="home.editing || showPageDots" @search="emit('open-library')" /></div>
    <DockBar v-if="!home.editing" :dragging-id="dragging?.id" :dock-target-index="dockTargetIndex" :removing-ids="removingIds" @item-pointerdown="onDockPointerDown"
      @toggle-select="home.toggleSelected" @request-remove="requestRemove" />
    <HomeFolderOverlay v-if="openFolderId && home.folders[openFolderId]" :folder="home.folders[openFolderId]" :origin="folderOrigin"
      @close="openFolderId=null" @rename="home.renameFolder(openFolderId,$event)" @app-pointerdown="onFolderAppPointerDown" />
    <Transition name="editor-panel" mode="out-in">
      <div v-if="home.editing && !hasSelection" key="tools" class="edit-dashboard home-editor">
        <button class="depth-card" type="button" @click="showToast('景深桌面：开发中')">
          <span class="depth-preview"><i></i><i></i><i></i></span>
          <span class="depth-label"><svg viewBox="0 0 24 24"><path d="m4 15 8 4 8-4-8-4-8 4Zm3-5 5 2.5L17 10l-5-2.5L7 10Z"/></svg>景深桌面</span>
        </button>
        <div class="edit-tool-grid">
          <button type="button" @click="showToast('壁纸与个性化：开发中')"><svg viewBox="0 0 24 24"><path d="M5 4h14v12H5zM8 20h8M12 16v4"/></svg><span>壁纸</span></button>
          <button type="button" @click="showToast('小组件：开发中')"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="4" rx="1"/><rect x="13" y="10" width="7" height="10" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/></svg><span>小部件</span></button>
          <button type="button" @click="showToast('图标：开发中')"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="3"/><rect x="13" y="4" width="7" height="7" rx="3"/><rect x="4" y="13" width="7" height="7" rx="3"/><rect x="13" y="13" width="7" height="7" rx="3"/></svg><span>图标</span></button>
          <button type="button" @click="showToast('桌面设置：开发中')"><svg viewBox="0 0 24 24"><path d="M9.6 3.8 10.4 2h3.2l.8 1.8 2 .8 1.8-.7 2.2 2.2-.7 1.8.8 2 1.8.8v3.2l-1.8.8-.8 2 .7 1.8-2.2 2.2-1.8-.7-2 .8-.8 1.8h-3.2l-.8-1.8-2-.8-1.8.7-2.2-2.2.7-1.8-.8-2L2 13.9v-3.2l1.8-.8.8-2-.7-1.8 2.2-2.2 1.8.7 2-.8Z"/><circle cx="12" cy="12" r="3"/></svg><span>设置</span></button>
        </div>
      </div>
      <div v-else-if="home.editing" key="layouts" class="layout-picker home-editor">
        <button v-for="(preset,index) in layoutPresets" :key="preset" type="button" :class="['layout-option',`preset-${preset}`,{active:layoutPresetActive(index)}]" @click="chooseLayoutPreset(index)">
          <span v-for="cell in 20" :key="cell"></span>
        </button>
      </div>
    </Transition>
    <div v-if="toast" class="home-toast">{{ toast }}</div>
    <ActionModal :visible="pendingRemoval.length > 0" title="卸载应用？" desc="应用将从桌面、文件夹、Dock 和应用资源库中移除。"
      cancel-text="取消" confirm-text="卸载" @cancel="pendingRemoval=[]" @backdrop="pendingRemoval=[]" @confirm="confirmRemoval" />
    <div v-if="ghost" class="drag-ghost" :style="{ transform:`translate3d(${ghost.x}px,${ghost.y}px,0)` }">
      <img v-if="ghostApp?.image" :src="ghostApp.image" alt=""><span v-else>{{ ghostApp?.name || '组件' }}</span>
    </div>
  </div>
</template>

<style scoped>
.home-screen{position:absolute;inset:0;z-index:var(--z-home);overflow:hidden;touch-action:none}
.home-page-strip{position:absolute;inset:0;display:flex;will-change:transform}
.home-page{flex:0 0 100%;width:100%;height:100%}
.indicator-wrap{position:absolute;bottom:136px;left:0;right:0;display:flex;justify-content:center;transition:bottom 320ms cubic-bezier(.22,.8,.26,1)}
.is-editing .indicator-wrap{bottom:194px}
.drag-ghost{position:absolute;left:-34px;top:-44px;z-index:999;width:68px;min-height:76px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:var(--text-caption);pointer-events:none;filter:drop-shadow(0 12px 18px rgba(0,0,0,.35));will-change:transform}
.drag-ghost img{width:60px;height:60px;border-radius:17px;object-fit:cover;transform:scale(1.08)}
.edit-actions{position:absolute;left:38px;right:38px;top:calc(var(--safe-top,54px) + 8px);z-index:22;display:flex;align-items:flex-start;justify-content:space-between}
.edit-actions button{width:62px;display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff;font:600 13px/1.2 var(--font-stack);text-shadow:0 1px 4px rgba(0,0,0,.3);transition:opacity 160ms ease,transform 160ms ease}
.edit-actions button:active:not(:disabled){transform:scale(.92)}
.edit-actions button:disabled{opacity:.28}
.edit-actions svg{width:27px;height:27px;fill:rgba(255,255,255,.96);stroke:rgba(255,255,255,.96);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
.edit-actions button:first-child svg{fill:rgba(255,255,255,.9);stroke:#536079;stroke-width:1.7}
.edit-dashboard{position:absolute;left:26px;right:26px;bottom:26px;height:154px;z-index:22;display:grid;grid-template-columns:1.35fr 1fr;gap:9px}
.depth-card,.edit-tool-grid button,.layout-option{border:.5px solid rgba(255,255,255,.18);background:linear-gradient(145deg,rgba(91,98,116,.94),rgba(48,54,70,.94));box-shadow:inset 0 1px 1px rgba(255,255,255,.2),0 8px 20px rgba(5,10,28,.2);backdrop-filter:blur(24px) saturate(120%);color:#fff}
.depth-card{border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px}
.depth-preview{position:relative;width:104px;height:78px;display:block}
.depth-preview::before,.depth-preview::after,.depth-preview i{content:"";position:absolute;border-radius:9px;background:linear-gradient(145deg,rgba(213,232,255,.95),rgba(105,139,205,.9));box-shadow:0 4px 8px rgba(8,18,45,.22)}
.depth-preview::before{width:42px;height:70px;left:15px;top:4px}.depth-preview::after{width:48px;height:72px;right:8px;top:1px;background:linear-gradient(145deg,#efe2d4,#8bb578)}
.depth-preview i:nth-child(1){width:42px;height:30px;left:15px;bottom:4px;background:linear-gradient(145deg,#80b3ef,#475c8e);z-index:2}
.depth-preview i:nth-child(2){width:21px;height:21px;right:20px;bottom:5px;border-radius:50%;background:#d66b42;z-index:3}
.depth-preview i:nth-child(3){width:12px;height:12px;left:31px;top:12px;border-radius:50%;background:#1c2230;z-index:3}
.depth-label{display:flex;align-items:center;gap:6px;font:600 14px/1 var(--font-stack)}
.depth-label svg{width:22px;height:22px;fill:#fff}
.edit-tool-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
.edit-tool-grid button{border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font:500 13px/1 var(--font-stack)}
.edit-tool-grid svg{width:27px;height:27px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.layout-picker{position:absolute;left:25px;right:25px;bottom:34px;height:116px;z-index:22;display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.layout-option{position:relative;border-radius:15px;padding:12px 8px;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(5,1fr);gap:4px;opacity:.84}
.layout-option span{border-radius:3px;background:rgba(224,228,237,.82)}
.layout-option.active{opacity:1;border-color:rgba(255,255,255,.48)}
.layout-option.active span:nth-child(8){background:#1689ff}
.layout-option.active span:nth-child(17){grid-column:span 2;background:#f5f8fb}
.layout-option.preset-focus span:nth-child(1){grid-column:span 2;grid-row:span 2}
.layout-option.preset-blank span{opacity:0}
.editor-panel-enter-active,.editor-panel-leave-active{transition:opacity 180ms ease,transform 220ms cubic-bezier(.22,.8,.26,1)}
.editor-panel-enter-from,.editor-panel-leave-to{opacity:0;transform:translateY(16px) scale(.96)}
.home-toast{position:absolute;left:50%;bottom:198px;z-index:80;transform:translateX(-50%);padding:9px 15px;border-radius:17px;background:rgba(20,20,24,.82);color:#fff;white-space:nowrap;font:600 13px/1 var(--font-stack);animation:toast-in 180ms ease}
@keyframes toast-in{from{opacity:0;transform:translate(-50%,8px)}}
@media (prefers-reduced-motion:reduce){.home-page-strip,.indicator-wrap,.editor-panel-enter-active,.editor-panel-leave-active{transition-duration:1ms!important}}
</style>
