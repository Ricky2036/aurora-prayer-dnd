<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useClock } from '../../composables/useClock'
import { useControlStore } from '../../stores/controlStore'
import { useSystemStore } from '../../stores/systemStore'
import { useRecorderStore } from '../../stores/recorderStore'
import StatusIcons from '../ui/StatusIcons.vue'
import LIcon from '../ui/LIcon.vue'

const { timeShort } = useClock()
const control = useControlStore()
const system = useSystemStore()
const recorder = useRecorderStore()

/** 当正在录音且不在录音应用内（灵动岛已激活显示）时，或者锁屏层时，隐藏状态栏原始时间 */
const hideTime = computed(() => {
  return system.baseLayer === 'lock' || (recorder.isRecording && system.activeAppId !== 'voicememos')
})

/** 锁屏/深色壁纸上用白字，应用内浅底用黑字 */
const props = defineProps({
  light: { type: Boolean, default: true }
})

/* 状态栏指示图标：启用对应功能时点亮（图标与对应开关按钮同源，保证视觉一致）
 * DND 有两个状态字段（控制中心 control.dnd 与设置页 control.doNotDisturb 未互相同步），
 * 任一为 true 都点亮，两个入口都能在状态栏看到。 */
const dndOn = computed(() => control.dnd || control.doNotDisturb)

/* ============ 状态栏图标优先级 ============
 * 设计原则（Ricky 2026-09-08）：
 *  1) 给每个状态栏图标定优先级；优先级越高越靠近右侧（越显眼 / 越晚被隐藏）。
 *  2) 原生连接图标（信号/Wi-Fi/电池，来自 <StatusIcons>）视为最高优先级，永远显示、固定在最右。
 *  3) 5 个功能指示器按优先级从右往左排（左=低优先级），整体放在原生图标左侧。
 *  4) 摄像头是 PhoneFrame 里的居中 .punch-hole（常驻挖孔）。右簇左缘一旦越过
 *     摄像头右边界，就隐藏「最低优先级」的指示器，避免与摄像头重叠。
 * 渲染顺序 = 优先级升序（DOM 左→右 = 低→高），故蓝牙(50)在最右、紧邻原生图标。
 * 隐藏顺序 = 优先级升序（先藏 vibrate，最后才藏蓝牙）。
 * 想调整权重：改下面 priority 数字即可（同档可并列）。 */
const indicatorDefs = [
  { key: 'vibrate',   icon: 'vibrate',   size: 18, sw: 2.5, priority: 20, show: () => control.soundMode === 'vibrate' },
  { key: 'mute',      icon: 'bellOff',   size: 18, sw: 2.5, priority: 30, show: () => control.soundMode === 'mute' },
  { key: 'hotspot',   icon: 'radio',     size: 18, sw: 2.5, priority: 40, show: () => control.hotspot },
  { key: 'bluetooth', icon: 'bluetooth', size: 16, sw: 2.4, priority: 50, show: () => control.bluetooth },
  { key: 'dnd',       icon: 'moon',      size: 18, sw: 2.5, priority: 60, show: () => dndOn.value }
]
// 渲染顺序：优先级升序（左→右 = 低→高）
const orderedIndicators = [...indicatorDefs].sort((a, b) => a.priority - b.priority)
const activeIndicators = computed(() => orderedIndicators.filter((d) => d.show()))

/* 被摄像头空间挤压而隐藏的指示器的 key 集合（空对象=全部显示） */
const hidden = ref({})
const sbRightRef = ref(null)
const HIDE_MARGIN = 6 // 摄像头右缘留的安全间距(px)

/** 摄像头(.punch-hole)右边界在屏幕坐标系下的 x（含安全间距） */
function cameraRightEdge() {
  const ph = document.querySelector('.punch-hole')
  if (!ph) return null
  return ph.getBoundingClientRect().right + HIDE_MARGIN
}

/** 反复测量右簇左缘，越界就隐藏最低优先级指示器，直到不重叠或无可隐藏 */
async function fit() {
  await nextTick()
  const sb = sbRightRef.value
  const cr = cameraRightEdge()
  if (!sb || cr == null) return
  let guard = 0
  while (guard++ < 20) {
    const left = sb.getBoundingClientRect().left
    if (left >= cr) break // 已不重叠
    const candidates = activeIndicators.value.filter((d) => !hidden.value[d.key])
    if (!candidates.length) break // 无可隐藏
    candidates.sort((a, b) => a.priority - b.priority) // 最低优先级优先隐藏
    hidden.value = { ...hidden.value, [candidates[0].key]: true }
    await nextTick()
  }
}

/** 状态变化/尺寸变化时：先全部放开，再重新收敛到「刚好不重叠」 */
function recompute() {
  hidden.value = {}
  fit()
}

let ro = null
function onResize() {
  recompute()
}
onMounted(() => {
  recompute()
  const scr = document.querySelector('.screen')
  if (scr && 'ResizeObserver' in window) {
    ro = new ResizeObserver(() => recompute())
    ro.observe(scr)
  }
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  window.removeEventListener('resize', onResize)
})

// 任何影响指示器显隐的状态变化都重算
watch(
  [dndOn, () => control.hotspot, () => control.soundMode, () => control.bluetooth],
  () => recompute()
)
</script>

<template>
  <div class="status-bar" :style="{ color: light ? '#fff' : '#000' }">
    <span class="sb-time" :style="{ opacity: hideTime ? 0 : 1 }">{{ timeShort }}</span>
    <div class="sb-right" ref="sbRightRef">
      <!-- 功能指示器：按优先级从右往左排，低优先级在摄像头挤压时先隐藏 -->
      <div class="sb-indicators">
        <LIcon
          v-for="d in orderedIndicators"
          v-show="d.show() && !hidden[d.key]"
          :key="d.key"
          :name="d.icon"
          :size="d.size"
          :stroke-width="d.sw"
          class="sb-ind"
          :data-key="d.key"
          :data-prio="d.priority"
        />
      </div>
      <!-- 原生连接图标：最高优先级，永远显示，固定在最右 -->
      <StatusIcons :color="light ? '#fff' : '#000'" />
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--safe-top);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 6.5px 30px 0;
  z-index: var(--z-status-bar);
  font: 600 15px/1 var(--font-stack);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2px;
  pointer-events: none; /* 热区手势由叠层 edge 元素负责 */
}
.sb-time {
  min-width: 54px;
  height: 32px;
  display: flex;
  align-items: center;
}
.sb-right {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.sb-indicators {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
.sb-ind {
  flex: 0 0 auto;
}
</style>
