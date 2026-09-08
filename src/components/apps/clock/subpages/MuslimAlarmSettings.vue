<script setup>
import { useClockStore } from '../../../../stores/clockStore'
import ToggleSwitch from '../../../ui/ToggleSwitch.vue'
import ListCell from '../../../ui/ListCell.vue'

const emit = defineEmits(['back'])
const clock = useClockStore()
</script>

<template>
  <div class="subpage-container">
    <header class="subpage-header">
      <button class="back-btn" @click="emit('back')">
        <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
          <path d="M9 1L1 9L9 17" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <h2 class="subpage-title">穆斯林闹钟</h2>
      <div class="header-placeholder"></div>
    </header>

    <div class="subpage-content">
      <div class="settings-card">
        <!-- 主开关 -->
        <div class="setting-item">
          <span class="setting-label">穆斯林闹钟</span>
          <ToggleSwitch
            :model-value="clock.settings.muslimAlarmEnabled"
            @update:model-value="clock.settings.muslimAlarmEnabled = $event"
          />
        </div>

        <div class="divider"></div>

        <!-- 计算方法 -->
        <div class="setting-item clickable">
          <span class="setting-label">计算方法</span>
          <div class="setting-value-row">
            <span class="setting-value">{{ clock.settings.calcMethod }}</span>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <div class="divider"></div>

        <!-- 哺乳时间法 -->
        <div class="setting-item clickable">
          <span class="setting-label">哺乳时间法</span>
          <div class="setting-value-row">
            <span class="setting-value">{{ clock.settings.prayerTimeMethod }}</span>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <div class="divider"></div>

        <!-- 调整斋月日期 -->
        <div class="setting-item clickable">
          <span class="setting-label">调整斋月日期</span>
          <div class="setting-value-row">
            <span class="setting-value">{{ clock.settings.ramadanAdjustDays }} 天</span>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <div class="divider"></div>

        <!-- 铃声 -->
        <div class="setting-item clickable">
          <span class="setting-label">铃声</span>
          <div class="setting-value-row">
            <span class="setting-value">{{ clock.settings.ringtone }}</span>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subpage-container {
  height: 100%;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
  padding-top: var(--safe-top, 44px);
  box-sizing: border-box;
}

:deep(.toggle-switch.on) {
  background: #ff9500 !important;
}
:deep(.toggle-switch) {
  background: #38383a;
}

.subpage-header {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #000;
}

.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
}

.subpage-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.header-placeholder {
  width: 36px;
}

.subpage-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.settings-card {
  background: #1c1c1e;
  border-radius: 16px;
  overflow: hidden;
}

.setting-item {
  min-height: 56px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.setting-item.clickable:active {
  background: rgba(255, 255, 255, 0.05);
}

.setting-label {
  font-size: 16px;
  color: #fff;
}

.setting-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-value {
  font-size: 14px;
  color: #8e8e93;
}

.divider {
  height: 0.5px;
  background: rgba(255, 255, 255, 0.08);
  margin-left: 16px;
}
</style>
