<script setup>
import { computed } from 'vue'
import { getApp } from '../../config/apps'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({ folder: { type:Object, required:true }, editing:{ type:Boolean, default:false }, operationActive:{type:Boolean,default:false} })
const emit = defineEmits(['open','resize-pointerdown'])
const capacity = computed(() => props.folder.width === 2 && props.folder.height === 2 ? 9 :
  (props.folder.width > 1 || props.folder.height > 1 ? 6 : 9))
const visibleCapacity = computed(() => props.folder.appIds.length > capacity.value ? capacity.value - 1 : capacity.value)
const large = computed(() => props.folder.width > 1 || props.folder.height > 1)
</script>

<template>
  <div class="home-folder" :class="{ large }">
    <div class="folder-surface" role="button" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')">
      <span class="folder-apps" :class="`size-${folder.width}-${folder.height}`" data-folder-shell>
        <span v-for="appId in folder.appIds.slice(0, visibleCapacity)" :key="appId" class="folder-app" :data-folder-app="appId">
          <AppIcon :app="getApp(appId)" :size="large ? (folder.height === 2 ? 48 : 40) : 12" :show-label="false" @click.stop />
        </span>
        <span v-if="folder.appIds.length > capacity" class="folder-more">+{{ folder.appIds.length - visibleCapacity }}</span>
      </span>
      <span class="folder-name" data-folder-title>{{ folder.name }}</span>
      <button v-if="operationActive" class="folder-resize-handle" type="button" aria-label="调整文件夹大小" @pointerdown.stop="emit('resize-pointerdown',$event)"><i></i></button>
    </div>
  </div>
</template>

<style scoped>
.home-folder,.folder-surface{width:100%;height:100%}.folder-surface{display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff;font:var(--text-caption);text-shadow:0 1px 3px rgba(0,0,0,.45)}.folder-apps{width:60px;height:60px;padding:7px;box-sizing:border-box;border-radius:17px;background:rgba(255,255,255,.24);backdrop-filter:blur(18px) saturate(150%);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);place-content:start;align-items:start;justify-items:start;gap:3px;overflow:hidden;transition:transform 180ms ease,background 180ms ease}.large .folder-apps{width:100%;height:calc(100% - 20px);padding:11px;grid-template-columns:repeat(3,1fr);grid-template-rows:none;place-content:normal;align-items:center;justify-items:stretch;gap:4px}.size-1-2{grid-template-columns:repeat(2,1fr)}.folder-app{display:grid;place-items:center;min-width:0;width:100%;align-self:start}.folder-app img{width:100%;aspect-ratio:1;border-radius:4px;object-fit:cover}.large .folder-app>img{width:40px;border-radius:12px}.folder-name{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.folder-more{display:grid;place-items:center;width:100%;height:100%;border-radius:4px;background:rgba(0,0,0,.2);font:600 8px/1 var(--font-stack)}.large .folder-more{border-radius:10px;font-size:11px}
.home-folder:not(.large) .folder-app :deep(.app-icon){pointer-events:none}
.folder-resize-handle{position:absolute;right:-9px;bottom:13px;width:36px;height:36px;z-index:8;touch-action:none}.folder-resize-handle i{position:absolute;right:7px;bottom:7px;width:15px;height:15px;border-right:4px solid rgba(255,255,255,.96);border-bottom:4px solid rgba(255,255,255,.96);border-radius:0 0 7px 0;filter:drop-shadow(0 2px 4px rgba(0,0,0,.28))}.home-folder{position:relative}
</style>
