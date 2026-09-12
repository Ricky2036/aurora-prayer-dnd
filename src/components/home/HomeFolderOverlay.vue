<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { getApp } from '../../config/apps'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({ folder:{type:Object,required:true}, origin:{type:Object,default:null} })
const emit = defineEmits(['close','rename','app-pointerdown','launch-app','transition-finished'])
const panelRef = ref(null)
const titleRef = ref(null)
const iconRefs = new Map()
const phase = ref('measuring')
let closeTimer = null
const setIconRef = (id,el) => { if (el) iconRefs.set(id,el); else iconRefs.delete(id) }
const rectTransform = (from,to) => (!from || !to?.width || !to?.height) ? { x:0,y:0,sx:.2,sy:.2 } :
  ({ x:from.left-to.left,y:from.top-to.top,sx:from.width/to.width,sy:from.height/to.height })
function setMotionVars(element,motion) {
  if (!element) return
  element.style.setProperty('--from-x',`${motion.x}px`); element.style.setProperty('--from-y',`${motion.y}px`)
  element.style.setProperty('--from-sx',motion.sx); element.style.setProperty('--from-sy',motion.sy)
}
async function prepareMotion() {
  await nextTick()
  const fallback = props.origin?.shellRect
  setMotionVars(panelRef.value,rectTransform(fallback,panelRef.value?.getBoundingClientRect()))
  setMotionVars(titleRef.value,rectTransform(props.origin?.titleRect || fallback,titleRef.value?.getBoundingClientRect()))
  for (const [appId,element] of iconRefs) setMotionVars(element,rectTransform(props.origin?.iconRects?.[appId] || fallback,element.getBoundingClientRect()))
  phase.value = 'opening'
  requestAnimationFrame(() => requestAnimationFrame(() => { phase.value = 'open'; emit('transition-finished','open') }))
}
function close() {
  if (phase.value === 'closing' || phase.value === 'launching') return
  phase.value = 'closing'; clearTimeout(closeTimer)
  closeTimer = setTimeout(() => { emit('transition-finished','closed'); emit('close') },280)
}
function launch(appId,anchor) {
  if (phase.value !== 'open') return
  phase.value = 'launching'; emit('launch-app',appId,anchor)
}
function onOverlayClick(event) { if (!event.target.closest('.folder-panel-app,.folder-title')) close() }
onMounted(prepareMotion)
onBeforeUnmount(() => clearTimeout(closeTimer))
</script>

<template>
  <div class="folder-overlay" :class="`phase-${phase}`" @pointerdown.stop @click="onOverlayClick">
    <div ref="panelRef" class="folder-panel">
      <input ref="titleRef" class="folder-title" :value="folder.name" maxlength="24" aria-label="文件夹名称" @change="emit('rename',$event.target.value)" />
      <div class="folder-content">
        <div v-for="appId in folder.appIds" :key="appId" :ref="el => setIconRef(appId,el)" class="folder-panel-app" :data-folder-app="appId"
          @pointerdown="emit('app-pointerdown',$event,appId)" @click.stop="launch(appId,$event.currentTarget.querySelector('.app-icon-anchor'))">
          <AppIcon :app="getApp(appId)" :launch-on-click="false" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.folder-overlay{position:absolute;inset:0;z-index:30;display:grid;place-items:center;background:rgba(15,18,30,.2);backdrop-filter:blur(28px) saturate(130%);transition:opacity 240ms ease,backdrop-filter 320ms ease}.folder-panel{width:calc(100% - 36px);min-height:360px;padding:24px 18px 28px;box-sizing:border-box;border-radius:36px;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.32);box-shadow:0 24px 60px rgba(0,0,0,.25);transform-origin:top left;transition:transform 320ms cubic-bezier(.22,.8,.24,1),border-radius 320ms ease,opacity 220ms ease}.folder-title{display:block;width:70%;margin:0 auto 24px;padding:4px 0 6px;border:0;border-bottom:1px solid transparent;border-radius:0;background:transparent;color:#fff;text-align:center;font:600 20px/1.2 var(--font-stack);outline:none;transform-origin:top left;transition:transform 320ms cubic-bezier(.22,.8,.24,1),opacity 180ms ease}.folder-title:focus{border-bottom-color:rgba(255,255,255,.5)}.folder-content{display:grid;grid-template-columns:repeat(3,1fr);gap:22px 16px;justify-items:center}.folder-panel-app{touch-action:none;transform-origin:top left;transition:transform 320ms cubic-bezier(.22,.8,.24,1),opacity 180ms ease}.phase-measuring{visibility:hidden}.phase-opening{opacity:0}.phase-opening .folder-panel,.phase-closing .folder-panel{transform:translate3d(var(--from-x),var(--from-y),0) scale(var(--from-sx),var(--from-sy));border-radius:17px}.phase-opening .folder-title,.phase-opening .folder-panel-app,.phase-closing .folder-title,.phase-closing .folder-panel-app{transform:translate3d(var(--from-x),var(--from-y),0) scale(var(--from-sx),var(--from-sy));opacity:.25}.phase-closing{opacity:0;transition-duration:280ms}.phase-closing .folder-panel,.phase-closing .folder-title,.phase-closing .folder-panel-app{transition-duration:280ms}.phase-launching{opacity:0;transition-duration:160ms;pointer-events:none}.phase-launching .folder-panel{transform:scale(.96);opacity:.2;transition-duration:160ms}@media(prefers-reduced-motion:reduce){.folder-overlay,.folder-panel,.folder-title,.folder-panel-app{transition-duration:1ms!important}}
</style>
