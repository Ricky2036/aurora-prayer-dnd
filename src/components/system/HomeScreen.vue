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
const dragging = ref(null)
const ghost = ref(null)
const openFolderId = ref(null)
const folderOrigin = ref(null)
const folderTargetId = ref(null)
const dockTargetIndex = ref(null)
const pendingRemoval = ref([])
const toast = ref('')
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
function bindWindow() {
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}
function unbindWindow() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}
function onEmptyPointerDown(event) {
  if (event.button != null && event.button !== 0) return
  if (event.target.closest('[data-home-item],.dock-bar,.home-editor,.done-button')) return
  pointer = { id:event.pointerId, mode:'page', startX:event.clientX, startY:event.clientY, startedAt:performance.now() }
  pressTimer = setTimeout(() => { if (pointer?.mode === 'page') { home.setEditing(true); pointer = null; unbindWindow() } }, 450)
  bindWindow()
}
function onItemPointerDown(event, id, page, index) {
  if (event.button != null && event.button !== 0) return
  event.stopPropagation()
  pointer = { id:event.pointerId, mode:home.editing ? 'item-ready' : 'item-press', itemId:id, page, index,
    startX:event.clientX, startY:event.clientY, lastX:event.clientX, lastY:event.clientY, startedAt:performance.now(), edgeDirection:0 }
  if (!home.editing) pressTimer = setTimeout(() => {
    if (!pointer || pointer.itemId !== id) return
    home.setEditing(true); startItemDrag(pointer.lastX, pointer.lastY)
  }, 450)
  bindWindow()
}
function onDockPointerDown(event, id, index) {
  if (event.button != null && event.button !== 0) return
  event.stopPropagation()
  pointer = { id:event.pointerId, mode:home.editing ? 'item-ready' : 'item-press', itemId:id, page:home.currentPage, index,
    sourceDock:true, startX:event.clientX, startY:event.clientY, lastX:event.clientX, lastY:event.clientY,
    startedAt:performance.now(), edgeDirection:0 }
  if (!home.editing) pressTimer = setTimeout(() => {
    if (!pointer || pointer.itemId !== id) return
    home.setEditing(true); startItemDrag(pointer.lastX,pointer.lastY)
  },450)
  bindWindow()
}
function startItemDrag(x, y) {
  if (!pointer?.itemId) return
  pointer.mode = 'item-drag'
  previewPages.value = home.pages.map((page) => [...page])
  dragging.value = { id:pointer.itemId, page:pointer.page, index:pointer.index }
  ghost.value = { id:pointer.itemId, x, y }
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
  const rect = rootRef.value.getBoundingClientRect()
  const col = Math.max(0, Math.min(3, Math.floor((x - rect.left) / (rect.width / 4))))
  const row = Math.max(0, Math.min(5, Math.floor((y - rect.top - 66) / 84)))
  return Math.max(0, Math.min(row * 4 + col, previewPages.value[home.currentPage].length))
}
function updatePreview(x, y) {
  if (!dragging.value || !previewPages.value) return
  trackFolderTarget(x, y)
  trackDockTarget(x, y)
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
    ghost.value = { id:`app:${pointer.appId}`, x:event.clientX, y:event.clientY }
    openFolderId.value = null
  }
  if (pointer.mode === 'folder-app-drag') {
    event.preventDefault()
    ghost.value = { ...ghost.value, x:event.clientX, y:event.clientY }
    return
  }
  if (pointer.mode === 'item-drag') {
    event.preventDefault(); ghost.value = { ...ghost.value, x:event.clientX, y:event.clientY }; updatePreview(event.clientX,event.clientY); return
  }
  if (pointer.mode === 'page') {
    if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return
    clearTimeout(pressTimer)
    if (Math.abs(dy) > Math.abs(dx) * 1.2) { cleanup(false); return }
    event.preventDefault()
    pageDragX.value = ((home.currentPage === 0 && dx > 0) || (home.currentPage === home.pageCount - 1 && dx < 0)) ? dx * .36 : dx
  }
}
function finishItem(cancelled) {
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
}
function finishPage(cancelled) {
  const elapsed = Math.max(1, performance.now() - pointer.startedAt)
  const outcome = cancelled ? { page:home.currentPage, openLibrary:false } : resolveDesktopPage({
    currentPage:home.currentPage, pageCount:home.pageCount, delta:pageDragX.value, velocity:pageDragX.value / elapsed
  })
  home.setPage(outcome.page)
  if (outcome.openLibrary) emit('open-library')
  pageDragX.value = 0
}
function cleanup(cancelled) {
  if (!pointer) return
  clearTimers()
  if (pointer.mode === 'item-drag') finishItem(cancelled)
  if (pointer.mode === 'folder-app-drag') {
    if (!cancelled) home.removeAppFromFolder(pointer.appId, pointer.folderId, home.currentPage, home.currentItems.length)
    ghost.value = null
  }
  if (pointer.mode === 'page') finishPage(cancelled)
  pointer = null; unbindWindow()
}
function onPointerUp(event) { if (pointer && event.pointerId === pointer.id) cleanup(false) }
function onPointerCancel(event) { if (pointer && event.pointerId === pointer.id) cleanup(true) }
function showFolder(folderId, element) {
  openFolderId.value = folderId
  folderOrigin.value = element?.getBoundingClientRect?.() || null
}
function onFolderAppPointerDown(event, appId) {
  if (event.button != null && event.button !== 0) return
  event.stopPropagation()
  pointer = { id:event.pointerId, mode:'folder-app-ready', appId, folderId:openFolderId.value,
    startX:event.clientX, startY:event.clientY, lastX:event.clientX, lastY:event.clientY, startedAt:performance.now() }
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
  if (item.type === 'widget') { home.removeWidget(item.widgetId); return }
  if (item.type === 'folder') { home.removeFolder(item.folderId); return }
  if (!home.canUninstall(item.appId)) { showToast('核心应用不可卸载'); return }
  pendingRemoval.value = [itemId]
}
function requestSelectedRemoval() {
  const ids = [...home.selectedItemIds]
  if (ids.some((id) => home.items[id]?.type === 'app' && !home.canUninstall(home.items[id].appId))) {
    showToast('核心应用不可卸载'); return
  }
  pendingRemoval.value = ids
}
function confirmRemoval() {
  for (const id of pendingRemoval.value) {
    const item = home.items[id]
    if (item?.type === 'app') home.uninstallApp(item.appId)
    else if (item?.type === 'widget') home.removeWidget(item.widgetId)
    else if (item?.type === 'folder') home.removeFolder(item.folderId)
  }
  pendingRemoval.value = []
}
const selectedFolder = computed(() => {
  if (home.selectedItemIds.length !== 1) return null
  const item = home.items[home.selectedItemIds[0]]
  return item?.type === 'folder' ? home.folders[item.folderId] : null
})
onBeforeUnmount(() => { clearTimeout(unlockTimer); clearTimers(); unbindWindow() })
</script>

