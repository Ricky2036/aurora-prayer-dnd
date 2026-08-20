<script setup>
import { GLYPHS } from '../../assets/icons/glyphs'

/** iOS 16 风格分页指示：圆点 + 搜索胶囊 */
const props = defineProps({
  count: { type: Number, default: 1 },
  current: { type: Number, default: 0 }
})
const emit = defineEmits(['search'])
</script>

<template>
  <div class="page-indicator">
    <span
      v-if="count > 1"
      v-for="i in count"
      :key="i"
      class="dot"
      :class="{ active: i - 1 === current }"
    ></span>
    <button class="search-pill" @click="emit('search')">
      <svg width="12" height="12" viewBox="0 0 24 24"><path :d="GLYPHS.search" fill="#fff" /></svg>
      <span>搜索</span>
    </button>
  </div>
</template>

<style scoped>
.page-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
}
.dot.active { background: #fff; }
.search-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 12px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #fff;
  font: 500 12px/1 var(--font-stack);
  transition: transform 0.15s ease;
}
.search-pill:active { transform: scale(0.94); }
</style>
