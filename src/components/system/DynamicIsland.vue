<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { usePrayerStore } from '../../stores/prayerStore'
import { useRecorderStore } from '../../stores/recorderStore'
import { useClockStore } from '../../stores/clockStore'
import { useSystemStore } from '../../stores/systemStore'
import { useI18nStore } from '../../stores/i18nStore'
import { GLYPHS } from '../../assets/icons/glyphs'
import { CLOCK_ICONS } from '../apps/clock/clockIcons'

const prayerStore = usePrayerStore()
const recorderStore = useRecorderStore()
const clockStore = useClockStore()
const system = useSystemStore()
const i18n = useI18nStore()

/* 各独立活动项活跃判断（录音中/计时中/秒表中，且当前不在对应 App 内部） */
const isRecorderActive = computed(() => {
  return recorderStore.isRecording && system.activeAppId !== 'voicememos'
})

const isTimerActive = computed(() => {
  return clockStore.isTimerActive && system.activeAppId !== 'clock'
})

const isStopwatchActive = computed(() => {
  return clockStore.isStopwatchActive && system.activeAppId !== 'clock'
})

const isPrayerActive = computed(() => {
  return Boolean(prayerStore.currentIslandPrayer)
})

/* 是否有任意灵动岛活动 */
const hasAnyIsland = computed(() => {
  return (
    isRecorderActive.value ||
    isTimerActive.value ||
    isStopwatchActive.value ||
    isPrayerActive.value
  )
})

/* 活跃项列表，按优先级排序：Timer > Stopwatch > Recorder > Prayer */
const activeList = computed(() => {
  const list = []
  if (isTimerActive.value) list.push('timer')
  if (isStopwatchActive.value) list.push('stopwatch')
  if (isRecorderActive.value) list.push('recorder')
  if (isPrayerActive.value) list.push('prayer')
  return list
})

/* 主卡片（承载与顶部胶囊连续形变的卡片）与副卡片（多活动时向下展开的卡片） */
const primaryActiveItem = computed(() => activeList.value[0] || null)
const secondaryActiveItem = computed(() => activeList.value[1] || null)

/* 展开态：由各 store 的 islandExpanded 共同驱动 */
const isExpanded = computed({
  get() {
    return (
      (isTimerActive.value || isStopwatchActive.value ? clockStore.islandExpanded : false) ||
      (isRecorderActive.value ? recorderStore.islandExpanded : false) ||
      (isPrayerActive.value ? prayerStore.islandExpanded : false)
    )
  },
  set(val) {
    clockStore.islandExpanded = val
    recorderStore.islandExpanded = val
    prayerStore.islandExpanded = val
  }
})

/* 当切换 App 或退出到桌面时，默认收起至紧凑胶囊态 */
watch(
  [() => system.activeAppId, () => system.baseLayer],
  () => {
    isExpanded.value = false
  }
)

