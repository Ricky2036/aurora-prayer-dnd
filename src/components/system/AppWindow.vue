<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getApp } from '../../config/apps'
import { appComponents } from '../apps/registry'
import PlaceholderApp from '../apps/PlaceholderApp.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useHeroTransition } from '../../composables/useHeroTransition'
import { useHomeStore } from '../../stores/homeStore'
import { useSystemStore } from '../../stores/systemStore'
import { consumeLaunchRect, getAnchorRect } from '../../utils/appIconAnchors'
import { buildHeroClipPath, makeViewportRect } from '../../utils/heroGeometry'
import { screenRef } from '../../utils/screenRef'

const props = defineProps({
  appId: { type: String, required: true }
})
const emit = defineEmits(['hero-frame'])

const system = useSystemStore()
const home = useHomeStore()
const hero = useHeroTransition()
const ready = ref(false)
const viewportRect = ref(null)
const viewportRadius = ref(47)

const app = computed(() => getApp(props.appId))
const activeComp = computed(() => appComponents[props.appId] || PlaceholderApp)
const phase = hero.phase
const frame = hero.frame

function readViewport() {
  const element = screenRef.el
  if (!element) return null
  viewportRect.value = makeViewportRect(element.offsetWidth, element.offsetHeight)
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius)
  viewportRadius.value = Number.isFinite(radius) ? radius : 47
  return viewportRect.value
}

const windowStyle = computed(() => {
  const current = frame.value
  if (!current) return { visibility: 'hidden' }
  const rect = current.windowRect
  return {
    visibility: ready.value ? 'visible' : 'hidden',
    left: '0px',
    top: '0px',
    transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: `${current.radius}px`
  }
})

const fixedContainerStyle = computed(() => {
  const current = frame.value
  const viewport = viewportRect.value
  if (!current || !viewport) return {}
  
  // 使用等比缩放 (Uniform Scale) 以防拉伸/挤压变形
  const scale = current.windowRect.width / viewport.width
  const scaledHeight = viewport.height * scale
  // 垂直居中补偿：让外部裁剪框（clipPath）自然裁剪多余的上下部分
  const yOffset = (current.windowRect.height - scaledHeight) / 2
  
  return {
    width: `${viewport.width}px`,
    height: `${viewport.height}px`,
    transform: `translate3d(0, ${yOffset}px, 0) scale(${scale})`
  }
})

const clipStyle = computed(() => {
  const current = frame.value
  if (!current) return {}
  return {
    borderRadius: `${current.radius}px`,
    clipPath: buildHeroClipPath(current)
  }
})

const contentStyle = computed(() => ({ opacity: frame.value?.contentOpacity ?? 0 }))
const appSurfaceStyle = computed(() => ({
  background: app.value?.gradient || '#f2f2f7',
  opacity: frame.value?.appSurfaceOpacity ?? 0
}))
const heroFillStyle = computed(() => ({
  background: app.value?.heroBackground || '#f2f2f7',
  opacity: frame.value?.heroFillOpacity ?? 0
}))
const mirrorIconSize = computed(() => frame.value?.windowRect.width || 60)
const iconWrapperStyle = computed(() => {
  const current = frame.value
  if (!current) return { opacity: 0 }
  return {
    width: `${mirrorIconSize.value}px`,
    height: `${mirrorIconSize.value}px`,
    opacity: current.iconOpacity,
    // 直接以当帧真实尺寸栅格化，避免 scale(1.x) → none 时产生锐度跳变。
    transform: 'none'
  }
})

function closeToLiveAnchor() {
  if (['closing', 'handoff', 'closed'].includes(phase.value)) return
  const screen = screenRef.el
  const viewport = readViewport()
  const anchor = getAnchorRect(props.appId, screen)
  if (!viewport || !anchor) {
    home.showIcon()
    system.setHomeGestureProgress(0)
    system.finishGoHome()
    return
  }

  // 手势进度在这里之前保持不变；当前跟手帧就是关闭动画的精确起点。
  const startRect = frame.value?.windowRect || viewport
  hero.beginClose({
    viewportRect: viewport,
    anchorRect: anchor,
    startRect,
    startRadius: frame.value?.radius,
    startBackdropStrength: frame.value?.backdropStrength,
    viewportRadius: viewportRadius.value,
    onHandoff: () => home.showIcon(),
    onClosed: () => system.finishGoHome()
  })
  system.setHomeGestureProgress(0)
}

onMounted(() => {
  const screen = screenRef.el
  const viewport = readViewport()
  const launchRect = consumeLaunchRect(props.appId) || getAnchorRect(props.appId, screen)
  if (!viewport || !launchRect) {
    ready.value = true
    home.hideIcon(props.appId)
    return
  }

  home.hideIcon(props.appId)
  hero.beginOpen({
    viewportRect: viewport,
    anchorRect: launchRect,
    viewportRadius: viewportRadius.value
  })
  ready.value = true
})

watch(
  () => system.homeGestureProgress,
  (progress) => {
    if (!viewportRect.value) return
    hero.setPreview({
      viewportRect: viewportRect.value,
      progress,
      viewportRadius: viewportRadius.value
    })
  }
)

watch(
  () => system.baseLayer,
  (layer) => {
    if (layer === 'home' && system.activeAppId === props.appId) closeToLiveAnchor()
  },
  { flush: 'post' }
)

watch(
  frame,
  (current) => emit('hero-frame', current
    ? { phase: phase.value, backdropStrength: current.backdropStrength }
    : null),
  { immediate: true, flush: 'sync' }
)

onBeforeUnmount(() => {
  emit('hero-frame', null)
  hero.stop()
})
</script>

<template>
  <div
    class="app-window"
    :data-phase="phase"
    :data-app-id="appId"
    :style="windowStyle"
  >
    <div class="aw-clip" :style="clipStyle">
      <div class="aw-fill" :style="heroFillStyle"></div>
      <div class="aw-fixed-container" :style="fixedContainerStyle">
        <div class="aw-app-surface" :style="appSurfaceStyle"></div>
        <div class="aw-content" :style="contentStyle">
          <component :is="activeComp" :app="app" />
        </div>
      </div>
    </div>

    <div class="aw-icon-wrapper" :style="iconWrapperStyle">
      <AppIcon
        v-if="app"
        :app="app"
        :size="mirrorIconSize"
        :show-label="false"
        :home-anchor="false"
        ignore-hidden
      />
    </div>
  </div>
</template>

<style scoped>
.app-window {
  position: absolute;
  z-index: var(--z-app-window);
  will-change: transform, width, height, border-radius;
}
.aw-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  will-change: border-radius;
}
.aw-fixed-container {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}
.aw-fill,
.aw-app-surface,
.aw-content {
  position: absolute;
  inset: 0;
  will-change: opacity;
}
.aw-icon-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 10;
  transform-origin: top left;
}
</style>
