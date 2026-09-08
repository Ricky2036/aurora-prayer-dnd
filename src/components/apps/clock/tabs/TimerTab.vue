<script setup>
import { computed } from 'vue'
import { useClockStore, formatTimerSeconds } from '../../../../stores/clockStore'
import { CLOCK_ICONS } from '../clockIcons'

const emit = defineEmits(['open-subpage'])
const clock = useClockStore()

// 滚轮步进控制
function adjustHours(delta) {
  let h = clock.timer.selectedHours + delta
  if (h < 0) h = 23
  if (h > 23) h = 0
  clock.timer.selectedHours = h
}

function adjustMinutes(delta) {
  let m = clock.timer.selectedMinutes + delta
  if (m < 0) m = 59
  if (m > 59) m = 0
  clock.timer.selectedMinutes = m
}

function adjustSeconds(delta) {
  let s = clock.timer.selectedSeconds + delta
  if (s < 0) s = 59
  if (s > 59) s = 0
  clock.timer.selectedSeconds = s
}

// 环形进度计算
const circleRadius = 118
const circleCircumference = 2 * Math.PI * circleRadius
const strokeDashoffset = computed(() => {
  const p = clock.timerProgress
  return circleCircumference * (1 - p)
})

// 倒计时显示文本
const displayCountdownText = computed(() => {
  return formatTimerSeconds(clock.timer.remainingSeconds, true)
})
</script>

<template>
  <div class="timer-tab">
    <!-- 顶部 Header -->
    <header class="tab-header">
      <h1 class="header-title">定时器</h1>
      <div class="header-actions">
        <button class="icon-action-btn" title="添加">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.plus" fill="#fff" />
          </svg>
        </button>
        <button class="icon-action-btn" title="更多" @click="emit('open-subpage', 'general-settings')">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.moreVert" fill="#fff" />
          </svg>
        </button>
      </div>
    </header>

    <!-- 主展示区 -->
    <div class="timer-content">
      <!-- 状态 1：设置态（滚轮选择器 + 预设卡片） -->
      <div v-if="clock.timer.status === 'idle'" class="picker-mode-view">
        <!-- 3列时间滚轮 -->
        <div class="time-wheels-container">
          <!-- 小时 -->
          <div class="wheel-column">
            <span class="wheel-sub-num" @click="adjustHours(1)">
              {{ String((clock.timer.selectedHours + 23) % 24).padStart(2, '0') }}
            </span>
            <div class="wheel-active-row">
              <span class="wheel-main-num">{{ String(clock.timer.selectedHours).padStart(2, '0') }}</span>
              <span class="wheel-unit">时</span>
            </div>
            <span class="wheel-sub-num" @click="adjustHours(-1)">
              {{ String((clock.timer.selectedHours + 1) % 24).padStart(2, '0') }}
            </span>
          </div>

          <!-- 分钟 -->
          <div class="wheel-column">
            <span class="wheel-sub-num" @click="adjustMinutes(1)">
              {{ String((clock.timer.selectedMinutes + 59) % 60).padStart(2, '0') }}
            </span>
            <div class="wheel-active-row">
              <span class="wheel-main-num">{{ String(clock.timer.selectedMinutes).padStart(2, '0') }}</span>
              <span class="wheel-unit">分</span>
            </div>
            <span class="wheel-sub-num" @click="adjustMinutes(-1)">
              {{ String((clock.timer.selectedMinutes + 1) % 60).padStart(2, '0') }}
            </span>
          </div>

          <!-- 秒 -->
          <div class="wheel-column">
            <span class="wheel-sub-num" @click="adjustSeconds(1)">
              {{ String((clock.timer.selectedSeconds + 59) % 60).padStart(2, '0') }}
            </span>
            <div class="wheel-active-row">
              <span class="wheel-main-num">{{ String(clock.timer.selectedSeconds).padStart(2, '0') }}</span>
              <span class="wheel-unit">秒</span>
            </div>
            <span class="wheel-sub-num" @click="adjustSeconds(-1)">
              {{ String((clock.timer.selectedSeconds + 1) % 60).padStart(2, '0') }}
            </span>
          </div>
        </div>

        <!-- 快速预设列表 -->
        <div class="preset-list">
          <div
            v-for="preset in clock.timer.presets"
            :key="preset.id"
            class="preset-item"
            @click="clock.applyTimerPreset(preset)"
          >
            <span class="preset-name">{{ preset.name }}</span>
            <span class="preset-time">{{ formatTimerSeconds(preset.duration) }}</span>
          </div>
        </div>
      </div>

      <!-- 状态 2：运行态（SVG 大圆环进度倒计时） -->
      <div v-else class="running-circle-view">
        <div class="countdown-circle-wrap">
          <svg class="progress-ring" width="280" height="280">
            <!-- 底轨灰圆环 -->
            <circle
              class="ring-bg"
              cx="140"
              cy="140"
              :r="circleRadius"
              fill="transparent"
              stroke="#2c2c2e"
              stroke-width="8"
            />
            <!-- 动态橙色进度圆环 -->
            <circle
              class="ring-progress"
              cx="140"
              cy="140"
              :r="circleRadius"
              fill="transparent"
              stroke="#ff9500"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="circleCircumference"
              :stroke-dashoffset="strokeDashoffset"
            />
          </svg>

          <!-- 中心超大倒计时文字 -->
          <div class="countdown-center-text">
            {{ displayCountdownText }}
          </div>
        </div>
      </div>
    </div>

    <!-- 底部控制按键栏 -->
    <footer class="timer-control-footer">
      <!-- 左键：取消/重置 -->
      <button
        class="ctrl-round-btn btn-secondary"
        :disabled="clock.timer.status === 'idle'"
        @click="clock.cancelTimer()"
      >
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.close" fill="#fff" />
        </svg>
      </button>

      <!-- 中键：主操作（播放/暂停） -->
      <button
        class="ctrl-main-btn"
        @click="
          clock.timer.status === 'running'
            ? clock.pauseTimer()
            : clock.timer.status === 'paused'
            ? clock.resumeTimer()
            : clock.startTimer()
        "
      >
        <svg v-if="clock.timer.status === 'running'" width="30" height="30" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.pause" fill="#fff" />
        </svg>
        <svg v-else width="30" height="30" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.play" fill="#fff" />
        </svg>
      </button>

      <!-- 右键：铃声选择 -->
      <button class="ctrl-round-btn btn-secondary">
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.bell" fill="#fff" />
        </svg>
      </button>
    </footer>
  </div>