<template>
  <div ref="rootRef" class="home-screen" :class="{ 'just-unlocked':justUnlocked, 'is-editing':home.editing }" :style="homeStyle" @pointerdown="onEmptyPointerDown">
    <div class="home-page-strip" :style="stripStyle">
      <section v-for="(page,pageIndex) in displayPages" :key="pageIndex" class="home-page">
        <AppGrid :page-index="pageIndex" :item-ids="page" :items="home.items" :positions="displayPositions[pageIndex]"
          :folders="home.folders" :editing="home.editing" :selected-ids="home.selectedItemIds" :dragging-id="dragging?.id" :folder-target-id="folderTargetId"
          @item-pointerdown="onItemPointerDown" @toggle-select="home.toggleSelected" @open-folder="showFolder" @request-remove="requestRemove" />
      </section>
    </div>
    <button v-if="home.editing" class="done-button" type="button" @click="home.setEditing(false)">完成</button>
    <div class="indicator-wrap"><PageIndicator :count="displayPages.length" :current="home.currentPage" @search="emit('open-library')" /></div>
    <DockBar :dragging-id="dragging?.id" :dock-target-index="dockTargetIndex" @item-pointerdown="onDockPointerDown"
      @toggle-select="home.toggleSelected" @request-remove="requestRemove" />
    <div v-if="home.editing && (home.selectedItemIds.length >= 2 || selectedFolder)" class="folder-tools home-editor">
      <button v-if="home.selectedItemIds.length >= 2" type="button" @click="createSelectedFolder">新建文件夹</button>
      <template v-if="selectedFolder">
        <button v-for="size in [[1,1],[2,1],[1,2],[2,2]]" :key="size.join('x')" type="button"
          :class="{ active:selectedFolder.width === size[0] && selectedFolder.height === size[1] }"
          @click="home.resizeFolder(selectedFolder.id,size[0],size[1])">{{ size[0] }}×{{ size[1] }}</button>
      </template>
    </div>
    <HomeFolderOverlay v-if="openFolderId && home.folders[openFolderId]" :folder="home.folders[openFolderId]" :origin="folderOrigin"
      @close="openFolderId=null" @rename="home.renameFolder(openFolderId,$event)" @app-pointerdown="onFolderAppPointerDown" />
    <div v-if="home.editing" class="edit-toolbar home-editor">
      <button type="button" @click="showToast('小组件：开发中')">小组件</button>
      <button type="button" @click="showToast('壁纸与个性化：开发中')">壁纸与个性化</button>
      <button type="button" @click="showToast('布局：开发中')">布局</button>
      <button type="button" @click="showToast('桌面设置：开发中')">桌面设置</button>
      <button :disabled="!home.selectedItemIds.length" type="button" @click="requestSelectedRemoval">删除</button>
    </div>
    <div v-if="toast" class="home-toast">{{ toast }}</div>
    <ActionModal :visible="pendingRemoval.length > 0" title="卸载应用？" desc="应用将从桌面、文件夹、Dock 和应用资源库中移除。"
      cancel-text="取消" confirm-text="卸载" @cancel="pendingRemoval=[]" @backdrop="pendingRemoval=[]" @confirm="confirmRemoval" />
    <div v-if="ghost" class="drag-ghost" :style="{ transform:`translate3d(${ghost.x}px,${ghost.y}px,0)` }">
      <img v-if="ghostApp?.image" :src="ghostApp.image" alt=""><span v-else>{{ ghostApp?.name || '组件' }}</span>
    </div>
  </div>
