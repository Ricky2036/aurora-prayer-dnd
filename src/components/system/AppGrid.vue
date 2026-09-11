<script setup>
import { computed } from 'vue'
import { getApp } from '../../config/apps'
import AppIcon from '../ui/AppIcon.vue'
import ClockWidget from '../widgets/ClockWidget.vue'
import SmartSuggestionWidget from '../widgets/SmartSuggestionWidget.vue'

const props = defineProps({
  pageIndex: { type: Number, required: true }, itemIds: { type: Array, default: () => [] },
  items: { type: Object, required: true }, positions: { type: Object, default: () => ({}) },
  folders: { type: Object, default: () => ({}) }, editing: { type: Boolean, default: false },
  selectedIds: { type: Array, default: () => [] }, draggingId: { type: String, default: null }
})
const emit = defineEmits(['item-pointerdown', 'toggle-select', 'open-folder'])
const selected = computed(() => new Set(props.selectedIds))
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
    <div v-for="(id, index) in itemIds" :key="id" class="home-item"
      :class="{ 'is-editing': editing, 'is-selected': selected.has(id), 'is-dragging-source': draggingId === id, 'is-large': (positions[id]?.w || 1) > 1 || (positions[id]?.h || 1) > 1 }"
      :data-home-item="id" :data-page-index="pageIndex" :data-item-index="index" :style="itemStyle(id)"
      @pointerdown="emit('item-pointerdown', $event, id, pageIndex, index)"
      @click.capture="activate($event, id, items[id])">
      <ClockWidget v-if="items[id]?.type === 'widget' && items[id].widgetId === 'clock'" />
      <SmartSuggestionWidget v-else-if="items[id]?.type === 'widget'" />
      <AppIcon v-else-if="appFor(items[id])" :app="appFor(items[id])" :enter-delay="120 + index * 28" home-anchor />
      <button v-else-if="folderFor(items[id])" class="folder-placeholder" type="button">
        <span class="folder-mini-grid">
          <img v-for="appId in folderFor(items[id]).appIds.slice(0, 9)" :key="appId" :src="getApp(appId)?.image" alt="" />
        </span>
        <span>{{ folderFor(items[id]).name }}</span>
      </button>
      <span v-if="editing" class="selection-mark" aria-hidden="true">{{ selected.has(id) ? '✓' : '' }}</span>
    </div>
  </div>
</template>

<style scoped>
.app-grid { width:100%; height:100%; padding:calc(var(--safe-top,54px) + 12px) 24px 0; box-sizing:border-box; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-template-rows:repeat(6,76px); column-gap:var(--grid-gap-x,24px); row-gap:8px; align-content:start; }
.home-item { position:relative; min-width:0; min-height:0; display:flex; align-items:flex-start; justify-content:center; transition:transform 220ms cubic-bezier(.22,.8,.26,1),opacity 160ms ease; touch-action:none; }
.home-item.is-large { align-items:stretch; }
.home-item.is-dragging-source { opacity:.16; }
.home-item.is-editing:not(.is-dragging-source) { animation:home-wiggle 170ms ease-in-out infinite alternate; }
.home-item:nth-child(even).is-editing { animation-delay:-85ms; }
.selection-mark { position:absolute; top:-5px; left:1px; width:20px; height:20px; display:grid; place-items:center; border-radius:50%; color:#fff; background:rgba(50,50,55,.72); border:1.5px solid rgba(255,255,255,.9); font:700 13px/1 var(--font-stack); z-index:4; }
.is-selected .selection-mark { background:#0a84ff; }
.folder-placeholder { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; gap:4px; color:#fff; font:var(--text-caption); text-shadow:0 1px 3px rgba(0,0,0,.45); }
.folder-mini-grid { width:60px; height:60px; border-radius:17px; padding:8px; display:grid; grid-template-columns:repeat(3,1fr); gap:3px; box-sizing:border-box; background:rgba(255,255,255,.24); backdrop-filter:blur(18px); }
.folder-mini-grid img { width:100%; aspect-ratio:1; border-radius:5px; object-fit:cover; }
@keyframes home-wiggle { from{transform:rotate(-1deg)} to{transform:rotate(1deg)} }
@media (prefers-reduced-motion:reduce) { .home-item,.home-item.is-editing{animation:none;transition-duration:1ms} }
</style>
