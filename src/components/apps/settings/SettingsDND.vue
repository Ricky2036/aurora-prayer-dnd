<script setup>
import { useControlStore } from '../../../stores/controlStore'
import { usePrayerStore } from '../../../stores/prayerStore'
import { useI18nStore } from '../../../stores/i18nStore'
import AppNavBar from '../../ui/AppNavBar.vue'
import ToggleSwitch from '../../ui/ToggleSwitch.vue'

const emit = defineEmits(['back'])
const control = useControlStore()
const prayerStore = usePrayerStore()
const i18n = useI18nStore()
</script>

<template>
  <div class="settings-dnd">
    <AppNavBar :title="i18n.t('dnd')" @back="emit('back')" />

    <div class="scrollable dnd-body">
      <!-- 顶部勿扰与定时开关卡片 -->
      <div class="dnd-card">
        <!-- 勿扰模式开关 -->
        <div class="dnd-cell">
          <span class="dc-title">{{ i18n.t('dnd') }}</span>
          <div class="dc-right">
            <ToggleSwitch v-model="control.doNotDisturb" />
          </div>
        </div>

        <!-- 定时开启 -->
        <div class="dnd-cell clickable no-sep">
          <span class="dc-title">{{ i18n.t('dndScheduled') }}</span>
          <div class="dc-right">
            <span class="dc-val">22:00 - 07:00</span>
            <svg width="8" height="13" viewBox="0 0 8 13">
              <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 允许打扰分组（图 2） -->
      <div class="dnd-group-header">{{ i18n.t('allowDisturb') }}</div>
      <div class="dnd-card">
        <!-- 来电提醒 -->
        <div class="dnd-cell clickable">
          <div class="dc-main-col">
            <span class="dc-title">{{ i18n.t('allowCalls') }}</span>
            <span class="dc-sub">{{ i18n.t('allowCallsSub') }}</span>
          </div>
          <div class="dc-right">
            <svg width="8" height="13" viewBox="0 0 8 13">
              <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
        </div>

        <!-- 应用提醒 -->
        <div class="dnd-cell clickable">
          <div class="dc-main-col">
            <span class="dc-title">{{ i18n.t('allowApps') }}</span>
            <span class="dc-sub">{{ i18n.t('allowAppsSub') }}</span>
          </div>
          <div class="dc-right">
            <svg width="8" height="13" viewBox="0 0 8 13">
              <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
        </div>

        <!-- 允许显示重复来电者 -->
        <div class="dnd-cell no-sep" style="align-items: flex-start;">
          <div class="dc-main-col" style="padding: 2px 0;">
            <span class="dc-title">{{ i18n.t('allowRepeatedCalls') }}</span>
            <span class="dc-sub" style="margin-top: 4px; color: #8e8e93; font-size: 13px;">
              {{ i18n.t('allowRepeatedCallsDesc') }}
            </span>
          </div>
          <div class="dc-right" style="margin-top: 4px;">
            <ToggleSwitch v-model="prayerStore.allowRepeatedCalls" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-dnd {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #F2F2F7;
}

.dnd-body {
  flex: 1;
  padding: 16px 0 34px;
}

.dnd-card {
  margin: 0 16px 18px;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.dnd-group-header {
  font-size: 13px;
  font-weight: 500;
  color: #8e8e93;
  margin: 20px 22px 8px;
}

.dnd-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 16px;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.08);
}

.dnd-cell.no-sep {
  border-bottom: none;
}

.dnd-cell.clickable {
  cursor: pointer;
}

.dnd-cell.clickable:active {
  background: #f2f2f7;
}

.dc-title {
  font-size: 15.5px;
  font-weight: 500;
  color: #1c1c1e;
}

.dc-main-col {
  display: flex;
  flex-direction: column;
}

.dc-sub {
  font-size: 13.5px;
  color: #8e8e93;
  margin-top: 2px;
}

.dc-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dc-val {
  font-size: 14.5px;
  color: #8e8e93;
}

.dc-val.is-active {
  color: #00C853;
  font-weight: 500;
}
</style>
