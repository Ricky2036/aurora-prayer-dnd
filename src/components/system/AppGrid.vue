<script setup>
import { computed, onBeforeUpdate, onUpdated } from 'vue'
import { getApp } from '../../config/apps'
import AppIcon from '../ui/AppIcon.vue'
import ClockWidget from '../widgets/ClockWidget.vue'
import SmartSuggestionWidget from '../widgets/SmartSuggestionWidget.vue'
import HomeFolder from '../home/HomeFolder.vue'

const props = defineProps({
  pageIndex: { type: Number, required: true }, itemIds: { type: Array, default: () => [] },
  items: { type: Object, required: true }, positions: { type: Object, default: () => ({}) },
  folders: { type: Object, default: () => ({}) }, editing: { type: Boolean, default: false },
  selectedIds: { type: Array, default: () => [] }, draggingId: { type: String, default: null },
  folderTargetId: { type: String, default: null }, removingIds: { type: Array, default: () => [] }
})
const emit = defineEmits(['item-pointerdown', 'toggle-select', 'open-folder', 'request-remove'])
const selected = computed(() => new Set(props.selectedIds))
const removing = computed(() => new Set(props.removingIds))
const itemElements = new Map()
let previousRects = new Map()
function setItemRef(id, element) { if (element) itemElements.set(id, element); else itemElements.delete(id) }
onBeforeUpdate(() => { previousRects = new Map([...itemElements].map(([id,el]) => [id,el.getBoundingClientRect()])) })
onUpdated(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  requestAnimationFrame(() => {
    for (const [id,el] of itemElements) {
      const before = previousRects.get(id), after = el.getBoundingClientRect()
      if (!before) continue
      const x = before.left - after.left, y = before.top - after.top
      if (Math.abs(x) > .5 || Math.abs(y) > .5) el.animate([{transform:`translate3d(${x}px,${y}px,0)`},{transform:'translate3d(0,0,0)'}],{duration:220,easing:'cubic-bezier(.22,.8,.26,1)'})
    }
  })
})
const appFor = (item) => item?.type === 'app' ? getApp(item.appId) : null
const folderFor = (item) => item?.type === 'folder' ? props.folders[item.folderId] : null
function itemStyle(id) {
  const p = props.positions[id] || { row: 0, col: 0, w: 1, h: 1 }
  return { gridColumn: `${p.col + 1} / span ${p.w}`, gridRow: `${p.row + 1} / span ${p.h}` }
}
function activate(event, id, item) {
  if (props.editing) {
    event.preventDefault(); event.stopPropagation(); emit('toggle-select', id)
  } else if (item.type === 'folder') {
    event.preventDefault(); event.stopPropagation(); emit('open-folder', item.folderId, event.currentTarget)
  }
}
</script>

<template>
  <div class="app-grid" :data-page="pageIndex">
    <div v-for="(id, index) in itemIds" :key="id" :ref="el => setItemRef(id,el)" class="home-item"
      :class="{ 'is-editing': editing, 'is-selected': selected.has(id), 'is-dragging-source': draggingId === id, 'is-large': (positions[id]?.w || 1) > 1 || (positions[id]?.h || 1) > 1, 'is-widget': items[id]?.type === 'widget', 'is-folder-target': folderTargetId === id, 'is-removing': removing.has(id) }"
      :data-home-item="id" :data-page-index="pageIndex" :data-item-index="index" :style="itemStyle(id)"
      @pointerdown="emit('item-pointerdown', $event, id, pageIndex, index)"
      @click.capture="activate($event, id, items[id])">
      <ClockWidget v-if="items[id]?.type === 'widget' && items[id].widgetId === 'clock'" />
      <SmartSuggestionWidget v-else-if="items[id]?.type === 'widget'" />
      <AppIcon v-else-if="appFor(items[id])" :app="appFor(items[id])" :enter-delay="120 + index * 28" home-anchor />
      <HomeFolder v-else-if="folderFor(items[id])" :folder="folderFor(items[id])" :editing="editing" @open="emit('open-folder',items[id].folderId,$event)" />
      <span v-if="editing" class="selection-mark" aria-hidden="true">{{ selected.has(id) ? '✓' : '' }}</span>
      <button v-if="editing" class="remove-badge" type="button" aria-label="移除桌面项目" @click.stop="emit('request-remove',id)">−</button>
    </div>
  </div>
</template>

<style scoped>
.app-grid { width:100%; height:100%; padding:calc(var(--safe-top,54px) + 12px) 24px 0; box-sizing:border-box; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-template-rows:69.5px 69.5px repeat(4,79px); column-gap:var(--grid-gap-x,24px); row-gap:20px; align-content:start; }
.home-item { position:relative; min-width:0; min-height:79px; display:flex; align-items:flex-start; justify-content:center; transition:transform 220ms cubic-bezier(.22,.8,.26,1),opacity 160ms ease; touch-action:none; }
.home-item.is-widget { min-height:0; aspect-ratio:1/1; align-self:start; }
.home-item.is-widget :deep(.widget),
.home-item.is-widget :deep(.smart-suggestion-stack) { width:100%; height:auto; aspect-ratio:1/1; flex:none; }
.home-item.is-dragging-source { opacity:.16; }
.home-item.is-folder-target { transform:scale(1.1); filter:drop-shadow(0 0 14px rgba(255,255,255,.6)); }
.home-item.is-removing{transform:scale(.2);opacity:0;transition:transform 180ms ease,opacity 180ms ease}
.home-item.is-editing:not(.is-dragging-source) { animation:home-wiggle 170ms ease-in-out infinite alternate; }
.home-item:nth-child(even).is-editing { animation-delay:-85ms; }
.selection-mark { position:absolute; top:-5px; left:1px; width:20px; height:20px; display:grid; place-items:center; border-radius:50%; color:#fff; background:rgba(50,50,55,.72); border:1.5px solid rgba(255,255,255,.9); font:700 13px/1 var(--font-stack); z-index:4; }
.is-selected .selection-mark { background:#0a84ff; }
.remove-badge{position:absolute;right:-5px;top:-6px;width:21px;height:21px;border-radius:50%;background:rgba(45,45,50,.85);color:#fff;font:700 19px/18px var(--font-stack);z-index:5}
@keyframes home-wiggle { from{transform:rotate(-1deg)} to{transform:rotate(1deg)} }
@media (prefers-reduced-motion:reduce) { .home-item,.home-item.is-editing{animation:none;transition-duration:1ms} }
</style>
