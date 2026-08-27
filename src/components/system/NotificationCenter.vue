<script setup>
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { useSystemStore } from '../../stores/systemStore'
import { useNotificationsStore } from '../../stores/notificationsStore'
import { useClock } from '../../composables/useClock'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { getDriver } from '../../composables/driverRegistry'
import NotificationIcon from '../ui/NotificationIcon.vue'
import { formatRelativeTime } from '../../utils/timeFormat'
import { clamp } from '../../utils/math'
import MusicPlayerCard from './MusicPlayerCard.vue'
import MaterialBlur from '../ui/MaterialBlur.vue'

/**
 * 通知中心（移植自 notificationcenter.tsx）：
 * 深色液态玻璃叠层 + 背景流光、音乐播放器卡片、贯通式通知列表、
 * 物理阻尼堆叠算法（滚动时底部卡片堆叠）、悬浮圆形清除按钮。
 * 叠层手势（下拉打开/上滑关闭）由 ScreenView 与 driver 驱动。
 */
const system = useSystemStore()
const notifications = useNotificationsStore()
const { timeShort, now } = useClock()

const overlay = computed(() => system.overlays.notificationCenter)
const visible = computed(() => overlay.value.status !== 'closed')

const layerStyle = computed(() => {
  const p = overlay.value.progress
  return {
    transform: `translateY(${(p - 1) * 100}%)`,
    visibility: visible.value ? 'visible' : 'hidden',
    pointerEvents: visible.value ? 'auto' : 'none'
  }
})

/** 模糊与暗化随进度插值 */
const blurStyle = computed(() => ({ opacity: clamp(overlay.value.progress * 1.2, 0, 1) }))

/* 打开后面板上滑关闭（驱动与顶部下拉同一 spring） */
const rootRef = ref(null)
const driver = getDriver('notificationCenter')
if (driver) useSwipeGesture(rootRef, driver.closeGesture)

function onNcClick(e) {
  // 点击卡片、播放器、清除按钮等交互元素时不退出
  if (e.target.closest('.nc-card, .ls-player, .nc-clear-fab, .lp-play, button, a, input, label')) {
    return
  }
  system.requestCloseOverlay('notificationCenter')
}

/* ---------- 清除动画 ---------- */
const isClearing = ref(false)
function handleClearAll() {
  if (isClearing.value) return
  isClearing.value = true
  setTimeout(() => {
    notifications.clearAll()
    isClearing.value = false
  }, 800)
}

/* ---------- 物理阻尼堆叠算法（滚动时底部卡片逐张堆叠） ---------- */
const listRef = ref(null)
let rafId = null
function updateStacking() {
  rafId = null
  const container = listRef.value
  if (!container) return
  const containerRect = container.getBoundingClientRect()
  const wrappers = container.querySelectorAll('.nc-item-wrapper')
  const bottomThreshold = containerRect.height - 180
  wrappers.forEach((wrapper) => {
    const rect = wrapper.getBoundingClientRect()
    const card = wrapper.querySelector('.nc-card')
    if (!card) return
    const relativeY = rect.top - containerRect.top
    if (relativeY > bottomThreshold) {
      const excess = relativeY - bottomThreshold
      const stackIndex = excess / 50
      if (stackIndex <= 3.5) {
        const scale = Math.max(0.75, 1 - stackIndex * 0.08)
        let visualY = 0
        if (stackIndex <= 1) visualY = stackIndex * 24
        else if (stackIndex <= 2) visualY = 24 + (stackIndex - 1) * 12
        else visualY = 36 + (stackIndex - 2) * 6
        card.style.transform = `translate3d(0, ${-excess + visualY}px, 0) scale(${scale})`
        card.style.opacity = Math.max(0.4, 1 - stackIndex * 0.2)
        card.style.filter = `brightness(${Math.max(0.7, 1 - stackIndex * 0.25)})`
      } else {
        card.style.transform = `translate3d(0, ${-excess + 50}px, 0) scale(0.7)`
        card.style.opacity = 0
      }
    } else {
      card.style.transform = 'translate3d(0, 0, 0) scale(1)'
      card.style.opacity = 1
      card.style.filter = 'brightness(1)'
    }
  })
}
function onScroll() {
  if (rafId == null) rafId = requestAnimationFrame(updateStacking)
}
watch(() => notifications.list.length, async () => {
  await nextTick()
  updateStacking()
})
onMounted(() => setTimeout(updateStacking, 80))

/* 星期/日期 */
const WEEKDAYS_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const weekday = computed(() => WEEKDAYS_SHORT[now.value.getDay()])
const monthDay = computed(() => `${now.value.getMonth() + 1}月 ${now.value.getDate()}`)

/* 卡片点击展开描述 */
const expandedId = ref(null)
function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}
</script>

