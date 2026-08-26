<script setup>
import { computed } from 'vue'
import { usePrayerStore } from '../../stores/prayerStore'
import WeatherWidget from './WeatherWidget.vue'
import PhotoWidget from './PhotoWidget.vue'

const prayerStore = usePrayerStore()
const currentMode = computed(() => prayerStore.userMode)

/* 支持在桌面上点击/轻触直接翻转体验 */
function toggleMode() {
  prayerStore.setUserMode(currentMode.value === 'muslim' ? 'normal' : 'muslim')
}
</script>

<template>
  <div class="smart-suggestion-stack">
    <!-- 1. 翻转动效过程中的浅色半透明磨砂底板（参考 111.mp4） -->
    <div class="stack-tray-backplate"></div>

    <!-- 2. 普通用户：天气卡片 (默认，点击翻转至穆斯林模式) -->
    <div
      class="stack-card weather-card"
      :class="{ active: currentMode === 'normal', exited: currentMode === 'muslim' }"
      @click="toggleMode"
    >
      <WeatherWidget />
    </div>

    <!-- 3. 穆斯林用户：朝拜时段卡片 (点击进入设置-礼拜模式) -->
    <div
      class="stack-card prayer-card"
      :class="{ active: currentMode === 'muslim', exited: currentMode === 'normal' }"
    >
      <PhotoWidget />
    </div>
  </div>
</template>

<style scoped>
.smart-suggestion-stack {
  position: relative;
  width: 155px;
  height: 155px;
  border-radius: var(--radius-widget);
  perspective: 800px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

/* ================= 浅色半透明磨砂玻璃背板 (111.mp4 翻转过程底衬) ================= */
.stack-tray-backplate {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-widget);
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
  border: 0.5px solid rgba(255, 255, 255, 0.35);
  pointer-events: none;
  z-index: 0;
}

/* ================= 卡片 3D 纵向翻转动效（无缩放畸变，严格 1:1 尺寸） ================= */
.stack-card {
  position: absolute;
  inset: 0;
  width: 155px;
  height: 155px;
  border-radius: var(--radius-widget);
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform-origin: 50% 50%;
  transition:
    transform 0.54s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.42s ease,
    filter 0.42s ease;
  will-change: transform, opacity, filter;
}

/* 激活展示态：无任何 translateZ 放大，严格 155x155 原大尺寸 */
.stack-card.active {
  transform: translateY(0) rotateX(0deg) scale(1);
  opacity: 1;
  filter: blur(0);
  pointer-events: auto;
  z-index: 2;
}

/* 天气卡片退场（向上立体翻转） */
.weather-card.exited {
  transform: translateY(-55%) rotateX(55deg) scale(0.9);
  opacity: 0;
  filter: blur(1.5px);
  pointer-events: none;
  z-index: 1;
}

/* 穆斯林朝拜卡片退场（向下方隐藏，等待翻入） */
.prayer-card.exited {
  transform: translateY(55%) rotateX(-55deg) scale(0.9);
  opacity: 0;
  filter: blur(1.5px);
  pointer-events: none;
  z-index: 1;
}
</style>
