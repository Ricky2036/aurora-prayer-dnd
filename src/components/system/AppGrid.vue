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
  profile: { type: Object, required: true },
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
      if (Math.abs(x) > .5 || Math.abs(y) > .5) {
        const frame = props.positions[id]
        if (frame) el.animate([
          {transform:`translate3d(${frame.x + x}px,${frame.y + y}px,0)`},
          {transform:`translate3d(${frame.x}px,${frame.y}px,0)`}
        ],{duration:220,easing:'cubic-bezier(.22,.8,.26,1)'})
      }
    }
  })
})
const appFor = (item) => item?.type === 'app' ? getApp(item.appId) : null
const folderFor = (item) => item?.type === 'folder' ? props.folders[item.folderId] : null
function itemStyle(id) {
  const p = props.positions[id] || { x: 0, y: 0, width: props.profile.iconSize, height: props.profile.iconSize }
  return { width: `${p.width}px`, height: `${p.height}px`, transform: `translate3d(${p.x}px,${p.y}px,0)` }
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
  <div class="app-grid" :class="{ 'is-editing': editing }" :data-page="pageIndex">
    <div v-for="(id, index) in itemIds" :key="id" :ref="el => setItemRef(id,el)" class="home-item"
      :class="{ 'is-editing': editing, 'is-selected': selected.has(id), 'is-dragging-source': draggingId === id, 'is-large': (positions[id]?.w || 1) > 1 || (positions[id]?.h || 1) > 1, 'is-widget': items[id]?.type === 'widget', 'is-folder-target': folderTargetId === id, 'is-removing': removing.has(id) }"
      :data-home-item="id" :data-page-index="pageIndex" :data-item-index="index" :style="itemStyle(id)"
      @pointerdown="emit('item-pointerdown', $event, id, pageIndex, index)"
      @click.capture="activate($event, id, items[id])">
      <ClockWidget v-if="items[id]?.type === 'widget' && items[id].widgetId === 'clock'" />
      <SmartSuggestionWidget v-else-if="items[id]?.type === 'widget'" />
      <AppIcon v-else-if="appFor(items[id])" :app="appFor(items[id])" :size="profile.iconSize * profile.compactScale" :enter-delay="120 + index * 28" home-anchor />
      <HomeFolder v-else-if="folderFor(items[id])" :folder="folderFor(items[id])" :editing="editing" @open="emit('open-folder',items[id].folderId,$event)" />
      <span v-if="editing" class="selection-mark" aria-hidden="true">{{ selected.has(id) ? '✓' : '' }}</span>
    </div>
  </div>
</template>

<style scoped>
.app-grid { position:relative;width:100%;height:100%;box-sizing:border-box; }
.app-grid.is-editing { transform:translate3d(0,32px,0) scale(.76); transform-origin:50% 50%; transition:transform 320ms cubic-bezier(.22,.8,.26,1); }
.home-item { position:absolute;left:0;top:0;min-width:0;display:flex;align-items:flex-start;justify-content:center;transition:opacity 160ms ease;touch-action:none;will-change:transform; }
.home-item.is-widget { min-height:0;aspect-ratio:1/1; }
.home-item.is-widget :deep(.widget),
.home-item.is-widget :deep(.smart-suggestion-stack) { width:100%; height:auto; aspect-ratio:1/1; flex:none; }
.home-item.is-dragging-source { opacity:.16; }
.home-item.is-folder-target { transform:scale(1.1); filter:drop-shadow(0 0 14px rgba(255,255,255,.6)); }
.home-item.is-removing{transform:scale(.2);opacity:0;transition:transform 180ms ease,opacity 180ms ease}
.home-item.is-editing:not(.is-dragging-source) { animation:home-wiggle 170ms ease-in-out infinite alternate; }
.home-item:nth-child(even).is-editing { animation-delay:-85ms; }
.selection-mark { position:absolute; top:-8px; right:-6px; width:25px; height:25px; display:grid; place-items:center; box-sizing:border-box; border-radius:50%; color:transparent; background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(240,245,255,.8)); border:1px solid rgba(255,255,255,.98); box-shadow:inset 0 1px 2px rgba(255,255,255,1),0 2px 7px rgba(15,26,62,.22); backdrop-filter:blur(12px) saturate(180%); font:700 14px/1 var(--font-stack); z-index:4; }
.is-selected .selection-mark { color:#fff; background:linear-gradient(145deg,#47a7ff,#0878f9); border-color:rgba(255,255,255,.88); box-shadow:inset 0 1px 1px rgba(255,255,255,.7),0 3px 9px rgba(0,91,230,.42); }
@keyframes home-wiggle { from{transform:rotate(-1deg)} to{transform:rotate(1deg)} }
@media (prefers-reduced-motion:reduce) { .app-grid.is-editing,.home-item,.home-item.is-editing{animation:none;transition-duration:1ms} }
</style>
