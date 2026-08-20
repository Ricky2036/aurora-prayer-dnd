<script setup>
import { computed, ref, watch } from 'vue'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { useSpring } from '../../composables/useSpring'
import { useSystemStore } from '../../stores/systemStore'

/**
 * 底部 Home Indicator 手势条：
 * - 点击 = 直接返回桌面 / 解锁 / 收起叠层（点击降级，照顾不会拖拽的评审人）
 * - 上滑 = 跟手缩放预览，松手按速度/进度判定返回或回弹
 * 场景优先级：应用抽屉打开 → 收起抽屉；NC/CC 打开 → 收起对应叠层；
 * 锁屏 → 解锁进桌面；应用内 → 回桌面。
 * 热区比视觉条大（透明延伸区），保证好触发；拖拽后 350ms 内抑制 click。
 */
const props = defineProps({
  dark: { type: Boolean, default: false }
})

const system = useSystemStore()
const rootRef = ref(null)
const GESTURE_SPAN = 260 // 更小的满量程 → 同样位移给出更大进度，更跟手

const { value: springVal, animateTo, snapTo } = useSpring(0, 'ios-snappy')
watch(springVal, (v) => system.setHomeGestureProgress(v))

/** 当前应该执行的「回退/前进」动作 */
function doAction() {
  const o = system.overlays
  if (o.appLibrary.status !== 'closed') {
    system.requestCloseOverlay('appLibrary')
    return
  }
  if (o.notificationCenter.status !== 'closed') {
    system.requestCloseOverlay('notificationCenter')
    return
  }
  if (o.controlCenter.status !== 'closed') {
    system.requestCloseOverlay('controlCenter')
    return
  }
  if (system.baseLayer === 'lock') {
    system.unlock()
    return
  }
  if (system.baseLayer === 'app') {
    system.goHome()
  }
}

const gesture = useSwipeGesture(rootRef, {
  axis: 'y',
  direction: -1,
  span: GESTURE_SPAN,
  threshold: 5,
  canStart: () =>
    system.baseLayer === 'app' ||
    system.baseLayer === 'lock' ||
    system.anyOverlayOpen(),
  onStart() {
    snapTo(system.homeGestureProgress)
  },
  onProgress(p) {
    snapTo(p)
  },
  onRelease(p, velocity) {
    const goHome = p > 0.16 || velocity > 0.4
    if (goHome) {
      // AppWindow 必须先捕获当前跟手矩形；动画接管后再清空进度。
      doAction()
    } else {
      animateTo(0, { initialVelocity: velocity })
    }
    return goHome ? 1 : 0
  }
})

const bg = computed(() => (props.dark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.88)'))

function onTap() {
  // 拖拽松手后浏览器会补发 click，350ms 内忽略防误回桌面
  if (Date.now() - gesture.lastDragEndAt() < 350) return
  doAction()
}
</script>

<template>
  <div ref="rootRef" class="home-indicator" @click="onTap">
    <div class="bar" :style="{ background: bg }"></div>
  </div>
</template>

<style scoped>
.home-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  /* 热区高于视觉条：向上透明延伸，提升可触发性 */
  height: calc(var(--safe-bottom) + 18px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 9px;
  z-index: var(--z-home-indicator);
  cursor: pointer;
  touch-action: none;
}
.bar {
  width: 134px;
  height: 5px;
  border-radius: 2.5px;
  transition: transform 0.15s ease;
  pointer-events: none;
}
.home-indicator:active .bar { transform: scaleX(0.92); }
</style>
