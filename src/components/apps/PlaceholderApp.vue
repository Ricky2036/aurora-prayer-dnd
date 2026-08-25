<script setup>
import { computed } from 'vue'
import { GLYPHS } from '../../assets/icons/glyphs'
import { useClock } from '../../composables/useClock'
import { useI18nStore } from '../../stores/i18nStore'

/** 占位应用通用件：大图标 + 名称 + 占位说明 */
const props = defineProps({
  app: { type: Object, required: true }
})

const i18n = useI18nStore()
const { today, hourDeg, minuteDeg, secondDeg } = useClock()
const weekday = computed(() => i18n.calWeekDays[new Date().getDay()] || '周日')
const displayName = computed(() => i18n.appName(props.app.id) || props.app.name)

const resolvedImage = computed(() => {
  if (!props.app.image) return null
  if (props.app.image.startsWith('http') || props.app.image.startsWith('data:')) return props.app.image
  const clean = props.app.image.replace(/^\/+/, '')
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/'
  return `${base}${clean}`
})
</script>

<template>
  <div class="placeholder-app">
    <div class="pa-icon squircle-mask" :style="{ background: app.special === 'clock' ? '#1c1c1e' : (app.special === 'calendar' ? 'linear-gradient(180deg, #ffffff 0%, #f6f6f8 100%)' : (app.gradient || (app.image ? '#fff' : 'linear-gradient(180deg,#c7c7cc,#8e8e93)'))) }">
      <img v-if="app.image" :src="resolvedImage" alt="" :style="{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.02)' }" />
      <svg v-else-if="app.glyph" width="44" height="44" viewBox="0 0 24 24">
        <path :d="GLYPHS[app.glyph]" :fill="app.glyphColor || '#fff'" />
      </svg>
      <!-- 日历 -->
      <div v-else-if="app.special === 'calendar'" class="pa-cal-inner">
        <span class="pa-cal-weekday">{{ weekday }}</span>
        <span class="pa-cal-date">{{ today.date }}</span>
      </div>
      <!-- 时钟 -->
      <svg v-else-if="app.special === 'clock'" width="46" height="46" viewBox="0 0 46 46" style="transform: scale(1.6)">
        <circle cx="23" cy="23" r="21" fill="#1c1c1e"/>
        <circle cx="23" cy="23" r="19.5" fill="#fff"/>
        <g stroke="#3a3a3c" stroke-width="1.4">
          <line v-for="i in 12" :key="i" x1="23" y1="5" x2="23" y2="8"
            :transform="`rotate(${(i - 1) * 30} 23 23)`" />
        </g>
        <line x1="23" y1="23" x2="23" y2="13" stroke="#1c1c1e" stroke-width="3" stroke-linecap="round"
          :transform="`rotate(${hourDeg} 23 23)`" />
        <line x1="23" y1="23" x2="23" y2="8" stroke="#1c1c1e" stroke-width="2" stroke-linecap="round"
          :transform="`rotate(${minuteDeg} 23 23)`" />
        <line x1="23" y1="25" x2="23" y2="7" stroke="#FF9500" stroke-width="1" stroke-linecap="round"
          :transform="`rotate(${secondDeg} 23 23)`" />
        <circle cx="23" cy="23" r="1.6" fill="#1c1c1e"/>
      </svg>
      <span v-else class="pa-icon-text">{{ displayName.slice(0, 1) }}</span>
    </div>
    <div class="pa-name">{{ displayName }}</div>
    <div class="pa-note">{{ i18n.locale === 'zh' ? '该应用为演示占位页' : i18n.locale === 'en' ? 'Demo Placeholder App' : 'ডেমো প্লেসহোল্ডার অ্যাপ' }}<br />{{ i18n.locale === 'zh' ? '底部上滑或点击横条返回桌面' : i18n.locale === 'en' ? 'Swipe up from bottom to return home' : 'ফিরে যেতে নিচে থেকে সোয়াইপ করুন' }}</div>
  </div>
</template>

<style scoped>
.placeholder-app {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: var(--bg-grouped);
  padding-top: var(--safe-top);
  padding-bottom: 80px;
}
.pa-icon {
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
}
.squircle-mask {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 50 0 L 72 0 C 86 0 100 14 100 28 L 100 72 C 100 86 86 100 72 100 L 28 100 C 14 100 0 86 0 72 L 0 28 C 0 14 14 0 28 0 Z' fill='black'/%3E%3C/svg%3E");
  -webkit-mask-size: 100% 100%;
  mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 50 0 L 72 0 C 86 0 100 14 100 28 L 100 72 C 100 86 86 100 72 100 L 28 100 C 14 100 0 86 0 72 L 0 28 C 0 14 14 0 28 0 Z' fill='black'/%3E%3C/svg%3E");
  mask-size: 100% 100%;
}
.pa-icon-text {
  color: #fff;
  font: 600 40px/1 var(--font-stack);
}
.pa-name {
  font: var(--text-title-3);
  color: var(--label);
}
.pa-note {
  font: var(--text-footnote);
  color: var(--label-secondary);
  text-align: center;
  line-height: 1.7;
}
.pa-cal-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}
.pa-cal-weekday {
  font: 600 16px/1 var(--font-stack);
  color: var(--ios-red);
  letter-spacing: 0.5px;
  margin-top: 11px;
}
.pa-cal-date {
  font: 300 48px/1.1 var(--font-stack);
  color: #1c1c1e;
  font-variant-numeric: tabular-nums;
}
</style>
