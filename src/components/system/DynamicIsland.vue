<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePrayerStore } from '../../stores/prayerStore'
import { useRecorderStore } from '../../stores/recorderStore'
import { useClockStore } from '../../stores/clockStore'
import { useSystemStore } from '../../stores/systemStore'
import { useI18nStore } from '../../stores/i18nStore'
import { useNotificationsStore } from '../../stores/notificationsStore'
import { useControlStore } from '../../stores/controlStore'
import { GLYPHS } from '../../assets/icons/glyphs'
import { CLOCK_ICONS } from '../apps/clock/clockIcons'
import LIcon from '../ui/LIcon.vue'
import MusicPlayerCard from './MusicPlayerCard.vue'
import albumCover from '../../assets/icons/album_cover.png'

const prayerStore = usePrayerStore()
const recorderStore = useRecorderStore()
const clockStore = useClockStore()
const system = useSystemStore()
const i18n = useI18nStore()
const notificationsStore = useNotificationsStore()
const control = useControlStore()
const mediaIslandExpanded = ref(false)

if (typeof window !== 'undefined') {
  window.__clock = clockStore
  window.__prayer = prayerStore
  window.__control = control
}

/* 各独立活动项活跃判断（闹钟/录音中/计时中/秒表中/礼拜/音乐） */
const isAlarmActive = computed(() => {
  return notificationsStore.isIslandEnabled('alarm') && clockStore.isAlarmActive
})

const isRecorderActive = computed(() => {
  return notificationsStore.isIslandEnabled('recorder') && recorderStore.isRecording && system.activeAppId !== 'voicememos'
})

const isTimerActive = computed(() => {
  return notificationsStore.isIslandEnabled('timer') && clockStore.isTimerActive && system.activeAppId !== 'clock'
})

const isStopwatchActive = computed(() => {
  return notificationsStore.isIslandEnabled('stopwatch') && clockStore.isStopwatchActive && system.activeAppId !== 'clock'
})

const isPrayerActive = computed(() => {
  return notificationsStore.isIslandEnabled('prayer') && Boolean(prayerStore.currentIslandPrayer)
})

const isMediaActive = computed(() => {
  return notificationsStore.isIslandEnabled('media') && Boolean(control.mediaActive)
})

/* 是否有任意灵动岛活动 */
const hasAnyIsland = computed(() => {
  return (
    isAlarmActive.value ||
    isRecorderActive.value ||
    isTimerActive.value ||
    isStopwatchActive.value ||
    isPrayerActive.value ||
    isMediaActive.value
  )
})

/* 活跃项列表，按优先级排序：Alarm > Timer > Stopwatch > Recorder > Media > Prayer */
const activeList = computed(() => {
  const list = []
  if (isAlarmActive.value) list.push('alarm')
  if (isTimerActive.value) list.push('timer')
  if (isStopwatchActive.value) list.push('stopwatch')
  if (isRecorderActive.value) list.push('recorder')
  if (isMediaActive.value) list.push('media')
  if (isPrayerActive.value) list.push('prayer')
  return list
})

/* 主卡片与副卡片列表：最多支持 4 项活动同时展示 */
const primaryActiveItem = computed(() => activeList.value[0] || null)
const subActiveItems = computed(() => activeList.value.slice(1, 4))

/* 展开态：由各 store 的 islandExpanded 共同驱动 */
const isExpanded = computed({
  get() {
    return (
      (isAlarmActive.value || isTimerActive.value || isStopwatchActive.value ? clockStore.islandExpanded : false) ||
      (isRecorderActive.value ? recorderStore.islandExpanded : false) ||
      (isPrayerActive.value ? prayerStore.islandExpanded : false) ||
      (isMediaActive.value ? mediaIslandExpanded.value : false)
    )
  },
  set(val) {
    clockStore.islandExpanded = val
    recorderStore.islandExpanded = val
    prayerStore.islandExpanded = val
    mediaIslandExpanded.value = val
  }
})

/* 当切换 App 或退出到桌面时，默认收起至紧凑胶囊态 */
watch(
  [() => system.activeAppId, () => system.baseLayer],
  () => {
    isExpanded.value = false
  }
)