/* 祈祷倒计时轮询 */
let prayerTimer = null
onMounted(() => {
  prayerTimer = setInterval(() => {
    if (prayerStore.currentIslandPrayer) {
      prayerStore.decrementCountdown()
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (prayerTimer) clearInterval(prayerTimer)
})

/* 格式化祈祷倒计时文本 */
const formattedPrayerCountdown = computed(() => {
  const s = prayerStore.islandCountdownSeconds
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

/* 祈祷多语言副标题 */
const prayerSubtitle = computed(() => {
  const prayerId = prayerStore.currentIslandPrayer?.id || 'fajr'
  return i18n.islandSub(prayerId)
})

/* 紧凑胶囊收起态显示的文本 */
const compactCapsuleTime = computed(() => {
  if (isTimerActive.value) return clockStore.formattedTimerIsland
  if (isStopwatchActive.value) return clockStore.formattedStopwatchIsland
  if (isRecorderActive.value) return recorderStore.formattedTime
  if (isPrayerActive.value) return formattedPrayerCountdown.value
  return ''
})

/* 点击主胶囊或展开卡片 */
function handlePrimaryCardClick() {
  if (!isExpanded.value) {
    isExpanded.value = true
  } else {
    // 展开状态下点击卡片主体进入对应 App
    if (primaryActiveItem.value === 'timer') {
      openClockTab('timer')
    } else if (primaryActiveItem.value === 'stopwatch') {
      openClockTab('stopwatch')
    } else if (primaryActiveItem.value === 'recorder') {
      openRecorderApp()
    }
  }
}

/* 点击副卡片 */
function handleSecondaryCardClick() {
  if (secondaryActiveItem.value === 'timer') {
    openClockTab('timer')
  } else if (secondaryActiveItem.value === 'stopwatch') {
    openClockTab('stopwatch')
  } else if (secondaryActiveItem.value === 'recorder') {
    openRecorderApp()
  }
}

/* 点击背景遮罩收起 */
function handleCloseBackdrop() {
  isExpanded.value = false
}

/* 点击时钟卡片跳转进入对应 Tab 并收起 */
function openClockTab(tab) {
  clockStore.setActiveTab(tab)
  system.openApp('clock')
  isExpanded.value = false
}

/* 打开录音机并收起 */
function openRecorderApp() {
  system.openApp('voicememos')
  isExpanded.value = false
}

/* 停止录音 */
function handleStopRecording(e) {
  e.stopPropagation()
  recorderStore.stopRecording()
}

/* 关闭祈祷灵动岛 */
function handleClosePrayer(e) {
  e.stopPropagation()
  prayerStore.closeIsland()
}
</script>

<template>
  <!-- 全局点击空白处收起灵动岛遮罩 -->
  <div
    v-if="hasAnyIsland && isExpanded"
    class="island-backdrop"
    @click="handleCloseBackdrop"
  ></div>

  <!-- 灵动岛主挂载容器 -->
  <div v-if="hasAnyIsland" class="dynamic-island-wrapper">
    <!-- 1. 主灵动岛实体：在 compact 胶囊与 expanded 大圆角矩形之间做连续流体无缝变形 -->
    <div
      class="island-card"
      :class="{
        'is-expanded': isExpanded,
        'is-compact': !isExpanded
      }"
      @click="handlePrimaryCardClick"
    >
      <!-- ================= 1.1 收起态图层（顶部胶囊） ================= -->
      <div class="morph-layer compact-layer">
        <div class="cc-left">
          <svg v-if="isTimerActive" width="13" height="13" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.timer" fill="#ff9500" />
          </svg>
          <svg v-else-if="isStopwatchActive" width="13" height="13" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.stopwatch" fill="#ff9500" />
          </svg>
          <span v-else-if="isRecorderActive" class="rc-mini-wave">
            <i></i><i></i><i></i><i></i><i></i>
          </span>
          <svg v-else-if="isPrayerActive" width="13" height="13" viewBox="0 0 24 24">
            <path :d="GLYPHS.moon" fill="#00C853" />
          </svg>
        </div>

        <div class="cc-camera-slot"></div>

        <div class="cc-right">
          <span class="cc-time">{{ compactCapsuleTime }}</span>
        </div>
      </div>

      <!-- ================= 1.2 展开态图层（80px大圆角矩形） ================= -->
      <div class="morph-layer expanded-layer">
        <!-- 主项：定时器 -->
        <template v-if="primaryActiveItem === 'timer'">
          <div class="ilc-left">
            <div class="ilc-icon-wrap icon-timer">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.timer" fill="#ff9500" />
              </svg>
            </div>
            <div class="ilc-time-col">
              <span class="ilc-main-time">{{ clockStore.formattedTimerIsland }}</span>
              <span class="ilc-sub-label">
                {{ clockStore.timer.status === 'paused' ? '已暂停' : '倒计时' }}
              </span>
            </div>
          </div>

          <div class="ilc-actions">
            <button
              class="ilc-btn btn-cancel"
              @click.stop="clockStore.cancelTimer()"
              title="取消倒计时"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.close" fill="#fff" />
              </svg>
            </button>
            <button
              class="ilc-btn btn-playpause"
              @click.stop="
                clockStore.timer.status === 'running'
                  ? clockStore.pauseTimer()
                  : clockStore.resumeTimer()
              "
              title="暂停/开始"
            >
              <svg
                v-if="clockStore.timer.status === 'running'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
              >
                <path :d="CLOCK_ICONS.pause" fill="#ffffff" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.play" fill="#ffffff" />
              </svg>
            </button>
          </div>
        </template>

        <!-- 主项：秒表 -->
        <template v-else-if="primaryActiveItem === 'stopwatch'">
          <div class="ilc-left">
            <div class="ilc-icon-wrap icon-stopwatch">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.stopwatch" fill="#ff9500" />
              </svg>
            </div>
            <div class="ilc-time-col">
              <span class="ilc-main-time">{{ clockStore.formattedStopwatchIsland }}</span>
              <span class="ilc-sub-label">
                {{ clockStore.stopwatch.status === 'paused' ? '秒表 · 已暂停' : '秒表 · 计时中' }}
              </span>
            </div>
          </div>

          <div class="ilc-actions">
            <button
              v-if="clockStore.stopwatch.status === 'running'"
              class="ilc-btn btn-cancel"
              @click.stop="clockStore.recordLap()"
              title="计次"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.lap" fill="#fff" />
              </svg>
            </button>
            <button
              v-else
              class="ilc-btn btn-cancel"
              @click.stop="clockStore.resetStopwatch()"
              title="重置秒表"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.close" fill="#fff" />
              </svg>
            </button>

            <button
              class="ilc-btn btn-playpause"
              @click.stop="
                clockStore.stopwatch.status === 'running'
                  ? clockStore.pauseStopwatch()
                  : clockStore.startStopwatch()
              "
              title="暂停/开始"
            >
              <svg
                v-if="clockStore.stopwatch.status === 'running'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
              >
                <path :d="CLOCK_ICONS.pause" fill="#ffffff" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.play" fill="#ffffff" />
              </svg>
            </button>
          </div>
        </template>

        <!-- 主项：录音 -->
        <template v-else-if="primaryActiveItem === 'recorder'">
          <div class="ilc-left">
            <div class="ilc-icon-wrap icon-recorder">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ff453a">
                <path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 4v-11l-4 4z"/>
              </svg>
            </div>
            <div class="ilc-time-col">
              <span class="ilc-main-time">{{ recorderStore.formattedTime }}</span>
              <span class="ilc-sub-label">录音中...</span>
            </div>
          </div>

          <div class="ilc-actions">
            <button
              class="ilc-btn btn-stop-record"
              @click.stop="handleStopRecording"
              title="停止录音"
            >
              <div class="btn-stop-square"></div>
            </button>
          </div>
        </template>

        <!-- 主项：礼拜 -->
        <template v-else-if="primaryActiveItem === 'prayer'">
          <div class="ilc-left">
            <div class="ilc-icon-wrap icon-prayer">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path :d="GLYPHS.moon" fill="#00C853" />
              </svg>
            </div>
            <div class="ilc-time-col">
              <span class="ilc-main-time">{{ formattedPrayerCountdown }}</span>
              <span class="ilc-sub-label">{{ prayerSubtitle }}</span>
            </div>
          </div>

          <div class="ilc-actions">
            <button
              class="ilc-btn btn-cancel"
              @click.stop="handleClosePrayer"
              title="关闭"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.close" fill="#fff" />
              </svg>
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- 2. 副灵动岛卡片：当存在多个活动项（如定时器+秒表）时展开平滑滑出，尺寸完全一致为 80px 圆角矩形 -->
    <Transition name="subcard-slide">
      <div
        v-if="isExpanded && secondaryActiveItem"
        class="island-secondary-card"
        @click="handleSecondaryCardClick"
      >
        <!-- 副项：秒表 -->
        <template v-if="secondaryActiveItem === 'stopwatch'">
          <div class="ilc-left">
            <div class="ilc-icon-wrap icon-stopwatch">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.stopwatch" fill="#ff9500" />
              </svg>
            </div>
            <div class="ilc-time-col">
              <span class="ilc-main-time">{{ clockStore.formattedStopwatchIsland }}</span>
              <span class="ilc-sub-label">
                {{ clockStore.stopwatch.status === 'paused' ? '秒表 · 已暂停' : '秒表 · 计时中' }}
              </span>
            </div>
          </div>

          <div class="ilc-actions">
            <button
              v-if="clockStore.stopwatch.status === 'running'"
              class="ilc-btn btn-cancel"
              @click.stop="clockStore.recordLap()"
              title="计次"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.lap" fill="#fff" />
              </svg>
            </button>
            <button
              v-else
              class="ilc-btn btn-cancel"
              @click.stop="clockStore.resetStopwatch()"
              title="重置秒表"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.close" fill="#fff" />
              </svg>
            </button>

            <button
              class="ilc-btn btn-playpause"
              @click.stop="
                clockStore.stopwatch.status === 'running'
                  ? clockStore.pauseStopwatch()
                  : clockStore.startStopwatch()
              "
              title="暂停/开始"
            >
              <svg
                v-if="clockStore.stopwatch.status === 'running'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
              >
                <path :d="CLOCK_ICONS.pause" fill="#ffffff" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.play" fill="#ffffff" />
              </svg>
            </button>
          </div>
        </template>

        <!-- 副项：定时器 -->
        <template v-else-if="secondaryActiveItem === 'timer'">
          <div class="ilc-left">
            <div class="ilc-icon-wrap icon-timer">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.timer" fill="#ff9500" />
              </svg>
            </div>
            <div class="ilc-time-col">
              <span class="ilc-main-time">{{ clockStore.formattedTimerIsland }}</span>
              <span class="ilc-sub-label">
                {{ clockStore.timer.status === 'paused' ? '已暂停' : '倒计时' }}
              </span>
            </div>
          </div>

          <div class="ilc-actions">
            <button
              class="ilc-btn btn-cancel"
              @click.stop="clockStore.cancelTimer()"
              title="取消倒计时"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.close" fill="#fff" />
              </svg>
            </button>
            <button
              class="ilc-btn btn-playpause"
              @click.stop="
                clockStore.timer.status === 'running'
                  ? clockStore.pauseTimer()
                  : clockStore.resumeTimer()
              "
              title="暂停/开始"
            >
              <svg
                v-if="clockStore.timer.status === 'running'"
                width="18"
                height="18"
                viewBox="0 0 24 24"
              >
                <path :d="CLOCK_ICONS.pause" fill="#ffffff" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.play" fill="#ffffff" />
              </svg>
            </button>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 全局透明背景遮罩：点击空白处收回胶囊 */
.island-backdrop {
  position: absolute;
  inset: 0;
  z-index: 96;
  background: transparent;
}

.dynamic-island-wrapper {
  position: absolute;
  top: 7px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 97;
  user-select: none;
  width: calc(var(--screen-w, 360px) - 20px);
  max-width: 358px;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ================= 灵动岛无缝连续形变核心 (Liquid Morphing) ================= */
.island-card {
  position: relative;
  background: #000000;
  color: #ffffff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.48), 0 0 0 0.5px rgba(255, 255, 255, 0.12);
  cursor: pointer;
  overflow: hidden;
  will-change: width, height, border-radius, padding, box-shadow;
  pointer-events: auto;
  /* 苹果级流体弹簧形变过渡曲线：胶囊与80px大圆角矩形同一DOM无缝过渡 */
  transition:
    width 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    height 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    padding 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 0.38s ease;
}

/* 收起态尺寸（紧凑胶囊） */
.island-card.is-compact {
  width: 124px;
  height: 30px;
  border-radius: 15px;
  padding: 0 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 0 0.5px rgba(255, 255, 255, 0.12);
}

.island-card.is-compact:active {
  transform: scale(0.95);
}

/* 展开态尺寸：经典礼拜模式大圆角矩形 (高度80px，圆角22px，大气开阔) */
.island-card.is-expanded {
  width: 100%;
  height: 80px;
  border-radius: 22px;
  padding: 0 16px 0 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.48), 0 0 0 0.5px rgba(255, 255, 255, 0.12);
}

/* 图层绝对定位叠放并无缝渐变 */
.morph-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  will-change: opacity, transform;
}

/* ================= 收起态胶囊图层 ================= */
.compact-layer {
  padding: 0 10px;
  justify-content: space-between;
  transition: opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1), transform 0.38s cubic-bezier(0.32, 0.72, 0, 1);
}
.is-compact .compact-layer {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}
.is-expanded .compact-layer {
  opacity: 0;
  transform: scale(0.8);
  pointer-events: none;
}

.cc-left {
  display: flex;
  align-items: center;
  justify-content: center;
}
.cc-camera-slot {
  width: 18px;
  height: 15px;
  flex: none;
}
.cc-right {
  display: flex;
  align-items: center;
}
.cc-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 12.5px;
  font-weight: 600;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.2px;
}

/* 录音迷你声波 */
.rc-mini-wave {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 14px;
}
.rc-mini-wave i {
  width: 2px;
  height: 6px;
  border-radius: 1px;
  background: #ff453a;
  animation: rcMiniWave 1s ease-in-out infinite alternate;
}
.rc-mini-wave i:nth-child(1) { height: 5px; animation-delay: 0.1s; }
.rc-mini-wave i:nth-child(2) { height: 11px; animation-delay: 0.35s; }
.rc-mini-wave i:nth-child(3) { height: 14px; animation-delay: 0.15s; }
.rc-mini-wave i:nth-child(4) { height: 9px; animation-delay: 0.4s; }
.rc-mini-wave i:nth-child(5) { height: 6px; animation-delay: 0.2s; }

@keyframes rcMiniWave {
  0% { transform: scaleY(0.4); opacity: 0.7; }
  100% { transform: scaleY(1.1); opacity: 1; }
}

/* ================= 展开态主卡片图层 ================= */
.expanded-layer {
  padding: 0 16px 0 18px;
  justify-content: space-between;
  transition: opacity 0.26s cubic-bezier(0.32, 0.72, 0, 1) 0.08s, transform 0.38s cubic-bezier(0.32, 0.72, 0, 1);
}
.is-expanded .expanded-layer {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}
.is-compact .expanded-layer {
  opacity: 0;
  transform: scale(0.85);
  pointer-events: none;
}

/* ================= 展开态副卡片（多活动时独立呈现，尺寸同为主卡片） ================= */
.island-secondary-card {
  margin-top: 10px;
  width: 100%;
  height: 80px;
  border-radius: 22px;
  background: #000000;
  color: #ffffff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.48), 0 0 0 0.5px rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 18px;
  box-sizing: border-box;
  cursor: pointer;
  pointer-events: auto;
}

.island-secondary-card:active {
  filter: brightness(1.12);
}

/* 副卡片平滑滑入滑出过渡 */
.subcard-slide-enter-active {
  transition: opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1) 0.08s, transform 0.36s cubic-bezier(0.32, 0.72, 0, 1) 0.08s;
}
.subcard-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.subcard-slide-enter-from,
.subcard-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.92);
}

