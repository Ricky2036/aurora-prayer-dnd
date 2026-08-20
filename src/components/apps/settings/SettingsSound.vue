<script setup>
import { ref } from 'vue'
import { useControlStore } from '../../../stores/controlStore'
import { useI18nStore } from '../../../stores/i18nStore'
import AppNavBar from '../../ui/AppNavBar.vue'

const emit = defineEmits(['back', 'open-dnd'])
const control = useControlStore()
const i18n = useI18nStore()

const volumes = ref({
  media: 0.52,
  ring: 0.78,
  notif: 0.85,
  alarm: 0.68
})

function setSoundMode(mode) {
  control.setSoundMode(mode)
}
</script>

<template>
  <div class="settings-sound">
    <!-- 顶部导航栏：左对齐，当前标题 -->
    <AppNavBar :title="i18n.t('soundAndVibration')" @back="emit('back')" />

    <div class="scrollable sound-body">
      <!-- 顶部模式选择卡片（图 1：铃声 / 振动 / 静音 + 勿扰模式入口） -->
      <div class="sound-card">
        <div class="mode-options-row">
          <!-- 铃声 -->
          <div
            class="mode-item"
            :class="{ active: control.soundMode === 'ring' }"
            @click="setSoundMode('ring')"
          >
            <div class="mode-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" :fill="control.soundMode === 'ring' ? '#00C853' : '#636366'" />
              </svg>
            </div>
            <span class="mode-label" :class="{ active: control.soundMode === 'ring' }">{{ i18n.t('soundRing') }}</span>
            <div class="mode-radio" :class="{ active: control.soundMode === 'ring' }">
              <div v-if="control.soundMode === 'ring'" class="radio-dot"></div>
            </div>
          </div>

          <!-- 振动 -->
          <div
            class="mode-item"
            :class="{ active: control.soundMode === 'vibrate' }"
            @click="setSoundMode('vibrate')"
          >
            <div class="mode-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M16 4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H8V6h8v12zM2 9h2v6H2zm20 0h-2v6h2zM0 11h2v2H0zm24 0h-2v2h2z" :fill="control.soundMode === 'vibrate' ? '#00C853' : '#636366'" />
              </svg>
            </div>
            <span class="mode-label" :class="{ active: control.soundMode === 'vibrate' }">{{ i18n.t('soundVibrate') }}</span>
            <div class="mode-radio" :class="{ active: control.soundMode === 'vibrate' }">
              <div v-if="control.soundMode === 'vibrate'" class="radio-dot"></div>
            </div>
          </div>

          <!-- 静音 -->
          <div
            class="mode-item"
            :class="{ active: control.soundMode === 'mute' }"
            @click="setSoundMode('mute')"
          >
            <div class="mode-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M4.34 2.93L2.93 4.34 7.29 8.7 7 9H3v6h4l5 5v-6.59l4.18 4.18c-.65.49-1.38.88-2.18 1.11v2.06c1.34-.3 2.57-.92 3.61-1.75l2.05 2.05 1.41-1.41L4.34 2.93zM10 15.17L7.83 13H5v-2h2.83l.88-.88L10 11.41v3.76zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-4.5-4.03v2.24l2.5 2.5v-.71c0-1.77-1.02-3.29-2.5-4.03z" :fill="control.soundMode === 'mute' ? '#00C853' : '#636366'" />
              </svg>
            </div>
            <span class="mode-label" :class="{ active: control.soundMode === 'mute' }">{{ i18n.t('soundMute') }}</span>
            <div class="mode-radio" :class="{ active: control.soundMode === 'mute' }">
              <div v-if="control.soundMode === 'mute'" class="radio-dot"></div>
            </div>
          </div>
        </div>

        <div class="card-divider"></div>

        <!-- 勿扰模式入口（图 1） -->
        <div class="dnd-entry-row" @click="emit('open-dnd')">
          <span class="der-title">{{ i18n.t('dnd') }}</span>
          <div class="der-right">
            <span class="der-sub">{{ control.doNotDisturb ? i18n.t('dndEnabled') : i18n.t('dndScheduled') }}</span>
            <svg width="8" height="13" viewBox="0 0 8 13">
              <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 音量调节分组（图 1 宽裕呼吸感布局：上方图标标题，下方完整滑块） -->
      <div class="sound-group-header">{{ i18n.t('volumeSection') }}</div>
      <div class="sound-card volume-card">
        <!-- 媒体 -->
        <div class="volume-item">
          <div class="vi-header">
            <svg class="vi-icon" width="20" height="20" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="#636366"/>
            </svg>
            <span class="vi-title">{{ i18n.t('media') }}</span>
          </div>
          <div class="vi-slider-wrap">
            <input
              type="range"
              v-model="volumes.media"
              min="0"
              max="1"
              step="0.01"
              class="custom-slider"
              :style="{ '--val': volumes.media }"
            />
          </div>
        </div>

        <div class="item-divider"></div>

        <!-- 铃声 -->
        <div class="volume-item">
          <div class="vi-header">
            <svg class="vi-icon" width="20" height="20" viewBox="0 0 24 24">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="#636366"/>
            </svg>
            <span class="vi-title">{{ i18n.t('ringtone') }}</span>
          </div>
          <div class="vi-slider-wrap">
            <input
              type="range"
              v-model="volumes.ring"
              min="0"
              max="1"
              step="0.01"
              class="custom-slider"
              :style="{ '--val': volumes.ring }"
            />
          </div>
        </div>

        <div class="item-divider"></div>

        <!-- 通知 -->
        <div class="volume-item">
          <div class="vi-header">
            <svg class="vi-icon" width="20" height="20" viewBox="0 0 24 24">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="#636366"/>
            </svg>
            <span class="vi-title">{{ i18n.t('notificationVolume') }}</span>
          </div>
          <div class="vi-slider-wrap">
            <input
              type="range"
              v-model="volumes.notif"
              min="0"
              max="1"
              step="0.01"
              class="custom-slider"
              :style="{ '--val': volumes.notif }"
            />
          </div>
        </div>

        <div class="item-divider"></div>

        <!-- 闹钟 -->
        <div class="volume-item">
          <div class="vi-header">
            <svg class="vi-icon" width="20" height="20" viewBox="0 0 24 24">
              <path d="M12 4c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm.5-11H11v6l5.25 3.15.75-1.23-4.5-2.67zM22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM7.88 3.39L6.6 1.86 2 5.71l1.29 1.53 4.59-3.85z" fill="#636366"/>
            </svg>
            <span class="vi-title">{{ i18n.t('alarm') }}</span>
          </div>
          <div class="vi-slider-wrap">
            <input
              type="range"
              v-model="volumes.alarm"
              min="0"
              max="1"
              step="0.01"
              class="custom-slider"
              :style="{ '--val': volumes.alarm }"
            />
          </div>
        </div>
      </div>

      <!-- 底部触感反馈卡片（图 1） -->
      <div class="sound-card feedback-card">
        <div class="dnd-entry-row">
          <span class="der-title">{{ i18n.t('haptics') }}</span>
          <div class="der-right">
            <span class="der-sub">{{ i18n.t('hapticsOn') }}</span>
            <svg width="8" height="13" viewBox="0 0 8 13">
              <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 铃声设置提示 -->
      <div class="sound-group-header" style="margin-top: 14px;">{{ i18n.t('ringtoneSettings') }}</div>
    </div>
  </div>
