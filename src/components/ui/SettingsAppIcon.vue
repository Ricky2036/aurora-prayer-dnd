<script setup>
/** 设置页应用图标（40/64 两档，沿用 settingsprototype.tsx 视觉） */
import { computed } from 'vue'
import { SETTING_ICONS } from './settingIcons'

const props = defineProps({
  type: { type: String, default: 'transsioner' },
  size: { type: Number, default: 40 }
})

const gid = 'spg' + Math.random().toString(36).slice(2, 8)
const entry = computed(() => SETTING_ICONS[props.type] || SETTING_ICONS.transsioner)
const svgSize = computed(() => Math.round(props.size * entry.value.scale))
const radius = computed(() => Math.round(props.size * 0.28))
</script>

<template>
  <div
    class="s-icon"
    :style="{
      width: size + 'px',
      height: size + 'px',
      borderRadius: radius + 'px',
      background: entry.bg
    }"
  >
    <!-- map 需要动态渐变 id（多实例不冲突） -->
    <svg v-if="type === 'map'" viewBox="0 0 24 24" :width="svgSize" :height="svgSize">
      <defs>
        <linearGradient :id="gid" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#EA4335" />
          <stop offset="40%" stop-color="#FBBC05" />
          <stop offset="70%" stop-color="#34A853" />
          <stop offset="100%" stop-color="#4285F4" />
        </linearGradient>
      </defs>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" :fill="`url(#${gid})`" />
      <circle cx="12" cy="9" r="3.5" fill="white"></circle>
    </svg>
    <div v-else-if="entry.svg" v-html="entry.svg"></div>
  </div>
</template>

<style scoped>
.s-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  overflow: hidden;
  border: 0.7px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.s-icon :deep(svg) {
  display: block;
  width: auto;
  height: auto;
}
</style>
