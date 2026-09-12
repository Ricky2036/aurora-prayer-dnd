<script setup>
import { computed } from 'vue'
import { getApp } from '../../config/apps'
import { useHomeStore } from '../../stores/homeStore'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({ profile:{type:Object,required:true}, draggingId:{type:String,default:null}, dockTargetIndex:{type:Number,default:null}, removingIds:{type:Array,default:()=>[]} })
const emit = defineEmits(['item-pointerdown','toggle-select','request-remove'])
const home = useHomeStore()
const selected = computed(() => new Set(home.selectedItemIds))
function activate(event,id) {
  if (!home.editing) return
  event.preventDefault(); event.stopPropagation(); emit('toggle-select',id)
}
</script>

<template>
  <div class="dock-bar" :class="{ 'has-target':dockTargetIndex != null }" :style="{height:`${profile.dockRect.height}px`,bottom:`${profile.height-profile.dockRect.bottom}px`}">
    <div v-for="(id,index) in home.dock" :key="id" class="dock-item"
      :class="{ 'is-editing':home.editing, 'is-selected':selected.has(id), 'is-dragging-source':draggingId === id, 'is-drop-target':dockTargetIndex === index, 'is-removing':removingIds.includes(id) }"
      :data-dock-item="id" :data-dock-index="index"
      @pointerdown="emit('item-pointerdown',$event,id,index)" @click.capture="activate($event,id)">
      <AppIcon :app="getApp(home.items[id]?.appId)" :size="profile.iconSize" :show-label="false" :enter-delay="260 + index * 40" home-anchor />
      <button v-if="home.editing" class="remove-badge" type="button" aria-label="移除应用" @click.stop="emit('request-remove',id)">−</button>
      <span v-if="home.editing" class="dock-select">{{ selected.has(id) ? '✓' : '' }}</span>
    </div>
  </div>
</template>

<style scoped>
.dock-bar{position:absolute;left:14px;right:14px;bottom:28px;height:92px;border-radius:28px;background:rgba(255,255,255,.24);backdrop-filter:blur(22px) saturate(180%);border:.5px solid rgba(255,255,255,.28);display:grid;grid-template-columns:repeat(4,1fr);align-items:center;justify-items:center;padding:0 8px;z-index:var(--z-dock);transition:background 180ms ease}.dock-bar.has-target{background:rgba(255,255,255,.36)}.dock-item{position:relative;transition:transform 180ms ease,opacity 160ms ease;touch-action:none}.dock-item.is-editing{animation:dock-wiggle 170ms ease-in-out infinite alternate}.dock-item.is-dragging-source{opacity:.15}.dock-item.is-drop-target{transform:scale(1.12)}.dock-item.is-removing{transform:scale(.2);opacity:0}.remove-badge{position:absolute;left:-7px;top:-7px;width:21px;height:21px;border-radius:50%;background:rgba(45,45,50,.85);color:#fff;font:700 19px/18px var(--font-stack);z-index:5}.dock-select{position:absolute;right:-5px;top:-5px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:#0a84ff;color:#fff;font:700 11px/1 var(--font-stack)}@keyframes dock-wiggle{from{transform:rotate(-1deg)}to{transform:rotate(1deg)}}@media(prefers-reduced-motion:reduce){.dock-item.is-editing{animation:none}}
</style>