<template>
  <div ref="rootRef" class="notification-center" :style="layerStyle" @click="onNcClick">
    <!-- 动态高斯模糊与材质混色底 -->
    <MaterialBlur />

    <div class="nc-content">
      <!-- 时间/日期标题 -->
      <div class="nc-title">
        <span class="nc-title-time">{{ timeShort }}</span>
        <div class="nc-title-date">
          <span>{{ weekday }}</span>
          <span>{{ monthDay }}</span>
        </div>
      </div>

      <!-- 贯通式列表 -->
      <div ref="listRef" class="nc-list scrollable" @scroll.passive="onScroll">
        <!-- 音乐播放器卡片 -->
        <MusicPlayerCard class="nc-player-instance" />

        <!-- 通知列表 -->
        <template v-if="notifications.list.length">
          <div
            v-for="(n, idx) in notifications.list"
            :key="n.id"
            class="nc-item-wrapper"
            :class="{ clearing: isClearing }"
            :style="{ transitionDelay: isClearing ? idx * 40 + 'ms' : '0ms', zIndex: notifications.list.length - idx }"
          >
            <div class="nc-card" :class="{ expanded: expandedId === n.id }" @click="toggleExpand(n.id)">
              <NotificationIcon :type="n.iconType" />
              <div class="nc-card-body">
                <div class="nc-card-head">
                  <span class="nc-card-title">{{ n.title }}</span>
                  <span class="nc-card-time">{{ formatRelativeTime(n.time) }}</span>
                </div>
                <p class="nc-card-desc" :class="{ 'line-clamp-2': expandedId !== n.id }">{{ n.body }}</p>
              </div>
              <svg class="nc-card-chevron" :class="{ flipped: expandedId === n.id }" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
        </template>
        <div v-else class="nc-empty">
          <div class="nc-empty-title">没有更早的通知</div>
        </div>
      </div>
    </div>

    <!-- 悬浮圆形清除按钮 -->
    <button
      v-if="notifications.list.length"
      class="nc-clear-fab"
      title="清除所有通知"
      @click.stop="handleClearAll"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
    </button>
  </div>
</template>

<style scoped>
.notification-center {
  position: absolute;
  inset: 0;
  z-index: var(--z-notification-center);
  overflow: hidden;
  will-change: transform;
  /* background 已经交由底层的 MaterialBlur 组件负责 */
}

.nc-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}
.nc-content > * { pointer-events: auto; }

/* 时间/日期标题 */
.nc-title {
  flex: none;
  display: flex;
  align-items: flex-end;
  padding: calc(var(--safe-top) + 10px) 24px 8px 24px;
  color: #fff;
  z-index: 2;
}
.nc-title-time {
  font: 300 62px/1 var(--font-stack);
  letter-spacing: -2px;
  text-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  font-variant-numeric: tabular-nums;
}
.nc-title-date {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
  padding-bottom: 3px;
  opacity: 0.85;
  font: 500 15px/1.3 var(--font-stack);
}

/* 贯通式列表 */
.nc-list {
  flex: 1;
  margin: 4px 14px 0;
  border-radius: 24px 24px 0 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding-bottom: 130px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.nc-list::-webkit-scrollbar { display: none; }
.nc-list { scrollbar-width: none; }

.nc-player-instance {
  flex: none;
  position: relative;
  z-index: 5;
  margin-bottom: 3px;
}

/* ---- 通知卡片 ---- */
.nc-item-wrapper {
  flex: none;
  transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.5s ease;
  transform-origin: top;
  position: relative;
}
.nc-item-wrapper.clearing {
  transform: translateX(120%);
  opacity: 0;
}
.nc-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: background 0.2s ease;
  transform-origin: top;
}
.nc-card:hover { background: rgba(255, 255, 255, 0.12); }
.nc-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.nc-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.nc-card-title {
  color: #fff;
  font: 600 15px/1.2 var(--font-stack);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nc-card-time { color: rgba(255, 255, 255, 0.55); font: 400 12px/1.2 var(--font-stack); flex: none; }
.nc-card-desc {
  color: rgba(255, 255, 255, 0.72);
  font: 400 14px/1.45 var(--font-stack);
  margin-top: 2px;
}
.nc-card-desc.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.nc-card-chevron {
  flex: none;
  color: rgba(255, 255, 255, 0.5);
  transition: transform 0.3s ease;
}
.nc-card-chevron.flipped { transform: rotate(180deg); }

.nc-empty { flex: 1; display: flex; align-items: center; justify-content: center; }
.nc-empty-title {
  font: var(--text-subhead);
  color: rgba(255, 255, 255, 0.65);
}

/* 悬浮圆形清除按钮 */
.nc-clear-fab {
  position: absolute;
  left: 50%;
  bottom: 42px;
  transform: translateX(-50%);
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease;
  z-index: 60; /* 高于通知卡片的动态 zIndex（20-idx），保证永不被盖住 */
}
.nc-clear-fab:hover { background: rgba(255, 59, 48, 0.5); }
.nc-clear-fab:active { transform: translateX(-50%) scale(0.88); }
</style>
