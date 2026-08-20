<script setup>
import { computed, ref, watch } from 'vue'
import { useSystemStore } from '../../stores/systemStore'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { getDriver } from '../../composables/driverRegistry'
import AppGrid from './AppGrid.vue'
import DockBar from './DockBar.vue'
import PageIndicator from '../ui/PageIndicator.vue'

/**
 * 桌面：网格页 + 分页指示 + Dock。
 * 解锁完成瞬间加 .just-unlocked 触发图标/Widget 入场动画。
 * 横向左滑（越界）= 打开 App 资源库（复用 ScreenView 注册的共享驱动）。
 */
const emit = defineEmits(['open-library'])
const system = useSystemStore()

const rootRef = ref(null)
useSwipeGesture(rootRef, getDriver('appLibrary').gesture)

/** 解锁入场：桌面整体从 1.15 缩放回 1（与锁屏上移联动） */
const homeStyle = computed(() => {
  const p = system.unlockProgress
  if (p <= 0) return {}
  return {
    transform: `scale(${1.12 - p * 0.12})`,
    opacity: 0.3 + p * 0.7
  }
})

const justUnlocked = ref(false)
const compositorPrepared = computed(() =>
  system.baseLayer === 'lock' || system.unlockProgress > 0
)
watch(
  () => system.baseLayer,
  (layer, prev) => {
    if (layer === 'home' && prev === 'lock') {
      justUnlocked.value = true
      setTimeout(() => { justUnlocked.value = false }, 1100)
    }
  }
)
</script>

<template>
  <div
    ref="rootRef"
    class="home-screen"
    :class="{
      'just-unlocked': justUnlocked,
      'is-compositor-prepared': compositorPrepared
    }"
    :style="homeStyle"
  >
    <AppGrid />
    <div class="indicator-wrap">
      <PageIndicator :count="1" :current="0" @search="emit('open-library')" />
    </div>
    <DockBar />
  </div>
</template>

<style scoped>
.home-screen {
  position: absolute;
  inset: 0;
  z-index: var(--z-home);
  touch-action: pan-y;
}
.home-screen.is-compositor-prepared {
  will-change: transform, opacity;
}
.indicator-wrap {
  position: absolute;
  bottom: 136px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
}
</style>
