<script setup>
import { computed } from 'vue'
import { useSystemStore } from '../../stores/systemStore'
import { runBackHandler } from '../../composables/backRegistry'

/**
 * 经典三键导航栏（Three-Button Navigation Bar）：
 * - 左键 (三条横线 / 菜单 / 多任务)：收起叠层 / 震动反馈
 * - 中键 (空心圆圈 / Home)：直接返回桌面 / 解锁 / 收起叠层
 * - 右键 (三角箭头 / 返回)：返回上级应用页面 / 回桌面 / 收起叠层
 * 悬浮于屏幕最底端，高度匹配 --safe-bottom (34px)，深浅自适应。
 */
const props = defineProps({
  dark: { type: Boolean, default: false }
})

const system = useSystemStore()

const color = computed(() => (props.dark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.9)'))

function onOverview() {
  if (navigator.vibrate) navigator.vibrate(10)
  // 如果当前有叠层打开，收起叠层
  if (system.anyOverlayOpen()) {
    for (const key of ['appLibrary', 'notificationCenter', 'controlCenter']) {
      if (system.overlays[key].status !== 'closed') system.requestCloseOverlay(key)
    }
    return
  }
}

function onHome() {
  if (navigator.vibrate) navigator.vibrate(10)
  // 叠层关闭优先
  if (system.overlays.appLibrary.status !== 'closed') {
    system.requestCloseOverlay('appLibrary')
    return
  }
  if (system.overlays.notificationCenter.status !== 'closed') {
    system.requestCloseOverlay('notificationCenter')
    return
  }
  if (system.overlays.controlCenter.status !== 'closed') {
    system.requestCloseOverlay('controlCenter')
    return
  }
  if (system.baseLayer === 'lock') {
    system.unlock()
    return
  }
  if (system.baseLayer === 'app') {
    system.goHome()
  }
}

function onBack() {
  if (navigator.vibrate) navigator.vibrate(10)
  // 1. 叠层打开时，优先关闭叠层
  if (system.anyOverlayOpen()) {
    for (const key of ['appLibrary', 'notificationCenter', 'controlCenter']) {
      if (system.overlays[key].status !== 'closed') {
        system.requestCloseOverlay(key)
        return
      }
    }
  }
  // 2. 检查应用内部是否有二级页面可以返回（例如信息对话页）
  if (runBackHandler()) {
    return
  }
  // 3. 应用内返回桌面
  if (system.baseLayer === 'app') {
    system.goHome()
    return
  }
  // 4. 锁屏则解锁
  if (system.baseLayer === 'lock') {
    system.unlock()
  }
}
</script>

<template>
  <div class="three-button-nav" :style="{ color: color }">
    <!-- 左键：任务 / 菜单 (三条横线) -->
    <button class="nav-btn" @click.stop="onOverview" title="多任务">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </button>

    <!-- 中键：主屏幕 (空心圆圈) -->
    <button class="nav-btn" @click.stop="onHome" title="主屏幕">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6">
        <circle cx="12" cy="12" r="8" />
      </svg>
    </button>

    <!-- 右键：返回 (向左空心三角) -->
    <button class="nav-btn" @click.stop="onBack" title="返回">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="17 4 7 12 17 20 17 4" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.three-button-nav {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--safe-bottom);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 32px 4px;
  z-index: var(--z-home-indicator);
  pointer-events: auto;
  user-select: none;
}

.nav-btn {
  background: transparent;
  border: none;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  cursor: pointer;
  border-radius: 12px;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

.nav-btn:active {
  transform: scale(0.84);
  opacity: 0.65;
  background: rgba(255, 255, 255, 0.12);
}
</style>
