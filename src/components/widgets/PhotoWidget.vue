<script setup>
import { ref } from 'vue'
import { useSystemStore } from '../../stores/systemStore'
import { usePrayerStore } from '../../stores/prayerStore'
import { useI18nStore } from '../../stores/i18nStore'
import { setLaunchRect } from '../../utils/appIconAnchors'
import { rectRelativeToScreen } from '../../utils/dom'

/**
 * 朝拜勿扰 Widget（2×2）：支持中/英/孟加拉三语切换
 */
const system = useSystemStore()
const prayerStore = usePrayerStore()
const i18n = useI18nStore()
const widgetRef = ref(null)

function handleAction() {
  prayerStore.setTargetView('prayer')
  if (widgetRef.value) {
    const screenEl = document.querySelector('.screen-view')
    if (screenEl) {
      setLaunchRect('settings', rectRelativeToScreen(widgetRef.value, screenEl))
    }
  }
  system.openApp('settings')
}
</script>

<template>
  <div ref="widgetRef" class="widget prayer-widget" @click="handleAction">
    <!-- 背景插画 -->
    <img src="/photo-widget.jpg" alt="Prayer Mosque" class="pw-image" />

    <!-- 文本与交互按钮层 -->
    <div class="pw-content">
      <div class="pw-text-group">
        <div class="pw-title">
          <span>{{ i18n.t('prayerWidgetTitle1') }}</span>
          <span>{{ i18n.t('prayerWidgetTitle2') }}</span>
        </div>
        <div class="pw-subtitle">
          <span>{{ i18n.t('prayerWidgetSub1') }}</span>
          <span>{{ i18n.t('prayerWidgetSub2') }}</span>
        </div>
      </div>

      <button class="pw-button" @click="handleAction">
        {{ i18n.t('prayerWidgetBtn') }}
      </button>
    </div>

    <!-- 内高光/微边框遮罩 -->
    <div class="pw-inner-border"></div>
  </div>
</template>

<style scoped>
.widget {
  width: 155px;
  height: 155px;
  border-radius: var(--radius-widget);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  overflow: hidden;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}
.just-unlocked .widget {
  animation: icon-enter 0.5s cubic-bezier(0.25, 0.9, 0.3, 1.2) backwards;
  animation-delay: 60ms;
}
@keyframes icon-enter {
  from { opacity: 0; transform: scale(1.25); }
  to { opacity: 1; transform: scale(1); }
}

.prayer-widget {
  background: #fdfbf7;
  position: relative;
}

.pw-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 88% center;
  transform: scale(1.16);
  pointer-events: none;
  display: block;
}

.pw-content {
  position: absolute;
  inset: 0;
  padding: 24px 12px 14px 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  z-index: 2;
}

.pw-text-group {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.pw-title {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Noto Sans Bengali", sans-serif;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.16;
  color: #1a1a1a;
  letter-spacing: -0.2px;
  display: flex;
  flex-direction: column;
  max-width: 92px;
  white-space: nowrap;
}

.pw-subtitle {
  margin-top: 7px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Noto Sans Bengali", sans-serif;
  font-size: 8.5px;
  font-weight: 500;
  line-height: 1.32;
  color: #5c626e;
  letter-spacing: -0.1px;
  display: flex;
  flex-direction: column;
  max-width: 92px;
  white-space: nowrap;
}

.pw-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 11px;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 0.5px 1.5px rgba(0, 0, 0, 0.04);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 9.5px;
  font-weight: 700;
  color: #0b5e48;
  border: none;
  cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.pw-button:hover {
  background: #ffffff;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
}

.pw-button:active {
  transform: scale(0.92);
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.pw-inner-border {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-widget);
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  pointer-events: none;
  z-index: 3;
}
</style>
