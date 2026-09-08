<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useClock } from '../../composables/useClock'
import { useControlStore } from '../../stores/controlStore'
import { useSystemStore } from '../../stores/systemStore'
import { useRecorderStore } from '../../stores/recorderStore'
import { useClockStore } from '../../stores/clockStore'
import { usePrayerStore } from '../../stores/prayerStore'
import { useActiveActivities } from '../../composables/useActiveActivities'
import StatusIcons from '../ui/StatusIcons.vue'
import LIcon from '../ui/LIcon.vue'
import { orderedIndicators } from '../../utils/statusBarIndicators'

const { timeShort } = useClock()
const control = useControlStore()
const system = useSystemStore()
const recorder = useRecorderStore()
const clockStore = useClockStore()
const prayerStore = usePrayerStore()
const { activeActivities, isMediaActive } = useActiveActivities()

/** 当正在录音且不在录音应用内（灵动岛已激活显示）时，或者锁屏层时，隐藏状态栏原始时间 */
const hideTime = computed(() => {
  return system.baseLayer === 'lock' || (recorder.isRecording && system.activeAppId !== 'voicememos')
})

/** 判断是否有灵动岛处于活跃展示状态 */
const hasIsland = computed(() => {
  return system.baseLayer !== 'lock' && !system.anyOverlayOpen() && (activeActivities.value.length > 0 || isMediaActive.value)
})

/** 判断灵动岛是否处于大卡片展开状态 */
const isIslandExpanded = computed(() => {
  return (
    hasIsland.value &&
    Boolean(clockStore.islandExpanded || recorder.islandExpanded || prayerStore.islandExpanded)
  )
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
 * 设计原则（Ricky 2026-09-08）：与下拉控制中心状态行共用 src/utils/statusBarIndicators.js 同一套规则。
 *  1) 给每个状态栏图标定优先级；优先级越高越靠近右侧（越显眼 / 越晚被隐藏）。
 *  2) 原生连接图标（信号/Wi-Fi/电池，来自 <StatusIcons>）视为最高优先级，永远显示、固定在最右。
 *  3) 5 个功能指示器按优先级从右往左排（左=低优先级），整体放在原生图标左侧。
 *  4) 摄像头是 PhoneFrame 里的居中 .punch-hole（常驻挖孔）。当灵动岛胶囊显示时，
 *     灵动岛胶囊为首要障碍物（右边界比打孔更宽）。右簇左缘一旦越过障碍物右边界，
 *     就隐藏「最低优先级」的指示器，确保灵动岛重叠遮挡的图标不再显示。
 * 渲染顺序 = 优先级升序（DOM 左→右 = 低→高），故蓝牙(50)在最右、紧邻原生图标。
 * 隐藏顺序 = 优先级升序（先藏 vibrate，最后才藏蓝牙/DND）。
 * 想调整权重：改 src/utils/statusBarIndicators.js 里的 priority 数字即可（同档可并列）。 */
const activeIndicators = computed(() => orderedIndicators.filter((d) => d.show(control)))

/* 被摄像头/灵动岛空间挤压而隐藏的指示器的 key 集合（空对象=全部显示） */
const hidden = ref({})
/* 原生图标在极度拥挤时的隐藏控制（信号/Wi-Fi） */
const hiddenStatusIcons = ref({ signal: false, wifi: false })
const sbRightRef = ref(null)
const HIDE_MARGIN = 2 // 右缘留的安全间距(px)

/** 障碍物（灵动岛胶囊或居中打孔摄像头）右边界在屏幕坐标系下的 x（含安全间距） */
function obstacleRightEdge() {
  const scr = document.querySelector('.screen')
  // 1. 优先判断是否有灵动岛处于活跃状态：指示器避让的是紧凑胶囊边界（宽124px居中）
  if (hasIsland.value) {
    if (scr) {
      const scrRect = scr.getBoundingClientRect()
      return scrRect.left + scrRect.width / 2 + 62 + HIDE_MARGIN
    }
    const island = document.querySelector('.island-card')
    if (island) {
      const rect = island.getBoundingClientRect()
      // 仅在明确收起态时取实际 right，避免展开态全宽污染测量
      if (!island.classList.contains('is-expanded') && rect.width <= 140 && rect.width > 0) {
        return rect.right + HIDE_MARGIN
      }
    }
    return 272 + HIDE_MARGIN
  }
  // 2. 无灵动岛时以居中摄像头打孔右边界为基准
  const ph = document.querySelector('.punch-hole')
  if (ph) {
    return ph.getBoundingClientRect().right + HIDE_MARGIN
  }
  if (scr) {
    const scrRect = scr.getBoundingClientRect()
    return scrRect.left + scrRect.width / 2 + 7.5 + HIDE_MARGIN
  }
  return null
}

