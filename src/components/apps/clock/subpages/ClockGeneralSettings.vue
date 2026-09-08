<script setup>
import { useClockStore } from '../../../../stores/clockStore'
import ToggleSwitch from '../../../ui/ToggleSwitch.vue'

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
      <h2 class="subpage-title">设置</h2>
      <div class="header-placeholder"></div>
    </header>

    <div class="subpage-content">
      <!-- 提示分组 -->
      <div class="settings-card card-padded">
        <div class="setting-item-column">
          <span class="setting-hint">双时钟设置，请前往设置 > 系统 > 日期与时间进行设置</span>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M1 1L6 6L1 11" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>

      <!-- 闹钟分组 -->
      <div class="section-title">闹钟</div>
      <div class="settings-card">
        <div class="setting-item clickable">
          <span class="setting-label">国家/地区公共假期</span>
          <div class="setting-value-row">
            <span class="setting-value">{{ clock.settings.holidayRegion }}</span>
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#666" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- 定时器分组 -->
      <div class="section-title">定时器</div>
      <div class="settings-card">
        <div class="setting-item">
          <span class="setting-label">定时器运行音</span>
          <ToggleSwitch
            :model-value="clock.settings.timerSound"
            @update:model-value="clock.settings.timerSound = $event"
          />
        </div>
      </div>

      <!-- 秒表分组 -->
      <div class="section-title">秒表</div>
      <div class="settings-card">
        <div class="setting-item">
          <span class="setting-label">秒表运行音</span>
          <ToggleSwitch
            :model-value="clock.settings.stopwatchSound"
            @update:model-value="clock.settings.stopwatchSound = $event"
          />
        </div>
      </div>

      <!-- 关于分组 -->
      <div class="section-title">关于</div>
      <div class="settings-card">
        <div class="setting-item">
          <span class="setting-label">版本</span>
          <span class="setting-value">{{ clock.settings.version }}</span>
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
  padding: 12px 16px 40px;
  overflow-y: auto;
}

.section-title {
  font-size: 13px;
  color: #8e8e93;
  margin: 20px 0 8px 12px;
  letter-spacing: 0.2px;
}

.settings-card {
  background: #1c1c1e;
  border-radius: 16px;
  overflow: hidden;
}

.card-padded {
  padding: 16px;
}

.setting-item-column {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.setting-hint {
  font-size: 14px;
  color: #8e8e93;
  line-height: 1.4;
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
</style>