</template>

<style scoped>
.home-screen{position:absolute;inset:0;z-index:var(--z-home);overflow:hidden;touch-action:none}.home-page-strip{position:absolute;inset:0;display:flex;will-change:transform}.home-page{flex:0 0 100%;width:100%;height:100%}.indicator-wrap{position:absolute;bottom:136px;left:0;right:0;display:flex;justify-content:center}.done-button{position:absolute;right:18px;top:calc(var(--safe-top,54px) + 2px);z-index:12;padding:7px 14px;border-radius:18px;color:#fff;background:rgba(35,35,40,.55);backdrop-filter:blur(18px);font:600 14px/1 var(--font-stack)}.drag-ghost{position:fixed;left:-34px;top:-44px;z-index:999;width:68px;min-height:76px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:var(--text-caption);pointer-events:none;filter:drop-shadow(0 12px 18px rgba(0,0,0,.35));will-change:transform}.drag-ghost img{width:60px;height:60px;border-radius:17px;object-fit:cover;transform:scale(1.08)}.folder-tools{position:absolute;left:50%;bottom:205px;z-index:20;transform:translateX(-50%);display:flex;gap:6px;padding:7px;border-radius:20px;background:rgba(25,25,30,.62);backdrop-filter:blur(20px)}.folder-tools button{padding:7px 9px;border-radius:13px;color:#fff;font:600 12px/1 var(--font-stack)}.folder-tools button.active{background:#0a84ff}.edit-toolbar{position:absolute;left:10px;right:10px;bottom:132px;z-index:18;min-height:54px;padding:5px;display:flex;align-items:center;justify-content:space-around;border-radius:22px;background:rgba(28,28,34,.72);backdrop-filter:blur(24px)}.edit-toolbar button{width:20%;padding:5px 2px;color:#fff;font:500 10px/1.25 var(--font-stack)}.edit-toolbar button:last-child{color:#ff6b64}.edit-toolbar button:disabled{opacity:.35}.home-toast{position:absolute;left:50%;bottom:198px;z-index:80;transform:translateX(-50%);padding:9px 15px;border-radius:17px;background:rgba(20,20,24,.82);color:#fff;white-space:nowrap;font:600 13px/1 var(--font-stack);animation:toast-in 180ms ease}@keyframes toast-in{from{opacity:0;transform:translate(-50%,8px)}}
@media (prefers-reduced-motion:reduce){.home-page-strip{transition-duration:1ms!important}}
</style>
