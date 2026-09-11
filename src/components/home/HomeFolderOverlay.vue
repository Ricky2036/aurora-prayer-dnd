<script setup>
import { computed, ref } from 'vue'
import { getApp } from '../../config/apps'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({ folder:{type:Object,required:true}, origin:{type:Object,default:null} })
const emit = defineEmits(['close','rename','app-pointerdown'])
const closing = ref(false)
const panelStyle = computed(() => {
  if (!props.origin || typeof document === 'undefined') return {}
  const screen = document.querySelector('.home-screen')?.getBoundingClientRect()
  if (!screen?.width) return {}
  const scale = 390 / screen.width
  const x = (props.origin.left + props.origin.width / 2 - screen.left) * scale - 195
  const y = (props.origin.top + props.origin.height / 2 - screen.top) * scale - 422
  return { '--folder-origin-x':`${x}px`, '--folder-origin-y':`${y}px` }
})
function close() {
  if (closing.value) return
  closing.value = true
  setTimeout(() => emit('close'),320)
}
</script>

<template>
  <div class="folder-overlay" :class="{ closing }" @click.self="close">
    <div class="folder-panel" :style="panelStyle">
      <input class="folder-title" :value="folder.name" maxlength="24" aria-label="文件夹名称"
        @change="emit('rename',$event.target.value)" />
      <div class="folder-content">
        <div v-for="appId in folder.appIds" :key="appId" class="folder-panel-app"
          @pointerdown="emit('app-pointerdown',$event,appId)">
          <AppIcon :app="getApp(appId)" />
        </div>
      </div>
      <button class="folder-close" type="button" aria-label="关闭文件夹" @click="close">完成</button>
    </div>
  </div>
</template>

<style scoped>
.folder-overlay{position:absolute;inset:0;z-index:30;display:grid;place-items:center;background:rgba(15,18,30,.2);backdrop-filter:blur(28px) saturate(130%);animation:folder-fade 320ms ease}.folder-panel{width:calc(100% - 36px);min-height:360px;padding:24px 18px 20px;box-sizing:border-box;border-radius:36px;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.32);box-shadow:0 24px 60px rgba(0,0,0,.25);animation:folder-open 320ms cubic-bezier(.22,.8,.24,1)}.folder-overlay.closing{animation:folder-fade-out 320ms ease forwards}.folder-overlay.closing .folder-panel{animation:folder-close 320ms cubic-bezier(.4,0,.8,.2) forwards}.folder-title{display:block;width:70%;margin:0 auto 24px;padding:8px 12px;border:0;border-radius:14px;background:rgba(255,255,255,.18);color:#fff;text-align:center;font:600 20px/1.2 var(--font-stack);outline:none}.folder-content{display:grid;grid-template-columns:repeat(3,1fr);gap:22px 16px;justify-items:center}.folder-panel-app{touch-action:none}.folder-close{display:block;margin:28px auto 0;padding:8px 18px;border-radius:18px;background:rgba(20,20,25,.45);color:#fff;font:600 14px/1 var(--font-stack)}@keyframes folder-fade{from{opacity:0}}@keyframes folder-fade-out{to{opacity:0}}@keyframes folder-open{from{transform:translate(var(--folder-origin-x,0),var(--folder-origin-y,0)) scale(.2);opacity:.2}to{transform:translate(0,0) scale(1);opacity:1}}@keyframes folder-close{from{transform:translate(0,0) scale(1)}to{transform:translate(var(--folder-origin-x,0),var(--folder-origin-y,0)) scale(.2)}}@media(prefers-reduced-motion:reduce){.folder-overlay,.folder-panel{animation:none}.folder-overlay.closing{opacity:0}}
</style>