/* 倒计时轮询（祈祷与闹钟由 store 全局托管，通知中心/锁屏展开时不中断） */
onMounted(() => {
  prayerStore.startTicker()
  clockStore.startAlarmTicker()
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
  if (primaryActiveItem.value === 'alarm') {
    if (clockStore.isAlarmSnoozing) {
      return clockStore.formattedSnoozeCountdown
    }
    return clockStore.ringingAlarm?.time || '响铃'
  }
  if (primaryActiveItem.value === 'timer') return clockStore.formattedTimerIsland
  if (primaryActiveItem.value === 'stopwatch') return clockStore.formattedStopwatchIsland
  if (primaryActiveItem.value === 'recorder') return recorderStore.formattedTime
  if (primaryActiveItem.value === 'prayer') return formattedPrayerCountdown.value
  return ''
})

/* 点击卡片主体跳转至对应 App */
function handleCardClick(item) {
  if (item === 'alarm') {
    openClockTab('alarm')
  } else if (item === 'timer') {
    openClockTab('timer')
  } else if (item === 'stopwatch') {
    openClockTab('stopwatch')
  } else if (item === 'recorder') {
    openRecorderApp()
  } else if (item === 'prayer') {
    openClockTab('muslim')
  }
}

/* 点击主胶囊或主卡片 */
function handlePrimaryCardClick() {
  if (!isExpanded.value) {
    isExpanded.value = true
  } else {
    handleCardClick(primaryActiveItem.value)
  }
}

/* 多副卡片平滑入场与出场位移计算，精确对准摄像头孔位 */
function onSubcardBeforeEnter(el) {
  const index = Array.from(el.parentNode?.children || []).indexOf(el)
  const estimatedTop = 90 + Math.max(0, index) * 90
  el.style.setProperty('--fly-up', `${-(estimatedTop + 25)}px`)
}

