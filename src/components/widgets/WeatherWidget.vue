<script setup>
import { useI18nStore } from '../../stores/i18nStore'

/** 天气 Widget（2×2）：支持中/英/孟加拉三语切换 */
const i18n = useI18nStore()
</script>

<template>
  <div class="widget weather-widget">
    <div class="ww-top">
      <div>
        <div class="ww-city">{{ i18n.t('weatherCity') }}</div>
        <div class="ww-temp">31°</div>
      </div>
      <!-- 太阳+云小图标 -->
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="16" cy="14" r="7" fill="#FFD60A" />
        <g stroke="#FFD60A" stroke-width="1.8" stroke-linecap="round">
          <line v-for="i in 8" :key="i" x1="16" y1="2.5" x2="16" y2="5.5"
            :transform="`rotate(${(i - 1) * 45} 16 14)`" />
        </g>
        <path d="M14 30a6 6 0 0 1 .8-11.9A8 8 0 0 1 30 20a5.5 5.5 0 0 1 0 11H14z"
          fill="#fff" opacity="0.92" />
      </svg>
    </div>
    <div class="ww-bottom">
      <div class="ww-condition">{{ i18n.t('weatherCondition') }}</div>
      <div class="ww-range">{{ i18n.locale === 'zh' ? '最高 33° 最低 26°' : i18n.locale === 'en' ? 'H:33° L:26°' : 'সর্বোচ্চ ৩৩° সর্বনিম্ন ২৬°' }}</div>
    </div>
  </div>
</template>

<style scoped>
.widget {
  width: 155px;
  height: 155px;
  border-radius: var(--radius-widget);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  overflow: hidden;
}
.just-unlocked .widget {
  animation: icon-enter 0.5s cubic-bezier(0.25, 0.9, 0.3, 1.2) backwards;
  animation-delay: 60ms;
}
@keyframes icon-enter {
  from { opacity: 0; transform: scale(1.25); }
  to { opacity: 1; transform: scale(1); }
}
.weather-widget {
  background: linear-gradient(160deg, #3a7bd5 0%, #5a5fd0 55%, #7a5fd0 100%);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 13px 14px 12px;
  color: #fff;
}
.ww-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.ww-city {
  font: 500 14px/1.2 var(--font-stack);
}
.ww-temp {
  font: 300 40px/1.1 var(--font-stack);
  letter-spacing: -1px;
}
.ww-condition {
  font: 500 13px/1.3 var(--font-stack);
}
.ww-range {
  font: 400 11px/1.4 var(--font-stack);
  opacity: 0.85;
}
</style>
