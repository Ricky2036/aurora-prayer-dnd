<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
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

/* 是否显示录音灵动岛（录音中且当前不在录音应用内） */
const showRecorderIsland = computed(() => {
  return recorderStore.isRecording && system.activeAppId !== 'voicememos'
})

/* 是否显示时钟灵动岛（定时器或秒表在运行/暂停，且当前不在时钟应用内） */
const showClockIsland = computed(() => {
  return clockStore.hasActiveClockIsland && system.activeAppId !== 'clock'
})

/* 录音灵动岛展开态 */
const isRecorderExpanded = computed(() => recorderStore.islandExpanded)

/* 激活的灵动岛类型：'recorder' | 'clock' | 'prayer' | null */
const activeIslandType = computed(() => {
  if (showRecorderIsland.value) return 'recorder'
  if (showClockIsland.value) return 'clock'
  if (prayerStore.currentIslandPrayer) return 'prayer'
  return null
})

const isExpanded = computed(() => {
  if (activeIslandType.value === 'recorder') return isRecorderExpanded.value
  if (activeIslandType.value === 'clock') return clockStore.islandExpanded
  if (activeIslandType.value === 'prayer') return prayerStore.islandExpanded
  return false
})

/* 祈祷倒计时轮询 */
let timer = null
onMounted(() => {
  timer = setInterval(() => {
    if (prayerStore.currentIslandPrayer) {
      prayerStore.decrementCountdown()
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
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

function handleCardClick() {
  if (activeIslandType.value === 'recorder') {
    if (!recorderStore.islandExpanded) {
      recorderStore.islandExpanded = true
    } else {
      system.openApp('voicememos')
      recorderStore.islandExpanded = false
    }
  } else if (activeIslandType.value === 'clock') {
    if (!clockStore.islandExpanded) {
      clockStore.islandExpanded = true
    } else {
      // 展开态默认返回时钟正在运行的模块
      const targetTab = clockStore.isTimerActive ? 'timer' : 'stopwatch'
      openClockTab(targetTab)
    }
  } else if (activeIslandType.value === 'prayer') {
    if (!prayerStore.islandExpanded) {
      prayerStore.islandExpanded = true
    }
  }
}

function openClockTab(tab) {
  clockStore.setActiveTab(tab)
  system.openApp('clock')
  clockStore.islandExpanded = false
}

function handleCloseBackdrop() {
  if (activeIslandType.value === 'recorder') {
    recorderStore.islandExpanded = false
  } else if (activeIslandType.value === 'clock') {
    clockStore.islandExpanded = false
  } else if (activeIslandType.value === 'prayer') {
    prayerStore.islandExpanded = false
  }
}

function handleStopRecording(e) {
  e.stopPropagation()
  recorderStore.stopRecording()
}

function handleClosePrayer(e) {
  e.stopPropagation()
  prayerStore.closeIsland()
}
</script>

<template>
  <!-- 全局点击空白处收回至胶囊状态遮罩 -->
  <div
    v-if="activeIslandType && isExpanded"
    class="island-backdrop"
    @click="handleCloseBackdrop"
  ></div>

  <!-- 灵动岛无缝形态过渡容器（同一DOM连续缩放与变形） -->
  <div
    v-if="activeIslandType"
    class="dynamic-island-wrapper"
    :class="{ 'type-recorder': activeIslandType === 'recorder' }"
  >
    <div
      class="island-card"
      :class="{
        'is-expanded': isExpanded,
        'is-compact': !isExpanded,
        'recorder-card': activeIslandType === 'recorder',
        'clock-card': activeIslandType === 'clock',
        'clock-multi-card': activeIslandType === 'clock' && clockStore.isTimerActive && clockStore.isStopwatchActive
      }"
      @click="handleCardClick"
    >
      <!-- ================= 1. 收起态内容（胶囊） ================= -->
      <div class="morph-layer compact-layer">
        <!-- 录音胶囊收起态 -->
        <template v-if="activeIslandType === 'recorder'">
          <div class="rc-capsule-left">
            <span class="rc-mini-wave">
              <i></i><i></i><i></i><i></i><i></i>
            </span>
          </div>
          <div class="cc-camera-slot"></div>
          <div class="rc-capsule-right">
            <span class="rc-time">{{ recorderStore.formattedTime }}</span>
          </div>
        </template>

        <!-- 时钟胶囊收起态 -->
        <template v-else-if="activeIslandType === 'clock'">
          <div class="cc-left">
            <svg width="13" height="13" viewBox="0 0 24 24">
              <path
                :d="clockStore.isTimerActive ? CLOCK_ICONS.timer : CLOCK_ICONS.stopwatch"
                fill="#ff9500"
              />
            </svg>
          </div>
          <div class="cc-camera-slot"></div>
          <div class="cc-right">
            <span class="cc-time">
              {{ clockStore.isTimerActive ? clockStore.formattedTimerIsland : clockStore.formattedStopwatchIsland }}
            </span>
          </div>
        </template>

        <!-- 祈祷胶囊收起态 -->
        <template v-else>
          <div class="cc-left">
            <svg width="13" height="13" viewBox="0 0 24 24">
              <path :d="GLYPHS.moon" fill="#00C853" />
            </svg>
          </div>
          <div class="cc-camera-slot"></div>
          <div class="cc-right">
            <span class="cc-time">{{ formattedPrayerCountdown }}</span>
          </div>
        </template>
      </div>

      <!-- ================= 2. 展开态内容：大圆角矩形卡片 ================= -->
      <div class="morph-layer expanded-layer" @click="handleCardClick">
        <!-- 录音大卡片展开态 (完美还原参考截图) -->
        <template v-if="activeIslandType === 'recorder'">
          <!-- 左侧：录音声波频谱柱（橙红主柱 + 白/灰副柱） -->
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

          <!-- 中间：大计时器与副标题 -->
          <div class="rc-expanded-info">
            <div class="rc-expanded-time">{{ recorderStore.formattedTime }}</div>
            <div class="rc-expanded-sub">录音中...</div>
          </div>

          <!-- 右侧：圆形红色停止按钮 (外红底内白圆角方块) -->
          <button class="rc-stop-btn" @click.stop="handleStopRecording" title="停止录音">
            <div class="rc-stop-square"></div>
          </button>
        </template>

        <!-- 时钟流体云卡片展开态 (完全还原时钟灵动岛.mp4) -->
        <template v-else-if="activeIslandType === 'clock'">
          <div class="clock-island-container">
            <!-- 卡片 1: 定时器倒计时 -->
            <div
              v-if="clockStore.isTimerActive"
              class="clock-live-card"
              @click.stop="openClockTab('timer')"
            >
              <div class="clc-left">
                <div class="clc-icon-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path :d="CLOCK_ICONS.timer" fill="#ff9500" />
                  </svg>
                </div>
                <div class="clc-time-col">
                  <span class="clc-main-time">{{ clockStore.formattedTimerIsland }}</span>
                </div>
              </div>

              <div class="clc-actions">
                <button
                  class="clc-btn btn-cancel"
                  @click.stop="clockStore.cancelTimer()"
                  title="取消倒计时"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24">
                    <path :d="CLOCK_ICONS.close" fill="#fff" />
                  </svg>
                </button>
                <button
                  class="clc-btn btn-playpause"
                  @click.stop="
                    clockStore.timer.status === 'running'
                      ? clockStore.pauseTimer()
                      : clockStore.resumeTimer()
                  "
                  title="暂停/开始"
                >
                  <svg
                    v-if="clockStore.timer.status === 'running'"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                  >
                    <path :d="CLOCK_ICONS.pause" fill="#000" />
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24">
                    <path :d="CLOCK_ICONS.play" fill="#000" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 卡片 2: 秒表计时 -->
            <div
              v-if="clockStore.isStopwatchActive"
              class="clock-live-card"
              @click.stop="openClockTab('stopwatch')"
            >
              <div class="clc-left">
                <div class="clc-icon-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path :d="CLOCK_ICONS.stopwatch" fill="#ff9500" />
                  </svg>
                </div>
                <div class="clc-time-col">
                  <span class="clc-main-time">{{ clockStore.formattedStopwatchIsland }}</span>
                  <span class="clc-sub-label">秒表</span>
                </div>
              </div>

              <div class="clc-actions">
                <button
                  class="clc-btn btn-cancel"
                  @click.stop="clockStore.resetStopwatch()"
                  title="重置秒表"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24">
                    <path :d="CLOCK_ICONS.close" fill="#fff" />
                  </svg>
                </button>
                <button
                  class="clc-btn btn-playpause"
                  @click.stop="
                    clockStore.stopwatch.status === 'running'
                      ? clockStore.pauseStopwatch()
                      : clockStore.startStopwatch()
                  "
                  title="暂停/开始"
                >
                  <svg
                    v-if="clockStore.stopwatch.status === 'running'"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                  >
                    <path :d="CLOCK_ICONS.pause" fill="#000" />
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24">
                    <path :d="CLOCK_ICONS.play" fill="#000" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- 祈祷卡片展开态 -->
        <template v-else>
          <!-- 左侧：勿扰月亮图标 -->
          <div class="ic-left-icon">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path :d="GLYPHS.moon" fill="#00C853" />
            </svg>
          </div>

          <!-- 中间：倒计时与辅助文案 -->
          <div class="ic-center-info">
            <div class="ic-time">{{ formattedPrayerCountdown }}</div>
            <div class="ic-sub">{{ prayerSubtitle }}</div>
          </div>

          <!-- 右侧：关闭按钮 -->
          <button class="ic-close-btn" @click.stop="handleClosePrayer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </template>
      </div>
    </div>
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
  /* 苹果级流体弹簧形变过渡曲线 */
  transition:
    width 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    height 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    padding 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 0.38s ease;
}

/* 收起态尺寸 */
.island-card.is-compact {
  width: 124px;
  height: 30px;
  border-radius: 15px;
  padding: 0 10px;
}

/* 展开态尺寸：圆角矩形 */
.island-card.is-expanded {
  width: calc(var(--screen-w, 360px) - 20px);
  max-width: 358px;
  height: 80px;
  border-radius: 22px;
  padding: 0 16px 0 18px;
  cursor: default;
}

/* 图层绝对定位叠放并无缝渐变 */
.morph-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  will-change: opacity, transform;
}

/* ================= 收起态图层 ================= */
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

/* ================= 展开态图层 ================= */
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

/* 左侧图标容器 */
.ic-left-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(0, 200, 83, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

/* 中间文案 */
.ic-center-info {
  flex: 1;
  min-width: 0;
  margin-left: 14px;
  margin-right: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.ic-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 23px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.3px;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.ic-sub {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 右侧关闭按钮 */
.ic-close-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #333336;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
  transition: background 0.15s ease, transform 0.1s ease;
}

.ic-close-btn:hover {
  background: #444448;
}

.ic-close-btn:active {
  transform: scale(0.92);
}

/* ================= 录音灵动岛特殊样式 ================= */

/* 胶囊收起态尺寸 */
.island-card.recorder-card.is-compact {
  width: 122px;
  height: 30px;
  border-radius: 15px;
  padding: 0 10px;
}

/* 胶囊左侧：跳动的红色迷你声波 */
.rc-capsule-left {
  display: flex;
  align-items: center;
  justify-content: center;
}
.rc-mini-wave {
  display: inline-flex;
  align-items: center;
  gap: 2.2px;
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

/* 胶囊右侧：时间 */
.rc-capsule-right {
  display: flex;
  align-items: center;
}
.rc-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.2px;
}

/* 录音展开大卡片尺寸与圆角 (符合截图) */
.island-card.recorder-card.is-expanded {
  width: calc(var(--screen-w, 360px) - 22px);
  max-width: 356px;
  height: 84px;
  border-radius: 26px;
  background: #000000;
  padding: 0 16px 0 18px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65), 0 0 0 0.5px rgba(255, 255, 255, 0.1);
}

/* 展开卡片左侧：声波跳动频谱 */
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
  transition: height 0.1s ease;
}
.rc-audio-bars .bar-1 { height: 16px; animation: rcAudioPulse 1.2s infinite alternate 0.1s; }
.rc-audio-bars .bar-2 { height: 10px; animation: rcAudioPulse 1.2s infinite alternate 0.3s; }
.rc-audio-bars .bar-3 { height: 22px; animation: rcAudioPulse 1.2s infinite alternate 0.15s; }
.rc-audio-bars .bar-main {
  width: 3.5px;
  height: 30px;
  background: #ff5238; /* 截图中主条为醒目的橙红色 */
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

/* 展开卡片中间：大时间与录音中文案 */
.rc-expanded-info {
  flex: 1;
  min-width: 0;
  margin-left: 12px;
  margin-right: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.rc-expanded-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.rc-expanded-sub {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.68);
  margin-top: 3px;
  letter-spacing: -0.1px;
}

/* 展开卡片右侧：红色停止圆形按钮 (截图实景 1:1) */
.rc-stop-btn {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #eb4436; /* 截图同款高亮红色 */
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
  transition: transform 0.12s ease, background 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 4px 14px rgba(235, 68, 54, 0.4);
}
.rc-stop-btn:hover {
  background: #f05244;
  transform: scale(1.04);
}
.rc-stop-btn:active {
  transform: scale(0.92);
}
/* 停止按钮内部白色圆角方形 */
.rc-stop-square {
  width: 17px;
  height: 17px;
  border-radius: 4px;
  background: #ffffff;
}

/* ================= 时钟灵动岛 (完全匹配时钟灵动岛.mp4) ================= */
.island-card.clock-card.is-expanded {
  height: 68px;
  border-radius: 22px;
  padding: 6px;
  background: rgba(18, 18, 20, 0.95);
  backdrop-filter: blur(20px);
}

.island-card.clock-card.clock-multi-card.is-expanded {
  height: 136px;
  border-radius: 24px;
  padding: 6px;
}

.clock-island-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
}

.clock-live-card {
  width: 100%;
  height: 56px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 14px;
  box-sizing: border-box;
  transition: background 0.15s ease;
  cursor: pointer;
}

.clock-live-card:active {
  background: rgba(255, 255, 255, 0.14);
}

.clc-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.clc-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 149, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.clc-time-col {
  display: flex;
  flex-direction: column;
}

.clc-main-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 22px;
  font-weight: 600;
  color: #fff;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  letter-spacing: -0.3px;
}

.clc-sub-label {
  font-size: 11px;
  color: #8e8e93;
}

.clc-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.clc-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: transform 0.1s;
}

.clc-btn:active {
  transform: scale(0.92);
}

.clc-btn.btn-cancel {
  background: #2c2c2e;
}

.clc-btn.btn-cancel:hover {
  background: #3a3a3c;
}

.clc-btn.btn-playpause {
  background: #ff9500;
  box-shadow: 0 2px 8px rgba(255, 149, 0, 0.35);
}
</style>