function onSubcardBeforeLeave(el) {
  const top = el.offsetTop
  el.style.top = `${top}px`
  el.style.setProperty('--fly-up', `${-(top + 25)}px`)
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
        'is-compact': !isExpanded,
        'is-media': isExpanded && primaryActiveItem === 'media'
      }"
      @click="handlePrimaryCardClick"
    >
      <!-- ================= 1.1 收起态图层（顶部胶囊） ================= -->
      <div class="morph-layer compact-layer">
        <div class="cc-left">
          <!-- 闹钟收起态图标 -->
          <svg v-if="primaryActiveItem === 'alarm'" class="compact-alarm-icon" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
            <path :d="CLOCK_ICONS.alarm" />
          </svg>
          <svg v-else-if="primaryActiveItem === 'timer'" width="13" height="13" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.timer" fill="#ff9500" />
          </svg>
          <svg v-else-if="primaryActiveItem === 'stopwatch'" width="13" height="13" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.stopwatch" fill="#ff9500" />
          </svg>
          <span v-else-if="primaryActiveItem === 'recorder'" class="rc-mini-wave">
            <i></i><i></i><i></i><i></i><i></i>
          </span>
          <svg v-else-if="primaryActiveItem === 'prayer'" width="13" height="13" viewBox="0 0 24 24">
            <path :d="GLYPHS.moon" fill="#00C853" />
          </svg>
          <div v-else-if="primaryActiveItem === 'media'" class="media-mini-cover-wrap">
            <img :src="albumCover" class="media-mini-cover" alt="Cover" />
          </div>
        </div>

        <div class="cc-camera-slot"></div>

        <div class="cc-right">
          <span v-if="primaryActiveItem === 'media'" class="media-mini-wave" :class="{ paused: !control.mediaPlaying }">
            <i></i><i></i><i></i><i></i>
          </span>
          <span v-else class="cc-time">{{ compactCapsuleTime }}</span>
        </div>
      </div>

      <!-- ================= 1.2 展开态图层（大圆角矩形） ================= -->
      <div
        class="morph-layer expanded-layer"
        :class="{ 'is-media-layer': primaryActiveItem === 'media' }"
      >
        <!-- 主项：闹钟（对齐 Screenshot_20260909-204420.jpg） -->
        <template v-if="primaryActiveItem === 'alarm'">
          <div class="ilc-left">
            <div class="ilc-icon-wrap icon-alarm" :class="{ 'is-ringing': clockStore.isAlarmRinging }">
              <svg class="alarm-activity-icon" width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
                <path :d="CLOCK_ICONS.alarm" />
              </svg>
            </div>
            <div class="ilc-time-col">
              <span class="ilc-main-time">
                {{ clockStore.isAlarmSnoozing ? clockStore.formattedSnoozeCountdown : (clockStore.ringingAlarm?.time || '20:44') }}
              </span>
              <span class="ilc-sub-label">
                {{ clockStore.isAlarmSnoozing ? '稍后提醒倒计时' : (clockStore.ringingAlarm?.label || '闹钟') }}
              </span>
            </div>
          </div>

          <div class="ilc-actions">
            <!-- 延时按键 (时钟表盘与 zZ) -->
            <button
              class="ilc-btn btn-snooze"
              @click.stop="clockStore.snoozeAlarm()"
              :title="clockStore.isAlarmSnoozing ? '重新延时' : '稍后提醒'"
            >
              <svg class="snooze-activity-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path :d="CLOCK_ICONS.alarm" transform="translate(0 5) scale(.72)" />
                <path d="M13.5 5h3.8l-3.8 4h3.8M17.5 1.5h4l-4 4.5h4" />
              </svg>
            </button>

            <!-- 关闭按键 -->
            <button
              class="ilc-btn btn-dismiss"
              @click.stop="clockStore.dismissAlarm()"
              title="关闭"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </template>

        <!-- 主项：定时器 -->
        <template v-else-if="primaryActiveItem === 'timer'">
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
            <div class="rc-expanded-left">
              <div class="rc-audio-bars">
                <span class="bar bar-1"></span>
                <span class="bar bar-2"></span>
                <span class="bar bar-3"></span>
                <span class="bar bar-main"></span>
                <span class="bar bar-5"></span>
                <span class="bar bar-6"></span>
                <span class="bar bar-7"></span>
              </div>
            </div>
            <div class="ilc-time-col">
              <span class="ilc-main-time">{{ recorderStore.formattedTime }}</span>
              <span class="ilc-sub-label">{{ recorderStore.isPaused ? '录音已暂停' : '正在录音' }}</span>
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

        <!-- 主项：音乐（与通知中心高卡片完全一致的布局） -->
        <template v-else-if="primaryActiveItem === 'media'">
          <MusicPlayerCard :is-island="true" />
        </template>
      </div>
    </div>

    <!-- 2. 副灵动岛卡片列表：支持最多同时展示 4 项，展开时平滑向下滑出，间距 10px -->
    <TransitionGroup
      name="subcard-slide"
      @before-enter="onSubcardBeforeEnter"
      @before-leave="onSubcardBeforeLeave"
    >
      <div
        v-if="isExpanded"
        v-for="item in subActiveItems"
        :key="item"
        class="island-secondary-card"
        :class="{ 'is-media-card': item === 'media' }"
        @click="handleCardClick(item)"
      >
        <!-- 副项：闹钟 -->
        <template v-if="item === 'alarm'">
          <div class="ilc-left">
            <div class="ilc-icon-wrap icon-alarm" :class="{ 'is-ringing': clockStore.isAlarmRinging }">
              <svg class="alarm-activity-icon" width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
                <path :d="CLOCK_ICONS.alarm" />
              </svg>
            </div>
            <div class="ilc-time-col">
              <span class="ilc-main-time">
                {{ clockStore.isAlarmSnoozing ? clockStore.formattedSnoozeCountdown : (clockStore.ringingAlarm?.time || '20:44') }}
              </span>
              <span class="ilc-sub-label">
                {{ clockStore.isAlarmSnoozing ? '稍后提醒倒计时' : (clockStore.ringingAlarm?.label || '闹钟') }}
              </span>
            </div>
          </div>

          <div class="ilc-actions">
            <button
              class="ilc-btn btn-snooze"
              @click.stop="clockStore.snoozeAlarm()"
              :title="clockStore.isAlarmSnoozing ? '重新延时' : '稍后提醒'"
            >
              <svg class="snooze-activity-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path :d="CLOCK_ICONS.alarm" transform="translate(0 5) scale(.72)" />
                <path d="M13.5 5h3.8l-3.8 4h3.8M17.5 1.5h4l-4 4.5h4" />
              </svg>
            </button>

            <button
              class="ilc-btn btn-dismiss"
              @click.stop="clockStore.dismissAlarm()"
              title="关闭"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </template>

        <!-- 副项：秒表 -->
        <template v-else-if="item === 'stopwatch'">
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
        <template v-else-if="item === 'timer'">
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

        <!-- 副项：录音 -->
        <template v-else-if="item === 'recorder'">
          <div class="ilc-left">
            <div class="rc-expanded-left">
              <div class="rc-audio-bars">
                <span class="bar bar-1"></span>
                <span class="bar bar-2"></span>
                <span class="bar bar-3"></span>
                <span class="bar bar-main"></span>
                <span class="bar bar-5"></span>
                <span class="bar bar-6"></span>
                <span class="bar bar-7"></span>
              </div>
            </div>
            <div class="ilc-time-col">
              <span class="ilc-main-time">{{ recorderStore.formattedTime }}</span>
              <span class="ilc-sub-label">{{ recorderStore.isPaused ? '录音已暂停' : '正在录音' }}</span>
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

        <!-- 副项：礼拜 -->
        <template v-else-if="item === 'prayer'">
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

        <!-- 副项：音乐（与通知中心高卡片完全一致的布局） -->
        <template v-else-if="item === 'media'">
          <MusicPlayerCard :is-island="true" />
        </template>
      </div>
    </TransitionGroup>
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

