<script setup>
/** 通知品牌图标：按 type 渲染对应应用图标（40px 默认，可调尺寸） */
import { computed } from 'vue'
import { NOTIF_ICONS } from './notifIcons'

const props = defineProps({
  type: { type: String, default: 'default' },
  size: { type: Number, default: 40 }
})

/* 必须是 computed：在 setup 顶层直接取 NOTIF_ICONS[props.type] 只会求值一次，
   type 变化时图标不更新（通知列表切换分类时会停留在旧图标） */
const entry = computed(() => NOTIF_ICONS[props.type] || NOTIF_ICONS.default)
</script>

<template>
  <div
    class="notif-icon"
    :class="{ 'is-img': !!entry.image }"
    :style="{
      width: size + 'px',
      height: size + 'px',
      borderRadius: Math.round(size * 0.24) + 'px',
      background: entry.image ? 'transparent' : entry.bg
    }"
  >
    <img
      v-if="entry.image"
      :src="entry.image"
      class="notif-icon-img"
      :alt="type"
      loading="lazy"
      draggable="false"
    />
    <div v-else-if="entry.svg" class="notif-icon-svg" v-html="entry.svg"></div>
  </div>
</template>

<style scoped>
.notif-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  overflow: hidden;
  box-shadow: none;
  user-select: none;
}
.notif-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  display: block;
}
.notif-icon-svg {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.notif-icon-svg :deep(svg) {
  width: 62%;
  height: 62%;
}
</style>
