<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getApp } from '../../config/apps'
import { useHomeStore } from '../../stores/homeStore'
import { useSystemStore } from '../../stores/systemStore'
import { moveHomeItem, reflowHomePages, resolveDesktopPage } from '../../utils/homeLayout.js'
import AppGrid from './AppGrid.vue'
import DockBar from './DockBar.vue'
import PageIndicator from '../ui/PageIndicator.vue'

const emit = defineEmits(['open-library'])
const system = useSystemStore()
const home = useHomeStore()
const rootRef = ref(null)
const previewPages = ref(null)
const pageDragX = ref(0)
const dragging = ref(null)
const ghost = ref(null)
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
let pointer = null
function clearTimers() { clearTimeout(pressTimer); clearTimeout(edgeTimer); pressTimer = null; edgeTimer = null }
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
function startItemDrag(x, y) {
  if (!pointer?.itemId) return
  pointer.mode = 'item-drag'
  previewPages.value = home.pages.map((page) => [...page])
  dragging.value = { id:pointer.itemId, page:pointer.page, index:pointer.index }
  ghost.value = { id:pointer.itemId, x, y }
}
function targetIndexAt(x, y) {
  const rect = rootRef.value.getBoundingClientRect()
  const col = Math.max(0, Math.min(3, Math.floor((x - rect.left) / (rect.width / 4))))
  const row = Math.max(0, Math.min(5, Math.floor((y - rect.top - 66) / 84)))
  return Math.max(0, Math.min(row * 4 + col, previewPages.value[home.currentPage].length))
}
function updatePreview(x, y) {
  if (!dragging.value || !previewPages.value) return
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
  if (!cancelled && dragging.value) home.moveItem(dragging.value.id, dragging.value.page, dragging.value.index)
  previewPages.value = null; dragging.value = null; ghost.value = null
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
  if (pointer.mode === 'page') finishPage(cancelled)
  pointer = null; unbindWindow()
}
function onPointerUp(event) { if (pointer && event.pointerId === pointer.id) cleanup(false) }
function onPointerCancel(event) { if (pointer && event.pointerId === pointer.id) cleanup(true) }
onBeforeUnmount(() => { clearTimeout(unlockTimer); clearTimers(); unbindWindow() })
</script>

<template>
  <div ref="rootRef" class="home-screen" :class="{ 'just-unlocked':justUnlocked, 'is-editing':home.editing }" :style="homeStyle" @pointerdown="onEmptyPointerDown">
    <div class="home-page-strip" :style="stripStyle">
      <section v-for="(page,pageIndex) in displayPages" :key="pageIndex" class="home-page">
        <AppGrid :page-index="pageIndex" :item-ids="page" :items="home.items" :positions="displayPositions[pageIndex]"
          :folders="home.folders" :editing="home.editing" :selected-ids="home.selectedItemIds" :dragging-id="dragging?.id"
          @item-pointerdown="onItemPointerDown" @toggle-select="home.toggleSelected" />
      </section>
    </div>
    <button v-if="home.editing" class="done-button" type="button" @click="home.setEditing(false)">完成</button>
    <div class="indicator-wrap"><PageIndicator :count="displayPages.length" :current="home.currentPage" @search="emit('open-library')" /></div>
    <DockBar />
    <div v-if="ghost" class="drag-ghost" :style="{ transform:`translate3d(${ghost.x}px,${ghost.y}px,0)` }">
      <img v-if="ghostApp?.image" :src="ghostApp.image" alt=""><span v-else>{{ ghostApp?.name || '组件' }}</span>
    </div>
  </div>
</template>

<style scoped>
.home-screen{position:absolute;inset:0;z-index:var(--z-home);overflow:hidden;touch-action:none}.home-page-strip{position:absolute;inset:0;display:flex;will-change:transform}.home-page{flex:0 0 100%;width:100%;height:100%}.indicator-wrap{position:absolute;bottom:136px;left:0;right:0;display:flex;justify-content:center}.done-button{position:absolute;right:18px;top:calc(var(--safe-top,54px) + 2px);z-index:12;padding:7px 14px;border-radius:18px;color:#fff;background:rgba(35,35,40,.55);backdrop-filter:blur(18px);font:600 14px/1 var(--font-stack)}.drag-ghost{position:fixed;left:-34px;top:-44px;z-index:999;width:68px;min-height:76px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:var(--text-caption);pointer-events:none;filter:drop-shadow(0 12px 18px rgba(0,0,0,.35));will-change:transform}.drag-ghost img{width:60px;height:60px;border-radius:17px;object-fit:cover;transform:scale(1.08)}
@media (prefers-reduced-motion:reduce){.home-page-strip{transition-duration:1ms!important}}
</style>