/* 展开态尺寸：经典礼拜模式大圆角矩形 (高度80px，圆角28px) */
.island-card.is-expanded {
  width: 100%;
  height: 80px;
  border-radius: 28px;
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
}
/* 收起态时：等待卡片缩至小尺寸（延迟 0.15s）后才淡入，避免缩小初期内容重叠 */
.is-compact .compact-layer {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
  transition: opacity 0.18s cubic-bezier(0.32, 0.72, 0, 1) 0.15s, transform 0.38s cubic-bezier(0.32, 0.72, 0, 1);
}
/* 展开时：以极快速度淡出（0.10s），立刻让出视野 */
.is-expanded .compact-layer {
  opacity: 0;
  transform: scale(0.85);
  pointer-events: none;
  transition: opacity 0.10s ease-out, transform 0.20s ease-out;
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
  white-space: nowrap;
  overflow: hidden;
}
/* 展开时：延迟 0.12s 待卡片骨架展开到一定宽度后再平滑淡入，避免过窄挤爆换行 */
.is-expanded .expanded-layer {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
  transition: opacity 0.22s cubic-bezier(0.32, 0.72, 0, 1) 0.12s, transform 0.38s cubic-bezier(0.32, 0.72, 0, 1);
}
/* 收起时：立即极速淡出（0.10s），完全杜绝文字挤压与与胶囊重叠的闪烁 */
.is-compact .expanded-layer {
  opacity: 0;
  transform: scale(0.92);
  pointer-events: none;
  transition: opacity 0.10s ease-out, transform 0.22s ease-out;
}

/* ================= 展开态副卡片（多活动时独立呈现，尺寸同为主卡片） ================= */
.island-secondary-card {
  margin-top: 10px;
  width: 100%;
  height: 80px;
  border-radius: 28px;
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
  white-space: nowrap;
  overflow: hidden;
  will-change: transform, opacity, border-radius;
}

.island-secondary-card:active {
  filter: brightness(1.12);
}

/* 副卡片平滑滑入滑出过渡：与主卡片完全同步从摄像头萌发与收回摄像头 */
.subcard-slide-enter-active {
  transform-origin: center center;
  transition:
    transform 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.32s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.38s cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform, opacity, border-radius;
}

.subcard-slide-leave-active {
  position: absolute;
  left: 0;
  width: 100%;
  pointer-events: none;
  transform-origin: center center;
  transition:
    transform 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.05s,
    border-radius 0.38s cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform, opacity, border-radius;
}

/* 萌发与收回位移：动态基于 --fly-up 飞入/飞出摄像头孔，缩放至 124px*30px 胶囊大小 */
.subcard-slide-enter-from,
.subcard-slide-leave-to {
  opacity: 0;
  transform: translateY(var(--fly-up, -115px)) scale(0.36, 0.375);
  border-radius: 15px;
}

.subcard-slide-enter-to,
.subcard-slide-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1, 1);
  border-radius: 28px;
}

/* 副卡片内部元素在收起时立即快速淡出（100ms），绝不闪屏 */
.subcard-slide-leave-active .ilc-left,
.subcard-slide-leave-active .ilc-actions {
  opacity: 0;
  transition: opacity 0.10s ease-out;
}

