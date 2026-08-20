<script setup>
/** 通知品牌图标：按 type 渲染对应应用图标（40px 默认，可调尺寸） */
import { NOTIF_ICONS } from './notifIcons'

const props = defineProps({
  type: { type: String, default: 'default' },
  size: { type: Number, default: 40 }
})

const entry = NOTIF_ICONS[props.type] || NOTIF_ICONS.default
</script>

<template>
  <div
    class="notif-icon"
    :style="{
      width: size + 'px',
      height: size + 'px',
      borderRadius: Math.round(size * 0.3) + 'px',
      background: entry.bg
    }"
    v-html="entry.svg"
  ></div>
</template>

<style scoped>
.notif-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.35), 0 1px 3px rgba(0, 0, 0, 0.15);
}
.notif-icon :deep(svg) {
  width: 62%;
  height: 62%;
}
</style>
