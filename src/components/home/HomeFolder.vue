<script setup>
import { computed } from 'vue'
import { getApp } from '../../config/apps'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({ folder: { type:Object, required:true }, editing:{ type:Boolean, default:false } })
const emit = defineEmits(['open'])
const capacity = computed(() => props.folder.width === 2 && props.folder.height === 2 ? 9 :
  (props.folder.width > 1 || props.folder.height > 1 ? 6 : 4))
const large = computed(() => props.folder.width > 1 || props.folder.height > 1)
</script>

<template>
  <div class="home-folder" :class="{ large }">
    <div class="folder-surface" role="button" tabindex="0" @click="emit('open')" @keydown.enter="emit('open')">
      <span class="folder-apps" :class="`size-${folder.width}-${folder.height}`">
        <span v-for="appId in folder.appIds.slice(0, capacity)" :key="appId" class="folder-app">
          <AppIcon v-if="large && !editing" :app="getApp(appId)" :size="folder.height === 2 ? 48 : 40" :show-label="false" @click.stop />
          <img v-else :src="getApp(appId)?.image" alt="" />
        </span>
        <span v-if="folder.appIds.length > capacity" class="folder-more">+{{ folder.appIds.length - capacity }}</span>
      </span>
      <span class="folder-name">{{ folder.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.home-folder,.folder-surface{width:100%;height:100%}.folder-surface{display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff;font:var(--text-caption);text-shadow:0 1px 3px rgba(0,0,0,.45)}.folder-apps{width:60px;height:60px;padding:8px;box-sizing:border-box;border-radius:17px;background:rgba(255,255,255,.24);backdrop-filter:blur(18px) saturate(150%);display:grid;grid-template-columns:repeat(2,1fr);gap:4px;overflow:hidden;transition:transform 180ms ease,background 180ms ease}.large .folder-apps{width:100%;height:calc(100% - 20px);padding:11px;grid-template-columns:repeat(3,1fr);align-items:center}.size-1-2{grid-template-columns:repeat(2,1fr)}.folder-app{display:grid;place-items:center;min-width:0}.folder-app img{width:100%;aspect-ratio:1;border-radius:5px;object-fit:cover}.large .folder-app>img{width:40px;border-radius:12px}.folder-name{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.folder-more{display:grid;place-items:center;border-radius:10px;background:rgba(0,0,0,.2);font:600 11px/1 var(--font-stack)}
</style>