/* 副卡片内部元素在展开时在卡片展开到一定程度后再淡入（120ms后） */
.subcard-slide-enter-active .ilc-left,
.subcard-slide-enter-active .ilc-actions {
  transition: opacity 0.22s cubic-bezier(0.32, 0.72, 0, 1) 0.12s;
}
.subcard-slide-enter-from .ilc-left,
.subcard-slide-enter-from .ilc-actions {
  opacity: 0;
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

.icon-alarm {
  background: transparent;
}

.compact-alarm-icon,
.alarm-activity-icon {
  fill: #ff9f0a;
}

.snooze-activity-icon {
  fill: #ffffff;
}

.snooze-activity-icon path:last-child {
  fill: none;
  stroke: #ffffff;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon-alarm.is-ringing svg {
  animation: alarmRingWiggle 1.4s ease-in-out infinite;
  transform-origin: center;
}

@keyframes alarmRingWiggle {
  0%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(-10deg) scale(1.05); }
  20% { transform: rotate(10deg) scale(1.05); }
  30% { transform: rotate(-8deg) scale(1.03); }
  40% { transform: rotate(8deg) scale(1.03); }
  50% { transform: rotate(-3deg); }
  60% { transform: rotate(3deg); }
  70% { transform: rotate(0deg); }
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

/* 展开卡片左侧：声波跳动频谱（与录音原版设计及通知栏完全统一） */
.rc-expanded-left {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 44px;
  height: 44px;
}

.rc-audio-bars {
  display: flex;
  align-items: center;
  gap: 3.5px;
  height: 32px;
}

.rc-audio-bars .bar {
  display: inline-block;
  width: 3px;
  border-radius: 1.5px;
  background: #ffffff;
}

.rc-audio-bars .bar-1 { height: 16px; animation: rcAudioPulse 1.2s infinite alternate 0.1s; }
.rc-audio-bars .bar-2 { height: 10px; animation: rcAudioPulse 1.2s infinite alternate 0.3s; }
.rc-audio-bars .bar-3 { height: 22px; animation: rcAudioPulse 1.2s infinite alternate 0.15s; }
.rc-audio-bars .bar-main {
  width: 3.5px;
  height: 30px;
  background: #ff5238;
  animation: rcAudioPulseMain 0.9s infinite alternate 0.05s;
}
.rc-audio-bars .bar-5 { height: 12px; animation: rcAudioPulse 1.2s infinite alternate 0.4s; }
.rc-audio-bars .bar-6 { height: 6px; animation: rcAudioPulse 1.2s infinite alternate 0.2s; }
.rc-audio-bars .bar-7 { height: 4px; animation: rcAudioPulse 1.2s infinite alternate 0.5s; }

@keyframes rcAudioPulse {
  0% { transform: scaleY(0.45); opacity: 0.6; }
  100% { transform: scaleY(1.15); opacity: 1; }
}

@keyframes rcAudioPulseMain {
  0% { transform: scaleY(0.5); }
  100% { transform: scaleY(1.1); }
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

.ilc-btn.btn-cancel,
.ilc-btn.btn-snooze,
.ilc-btn.btn-dismiss {
  background: #333336;
}

.ilc-btn.btn-cancel:hover,
.ilc-btn.btn-snooze:hover,
.ilc-btn.btn-dismiss:hover {
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

/* 微型音乐胶囊图层 */
.media-mini-cover-wrap {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  overflow: hidden;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.media-mini-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.08);
}
.media-mini-wave {
  display: flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 12px;
  width: 14px;
}
.media-mini-wave i {
  width: 2px;
  background: #30d158;
  border-radius: 999px;
  animation: miniWave 0.8s ease-in-out infinite;
}
.media-mini-wave i:nth-child(2) { animation-duration: 0.9s; animation-delay: 0.2s; }
.media-mini-wave i:nth-child(3) { animation-duration: 0.7s; animation-delay: 0.4s; }
.media-mini-wave i:nth-child(4) { animation-duration: 1.0s; animation-delay: 0.1s; }
.media-mini-wave.paused i {
  animation-play-state: paused;
  height: 3px !important;
}

@keyframes miniWave {
  0%, 100% { height: 25%; opacity: 0.8; }
  50% { height: 100%; opacity: 1; }
}

/* 展开态主卡片：音乐使用与通知中心完全一致的较高卡片尺寸 (164px, 32px 圆角) */
.island-card.is-expanded.is-media {
  height: 164px;
  border-radius: 32px;
}

/* 展开态主卡片音乐图层 */
.expanded-layer.is-media-layer {
  display: block;
  padding: 16px;
  white-space: normal;
}

/* 展开态副卡片：若为音乐，高度同样为 164px，圆角 32px */
.island-secondary-card.is-media-card {
  height: 164px;
  border-radius: 32px;
  padding: 16px;
  display: block;
  white-space: normal;
}
</style>
