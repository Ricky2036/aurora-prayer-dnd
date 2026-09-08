<script setup>
import { computed } from 'vue'
import { useClockStore, formatStopwatchTime } from '../../../../stores/clockStore'
import { CLOCK_ICONS } from '../clockIcons'

const emit = defineEmits(['open-subpage'])
const clock = useClockStore()

// 累计总时间格式化
const formattedTotalTime = computed(() => {
  return formatStopwatchTime(clock.stopwatch.elapsedMs)
})

// 当前圈耗时格式化
const formattedCurrentLapTime = computed(() => {
  const previousTotalMs = clock.stopwatch.laps.length > 0 ? clock.stopwatch.laps[0].totalMs : 0
  const currentLapMs = Math.max(0, clock.stopwatch.elapsedMs - previousTotalMs)
  return `+${formatStopwatchTime(currentLapMs)}`
})
</script>

<template>
  <div class="stopwatch-tab">
    <!-- 顶部 Header -->
    <header class="tab-header">
      <h1 class="header-title">秒表</h1>
      <button class="icon-action-btn" title="更多" @click="emit('open-subpage', 'general-settings')">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.moreVert" fill="#fff" />
        </svg>
      </button>
    </header>

    <!-- 顶部大计时数字显示 -->
    <div class="stopwatch-display-area">
      <div class="main-digits">{{ formattedTotalTime }}</div>
      <div class="lap-sub-digits">{{ formattedCurrentLapTime }}</div>
    </div>

    <!-- 计圈列表 -->
    <div class="laps-list-container">
      <div
        v-for="lap in clock.stopwatch.laps"
        :key="lap.id"
        class="lap-row"
      >
        <span class="lap-index">计圈 {{ lap.lapNumber }}</span>
        <span class="lap-duration">+{{ formatStopwatchTime(lap.lapMs) }}</span>
        <span class="lap-total">{{ formatStopwatchTime(lap.totalMs) }}</span>
      </div>
    </div>

    <!-- 底部三键操作栏 -->
    <footer class="stopwatch-control-footer">
      <!-- 左键：复位/重置 -->
      <button
        class="ctrl-round-btn btn-secondary"
        :disabled="clock.stopwatch.status === 'idle' && clock.stopwatch.elapsedMs === 0"
        @click="clock.resetStopwatch()"
      >
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.reset" fill="#fff" />
        </svg>
      </button>

      <!-- 中键：开始 / 暂停 -->
      <button
        class="ctrl-main-btn"
        @click="
          clock.stopwatch.status === 'running'
            ? clock.pauseStopwatch()
            : clock.startStopwatch()
        "
      >
        <svg v-if="clock.stopwatch.status === 'running'" width="30" height="30" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.pause" fill="#fff" />
        </svg>
        <svg v-else width="30" height="30" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.play" fill="#fff" />
        </svg>
      </button>

      <!-- 右键：计圈 -->
      <button
        class="ctrl-round-btn btn-secondary"
        :disabled="clock.stopwatch.status !== 'running'"
        @click="clock.recordLap()"
      >
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.lap" fill="#fff" />
        </svg>
      </button>
    </footer>
  </div>
</template>

<style scoped>
.stopwatch-tab {
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

/* 大数字计时区 */
.stopwatch-display-area {
  padding: 24px 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.main-digits {
  font-size: 60px;
  font-weight: 200;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-variant-numeric: tabular-nums;
  color: #fff;
  letter-spacing: -1px;
}

.lap-sub-digits {
  font-size: 16px;
  color: #8e8e93;
  margin-top: 6px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-variant-numeric: tabular-nums;
}

/* 计圈列表 */
.laps-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px;
}

.lap-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-variant-numeric: tabular-nums;
}

.lap-index {
  font-size: 15px;
  color: #8e8e93;
}

.lap-duration {
  font-size: 15px;
  color: #ff9500;
}

.lap-total {
  font-size: 15px;
  color: #fff;
}

/* 底部操作栏 */
.stopwatch-control-footer {
  height: 150px;
  padding: 0 40px 88px;
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