/* ================= 展开卡片内部公共视觉规范 ================= */
.ilc-left {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}

/* 44px 圆形图标衬底 */
.ilc-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.icon-timer,
.icon-stopwatch {
  background: rgba(255, 149, 0, 0.16);
}

.icon-prayer {
  background: rgba(0, 200, 83, 0.16);
}

.icon-recorder {
  background: rgba(235, 68, 54, 0.16);
}

.ilc-time-col {
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-left: 14px;
  margin-right: 12px;
  min-width: 0;
}

.ilc-main-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
  letter-spacing: -0.3px;
}

.ilc-sub-label {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 右侧控制按键组 */
.ilc-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

/* 42px 大圆操作按键 */
.ilc-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
  flex: none;
}

.ilc-btn:active {
  transform: scale(0.92);
}

.ilc-btn.btn-cancel {
  background: #333336;
}

.ilc-btn.btn-cancel:hover {
  background: #444448;
}

/* 高亮橙色主控按钮：纯白图标、4px发光投影 */
.ilc-btn.btn-playpause {
  background: #ff9500;
  box-shadow: 0 4px 14px rgba(255, 149, 0, 0.4);
}

.ilc-btn.btn-stop-record {
  background: #eb4436;
  box-shadow: 0 4px 14px rgba(235, 68, 54, 0.4);
}

.btn-stop-square {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: #ffffff;
}
</style>
