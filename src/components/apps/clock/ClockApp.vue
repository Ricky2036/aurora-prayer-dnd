<script setup>
import { computed, ref } from 'vue'
import { useBackHandler } from '../../../composables/backRegistry'
import { useClockStore } from '../../../stores/clockStore'
import { CLOCK_ICONS } from './clockIcons'
import AlarmTab from './tabs/AlarmTab.vue'
import MuslimTab from './tabs/MuslimTab.vue'
import WorldClockTab from './tabs/WorldClockTab.vue'
import TimerTab from './tabs/TimerTab.vue'
import StopwatchTab from './tabs/StopwatchTab.vue'
import MuslimAlarmSettings from './subpages/MuslimAlarmSettings.vue'
import ClockGeneralSettings from './subpages/ClockGeneralSettings.vue'

const props = defineProps({
  app: { type: Object, default: () => ({}) }
})

const clock = useClockStore()

// 当前激活的 Tab（与 store 联动）
const activeTab = computed({
  get: () => clock.activeTab,
  set: (val) => clock.setActiveTab(val)
})

// 二级页面导航栈：null | 'muslim-alarm' | 'general-settings'
const subpage = ref(null)

const TABS = [
  { id: 'alarm', name: '闹钟', icon: CLOCK_ICONS.alarm },
  { id: 'muslim', name: '穆斯林', icon: CLOCK_ICONS.muslim },
  { id: 'worldClock', name: '世界时钟', icon: CLOCK_ICONS.worldClock },
  { id: 'timer', name: '定时器', icon: CLOCK_ICONS.timer },
  { id: 'stopwatch', name: '秒表', icon: CLOCK_ICONS.stopwatch }
]

function openSubpage(name) {
  subpage.value = name
}

function closeSubpage() {
  subpage.value = null
}

// 全局侧滑返回注册
useBackHandler(() => {
  if (subpage.value) {
    closeSubpage()
    return true
  }
  return false
})
</script>

<template>
  <div class="clock-app">
    <!-- 主 Tab 容器 -->
    <div class="clock-main-view">
      <AlarmTab
        v-if="activeTab === 'alarm'"
        @open-subpage="openSubpage"
      />
      <MuslimTab
        v-else-if="activeTab === 'muslim'"
        @open-subpage="openSubpage"
      />
      <WorldClockTab
        v-else-if="activeTab === 'worldClock'"
        @open-subpage="openSubpage"
      />
      <TimerTab
        v-else-if="activeTab === 'timer'"
        @open-subpage="openSubpage"
      />
      <StopwatchTab
        v-else-if="activeTab === 'stopwatch'"
        @open-subpage="openSubpage"
      />
    </div>

    <!-- 底部 TabBar（带胶囊药丸高亮选中动效） -->
    <nav class="clock-tab-bar">
      <div
        v-for="t in TABS"
        :key="t.id"
        class="tab-item"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id"
      >
        <div class="tab-pill">
          <svg class="tab-icon" width="22" height="22" viewBox="0 0 24 24">
            <path :d="t.icon" :fill="activeTab === t.id ? '#000' : '#8e8e93'" />
          </svg>
        </div>
        <span class="tab-label">{{ t.name }}</span>
      </div>
    </nav>

    <!-- 二级页面全屏滑入切换 -->
    <Transition name="slide-page">
      <div v-if="subpage" class="subpage-overlay">
        <MuslimAlarmSettings
          v-if="subpage === 'muslim-alarm'"
          @back="closeSubpage"
        />
        <ClockGeneralSettings
          v-else-if="subpage === 'general-settings'"
          @back="closeSubpage"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.clock-app {
  width: 100%;
  height: 100%;
  background: #000000;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;
  padding-top: var(--safe-top, 44px);
  box-sizing: border-box;
}

.clock-main-view {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* 底部 TabBar */
.clock-tab-bar {
  flex: none;
  height: calc(var(--safe-bottom, 24px) + 52px);
  padding-bottom: var(--safe-bottom, 24px);
  padding-top: 4px;
  background: rgba(18, 18, 20, 0.95);
  backdrop-filter: blur(20px);
  border-top: 0.5px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-left: 8px;
  padding-right: 8px;
  box-sizing: border-box;
  flex-shrink: 0;
  z-index: 20;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  flex: 1;
}

.tab-pill {
  width: 44px;
  height: 28px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.tab-item.active .tab-pill {
  background: #ff9500;
}

.tab-label {
  font-size: 11px;
  color: #8e8e93;
  transition: color 0.2s ease;
}

.tab-item.active .tab-label {
  color: #ff9500;
  font-weight: 500;
}

/* 二级页面遮罩与滑入动画 */
.subpage-overlay {
  position: absolute;
  inset: 0;
  background: #000;
  z-index: 50;
}

.slide-page-enter-active,
.slide-page-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-page-enter-from {
  transform: translateX(100%);
}

.slide-page-leave-to {
  transform: translateX(100%);
}
</style>
