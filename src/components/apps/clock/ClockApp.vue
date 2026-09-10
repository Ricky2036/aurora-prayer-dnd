<script setup>
import { computed, ref, watch } from 'vue'
import { useBackHandler } from '../../../composables/backRegistry'
import { useClockStore } from '../../../stores/clockStore'
import { usePrayerStore } from '../../../stores/prayerStore'
import FloatingTabBar from '../../ui/FloatingTabBar.vue'
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
const prayer = usePrayerStore()

// 当前激活的 Tab（与 store 联动）
const activeTab = computed({
  get: () => clock.activeTab,
  set: (val) => clock.setActiveTab(val)
})

// 二级页面导航栈：null | 'muslim-alarm' | 'general-settings'
const subpage = ref(null)

// 穆斯林闹钟是否开启
const isMuslimAlarmEnabled = computed(() => {
  return Boolean(clock.settings.muslimAlarmEnabled)
})

// 底部悬浮 5-Tab / 4-Tab 规范：在穆斯林闹钟开启后显示穆斯林Tab，关闭后不显示
const tabs = computed(() => {
  const base = [
    { id: 'alarm', name: '闹钟', icon: CLOCK_ICONS.alarm },
    { id: 'worldClock', name: '世界时钟', icon: CLOCK_ICONS.worldClock },
    { id: 'timer', name: '定时器', icon: CLOCK_ICONS.timer },
    { id: 'stopwatch', name: '秒表', icon: CLOCK_ICONS.stopwatch }
  ]
  if (isMuslimAlarmEnabled.value) {
    return [
      base[0],
      { id: 'muslim', name: '穆斯林', icon: CLOCK_ICONS.muslim },
      ...base.slice(1)
    ]
  }
  return base
})

// 监听穆斯林闹钟开关，关闭后若当前处于穆斯林 Tab 则平滑回退到闹钟
watch(isMuslimAlarmEnabled, (enabled) => {
  if (!enabled && activeTab.value === 'muslim') {
    activeTab.value = 'alarm'
  }
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

    <!-- 全局底部悬浮导航控件（像素级对齐录屏 62px 高度与 22px 底边距） -->
    <FloatingTabBar
      v-model="activeTab"
      :tabs="tabs"
      height="62px"
      bottom="22px"
      accent-color="#ff9500"
    />

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
