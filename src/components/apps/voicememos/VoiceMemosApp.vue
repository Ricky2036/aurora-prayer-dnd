<script setup>
import { computed } from 'vue'
import { useRecorderStore } from '../../../stores/recorderStore'
import { useSystemStore } from '../../../stores/systemStore'

const recorder = useRecorderStore()
const system = useSystemStore()

function toggleRecord() {
  if (recorder.isRecording) {
    recorder.stopRecording()
  } else {
    recorder.startRecording()
  }
}

function togglePause() {
  if (recorder.isPaused) {
    recorder.resumeRecording()
  } else {
    recorder.pauseRecording()
  }
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div class="voicememos-app">
    <!-- 顶部状态与标题栏 -->
    <header class="vm-header">
      <h1 class="vm-title">全部录音</h1>
      <span class="vm-subtitle">Voice Memos</span>
    </header>

    <!-- 主展示区：波形可视化与实时计时 -->
    <main class="vm-main">
      <div class="vm-timer-box">
        <div class="vm-time-display">{{ recorder.formattedTime }}</div>
        <div class="vm-status-tag" :class="{ recording: recorder.isRecording && !recorder.isPaused, paused: recorder.isPaused }">
          <span class="vm-dot"></span>
          <span>{{ !recorder.isRecording ? '准备就绪' : (recorder.isPaused ? '已暂停' : '正在录音') }}</span>
        </div>
      </div>

      <!-- 动态录音频谱波形条 -->
      <div class="vm-visualizer" :class="{ active: recorder.isRecording && !recorder.isPaused }">
        <div class="wave-bar" v-for="i in 28" :key="i" :style="{ animationDelay: `${(i % 7) * 0.12}s` }"></div>
      </div>

      <!-- 历史录音列表（如果有） -->
      <div class="vm-history">
        <div class="vm-history-header" v-if="recorder.recordings.length">历史记录 ({{ recorder.recordings.length }})</div>
        <div class="vm-history-list" v-if="recorder.recordings.length">
          <div class="vm-record-item" v-for="item in recorder.recordings" :key="item.id">
            <div class="vm-item-left">
              <div class="vm-item-title">{{ item.name }}</div>
              <div class="vm-item-meta">{{ item.date }} {{ item.time }}</div>
            </div>
            <div class="vm-item-duration">{{ formatDuration(item.duration) }}</div>
          </div>
        </div>
        <div class="vm-empty-hint" v-else-if="!recorder.isRecording">
          点击下方红色按钮开始录音<br>
          录音中回到桌面可体验灵动岛
        </div>
      </div>
    </main>

    <!-- 底部录音控制面板 -->
    <footer class="vm-footer">
      <div class="vm-controls">
        <!-- 暂停/继续按钮 -->
        <button
          class="vm-sec-btn"
          :class="{ disabled: !recorder.isRecording }"
          :disabled="!recorder.isRecording"
          @click="togglePause"
        >
          <svg v-if="recorder.isPaused" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </button>

        <!-- 主录音/停止按钮 -->
        <button class="vm-main-record-btn" :class="{ 'is-recording': recorder.isRecording }" @click="toggleRecord">
          <div class="vm-record-inner"></div>
        </button>

        <!-- 占位对齐按钮 -->
        <div class="vm-sec-btn-placeholder"></div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.voicememos-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000000;
  color: #ffffff;
  padding-top: var(--safe-top);
  padding-bottom: 72px;
  user-select: none;
  overflow: hidden;
}

.vm-header {
  padding: 16px 24px 8px;
  flex-shrink: 0;
}
.vm-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin: 0;
}
.vm-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
}

.vm-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 20px;
  overflow-y: auto;
}

.vm-timer-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 14px;
}
.vm-time-display {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 52px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
}
.vm-status-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
  padding: 4px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
}
.vm-status-tag.recording {
  color: #ff453a;
  background: rgba(255, 69, 58, 0.15);
}
.vm-status-tag.paused {
  color: #ff9f0a;
  background: rgba(255, 159, 10, 0.15);
}
.vm-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.recording .vm-dot {
  animation: pulseDot 1s infinite alternate;
}
@keyframes pulseDot {
  from { opacity: 0.3; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1.15); }
}

/* 频谱波形 */
.vm-visualizer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 90px;
  margin: 28px 0 20px;
  width: 100%;
}
.wave-bar {
  width: 4px;
  height: 12px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.2);
  transition: height 0.15s ease, background 0.3s ease;
}
.vm-visualizer.active .wave-bar {
  background: #ff453a;
  animation: waveMotion 1.1s ease-in-out infinite alternate;
}
@keyframes waveMotion {
  0% { height: 10px; }
  30% { height: 36px; }
  60% { height: 18px; }
  100% { height: 68px; }
}

/* 历史列表 */
.vm-history {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.vm-history-header {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.vm-history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vm-record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.07);
}
.vm-item-title {
  font-size: 15px;
  font-weight: 500;
}
.vm-item-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}
.vm-item-duration {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
}
.vm-empty-hint {
  text-align: center;
  color: rgba(255, 255, 255, 0.35);
  font-size: 14px;
  line-height: 1.6;
  margin: auto;
  padding: 20px 0;
}

/* 底部操作区 */
.vm-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 14px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.vm-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 280px;
}

.vm-sec-btn, .vm-sec-btn-placeholder {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}
.vm-sec-btn {
  background: rgba(255, 255, 255, 0.12);
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}
.vm-sec-btn.disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.vm-main-record-btn {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 3.5px solid #ffffff;
  background: transparent;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.vm-record-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #ff3b30;
  transition: border-radius 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.vm-main-record-btn.is-recording .vm-record-inner {
  border-radius: 9px;
  transform: scale(0.55);
}
</style>