</template>

<style scoped>
.settings-sound {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f2f3f7;
}

.sound-body {
  flex: 1;
  padding: 14px 0 34px;
}

.sound-card {
  margin: 0 16px 14px;
  background: #ffffff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.sound-group-header {
  font-size: 13.5px;
  font-weight: 500;
  color: #8e8e93;
  margin: 18px 22px 8px;
}

/* 顶部模式卡片 */
.mode-options-row {
  display: flex;
  padding: 22px 12px 18px;
}

.mode-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.mode-icon-box {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mode-label {
  font-size: 13.5px;
  font-weight: 500;
  color: #636366;
}

.mode-label.active {
  color: #00C853;
  font-weight: 600;
}

.mode-radio {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.8px solid #c7c7cc;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
  transition: all 0.15s ease;
}

.mode-radio.active {
  border-color: #00C853;
  border-width: 2px;
}

.radio-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #00C853;
}

.card-divider {
  height: 0.5px;
  background: rgba(60, 60, 67, 0.08);
  margin: 0 18px;
}

/* 勿扰模式入口行 */
.dnd-entry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
}

.dnd-entry-row:active {
  background: #f7f7f9;
}

.der-title {
  font-size: 16px;
  font-weight: 500;
  color: #1c1c1e;
}

.der-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.der-sub {
  font-size: 14.5px;
  color: #8e8e93;
}

/* ================= 图 1 音量调节上下两层呼吸感布局 ================= */
.volume-item {
  padding: 16px 20px 18px;
}

.vi-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.vi-icon {
  flex: none;
}

.vi-title {
  font-size: 15.5px;
  font-weight: 500;
  color: #1c1c1e;
}

.vi-slider-wrap {
  width: 100%;
  display: flex;
  align-items: center;
}

.item-divider {
  height: 0.5px;
  background: rgba(60, 60, 67, 0.06);
  margin: 0 20px;
}

/* 鲜绿定制滑块（图 1 样式） */
.custom-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  outline: none;
  background: linear-gradient(
    to right,
    #00C853 0%,
    #00C853 calc(var(--val, 0.5) * 100%),
    #e8eaed calc(var(--val, 0.5) * 100%),
    #e8eaed 100%
  );
  cursor: pointer;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #00C853;
  box-shadow: 0 2px 6px rgba(0, 200, 83, 0.35);
  cursor: pointer;
  transition: transform 0.1s ease;
}

.custom-slider::-webkit-slider-thumb:active {
  transform: scale(1.15);
}

.custom-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #00C853;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 200, 83, 0.35);
  cursor: pointer;
}
</style>
