<script setup>
import { getApp } from '../../config/apps'
import AppIcon from '../ui/AppIcon.vue'

defineProps({ folder:{type:Object,required:true}, origin:{type:Object,default:null} })
const emit = defineEmits(['close','rename','app-pointerdown'])
</script>

<template>
  <div class="folder-overlay" @click.self="emit('close')">
    <div class="folder-panel">
      <input class="folder-title" :value="folder.name" maxlength="24" aria-label="文件夹名称"
        @change="emit('rename',$event.target.value)" />
      <div class="folder-content">
        <div v-for="appId in folder.appIds" :key="appId" class="folder-panel-app"
          @pointerdown="emit('app-pointerdown',$event,appId)">
          <AppIcon :app="getApp(appId)" />
        </div>
      </div>
      <button class="folder-close" type="button" aria-label="关闭文件夹" @click="emit('close')">完成</button>
    </div>
  </div>
</template>

<style scoped>
.folder-overlay{position:absolute;inset:0;z-index:30;display:grid;place-items:center;background:rgba(15,18,30,.2);backdrop-filter:blur(28px) saturate(130%);animation:folder-fade 320ms ease}.folder-panel{width:calc(100% - 36px);min-height:360px;padding:24px 18px 20px;box-sizing:border-box;border-radius:36px;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.32);box-shadow:0 24px 60px rgba(0,0,0,.25);animation:folder-open 320ms cubic-bezier(.22,.8,.24,1)}.folder-title{display:block;width:70%;margin:0 auto 24px;padding:8px 12px;border:0;border-radius:14px;background:rgba(255,255,255,.18);color:#fff;text-align:center;font:600 20px/1.2 var(--font-stack);outline:none}.folder-content{display:grid;grid-template-columns:repeat(3,1fr);gap:22px 16px;justify-items:center}.folder-panel-app{touch-action:none}.folder-close{display:block;margin:28px auto 0;padding:8px 18px;border-radius:18px;background:rgba(20,20,25,.45);color:#fff;font:600 14px/1 var(--font-stack)}@keyframes folder-fade{from{opacity:0}}@keyframes folder-open{from{transform:scale(.3);opacity:.2}to{transform:scale(1);opacity:1}}@media(prefers-reduced-motion:reduce){.folder-overlay,.folder-panel{animation:none}}
</style>
