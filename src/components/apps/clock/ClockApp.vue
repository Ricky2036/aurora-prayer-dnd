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

const activeTabIndex = computed(() => {
  const idx = TABS.findIndex((t) => t.id === activeTab.value)
  return idx >= 0 ? idx : 0
})

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

    <!-- 底部悬浮导航（带高亮块无缝平滑切换动效） -->
    <nav class="clock-floating-nav">
      <!-- 动态滑动的高亮块底托 -->
      <div
        class="nav-sliding-highlight"
        :style="{
          transform: `translateX(${activeTabIndex * 100}%)`
        }"
      >
        <div class="highlight-pill"></div>
      </div>

      <!-- 5 个 Tab 项 -->
      <div
        v-for="t in TABS"
        :key="t.id"
        class="tab-item"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id"
      >
        <div class="tab-icon-wrap">
          <svg class="tab-icon" width="22" height="22" viewBox="0 0 24 24">
            <path :d="t.icon" :fill="activeTab === t.id ? '#ff9500' : '#ffffff'" />
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

/* 底部悬浮导航 Dock（精准匹配图2设计规范与比例，宽度缩减约20%居中呈现） */
.clock-floating-nav {
  position: absolute;
  bottom: calc(var(--safe-bottom, 20px) + 2px);
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 76px);
  max-width: 295px;
  height: 50px;
  background: rgba(30, 30, 32, 0.92);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border-radius: 25px;
  border: 0.5px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px;
  box-sizing: border-box;
  z-index: 25;
  user-select: none;
}

/* 动态滑动的高亮块容器 */
.nav-sliding-highlight {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc((100% - 6px) / 5);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  /* 高亮块无缝流体切换动效 */
  transition: transform 0.32s cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
}

/* 高亮灰色胶囊底块（参考图2，占满当前Tab单元） */
.highlight-pill {
  width: 100%;
  height: 100%;
  border-radius: 23px;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.1);
}

.tab-item {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: pointer;
  z-index: 2;
  -webkit-tap-highlight-color: transparent;
}

.tab-icon-wrap {
  position: relative;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon {
  position: relative;
  z-index: 2;
  transition: fill 0.2s ease;
}

.tab-label {
  font-size: 9.5px;
  color: #8e8e93;
  font-weight: 500;
  letter-spacing: -0.1px;
  transition: color 0.2s ease;
  margin-top: 1px;
  line-height: 1;
}

.tab-item.active .tab-label {
  color: #ff9500;
  font-weight: 600;
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