/** 反复测量右簇左缘，越界就隐藏最低优先级指示器，直到不重叠或无可隐藏 */
async function fit() {
  await nextTick()
  const sb = sbRightRef.value
  const cr = obstacleRightEdge()
  if (!sb || cr == null) return
  let guard = 0
  while (guard++ < 20) {
    const left = sb.getBoundingClientRect().left
    if (left >= cr) break // 已不重叠
    const candidates = activeIndicators.value.filter((d) => !hidden.value[d.key])
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.priority - b.priority) // 最低优先级优先隐藏
      hidden.value = { ...hidden.value, [candidates[0].key]: true }
      await nextTick()
      continue
    }
    // 指示器已全部隐藏，若右簇原生图标仍与灵动岛重叠，按优先级隐藏信号与 Wi-Fi
    if (!hiddenStatusIcons.value.signal) {
      hiddenStatusIcons.value = { ...hiddenStatusIcons.value, signal: true }
      await nextTick()
      continue
    }
    if (!hiddenStatusIcons.value.wifi) {
      hiddenStatusIcons.value = { ...hiddenStatusIcons.value, wifi: true }
      await nextTick()
      continue
    }
    break
  }
}

/** 状态变化/尺寸变化时：先全部放开，再重新收敛到「刚好不重叠」 */
function recompute() {
  hidden.value = {}
  hiddenStatusIcons.value = { signal: false, wifi: false }
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

// 任何影响指示器显隐或灵动岛活动状态的变化都重算
watch(
  [
    dndOn,
    () => control.hotspot,
    () => control.soundMode,
    () => control.bluetooth,
    () => control.wifi,
    () => control.cellular,
    () => control.airplane,
    hasIsland,
    () => activeActivities.value.length
  ],
  () => {
    recompute()
    setTimeout(() => recompute(), 100)
  }
)

// 灵动岛展开/收起切换时：展开态状态栏全透；收回胶囊态时彻底刷新避让状态，恢复可用指示器
watch(isIslandExpanded, (expanded) => {
  recompute()
  if (!expanded) {
    setTimeout(() => recompute(), 200)
    setTimeout(() => recompute(), 450)
  }
})
</script>

<template>
  <div
    class="status-bar"
    :class="{ 'island-expanded': isIslandExpanded }"
    :style="{ color: light ? '#fff' : '#000' }"
  >
    <span class="sb-time" :style="{ opacity: hideTime || isIslandExpanded ? 0 : 1 }">{{ timeShort }}</span>
    <div class="sb-right" ref="sbRightRef">
      <!-- 功能指示器：按优先级从右往左排，低优先级在摄像头/灵动岛挤压时先隐藏 -->
      <div class="sb-indicators">
        <LIcon
          v-for="d in orderedIndicators"
          v-show="d.show(control) && !hidden[d.key]"
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
      <StatusIcons
        :color="light ? '#fff' : '#000'"
        :show-signal="!hiddenStatusIcons.signal"
        :show-wifi="!hiddenStatusIcons.wifi"
      />
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
  padding: 6.5px 18px 0;
  z-index: var(--z-status-bar);
  font: 600 15px/1 var(--font-stack);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2px;
  pointer-events: none; /* 热区手势由叠层 edge 元素负责 */
  transition: opacity 0.22s ease;
}
.status-bar.island-expanded {
  opacity: 0;
  pointer-events: none;
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
  gap: 4.5px;
}
.sb-indicators {
  display: flex;
  align-items: center;
  gap: 4.5px;
  flex: 0 0 auto;
}
.sb-ind {
  flex: 0 0 auto;
}
</style>