</template>

<style scoped>
.timer-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000;
  color: #fff;
  overflow: hidden;
}

.tab-header {
  height: 56px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-action-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.timer-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 20px;
  overflow: hidden;
}

/* 滚轮时间选择器 */
.picker-mode-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

.time-wheels-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  user-select: none;
}

.wheel-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.wheel-sub-num {
  font-size: 22px;
  color: #48484a;
  cursor: pointer;
  padding: 4px;
}

.wheel-active-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.wheel-main-num {
  font-size: 48px;
  font-weight: 300;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
}

.wheel-unit {
  font-size: 16px;
  color: #8e8e93;
}

/* 预设卡片列表 */
.preset-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preset-item {
  padding: 16px 20px;
  background: #1c1c1e;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background 0.15s;
}

.preset-item:active {
  background: #2c2c2e;
}

.preset-name {
  font-size: 16px;
  color: #fff;
}

.preset-time {
  font-size: 15px;
  color: #8e8e93;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
}

/* 环形倒计时展示 */
.running-circle-view {
  display: flex;
  align-items: center;
  justify-content: center;
}

.countdown-circle-wrap {
  position: relative;
  width: 280px;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  transform: rotate(-90deg);
}

.ring-progress {
  transition: stroke-dashoffset 0.25s linear;
}

.countdown-center-text {
  position: absolute;
  font-size: 44px;
  font-weight: 300;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  letter-spacing: -0.5px;
}

/* 底部操作栏 */
.timer-control-footer {
  height: 120px;
  padding: 0 40px 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.ctrl-round-btn {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: none;
  background: #242426;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.2s;
}

.ctrl-round-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.ctrl-main-btn {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: none;
  background: #ff9500;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(255, 149, 0, 0.4);
  transition: transform 0.15s;
}

.ctrl-main-btn:active {
  transform: scale(0.94);
}
</style>
