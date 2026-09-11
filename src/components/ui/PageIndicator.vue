<script setup>
import { GLYPHS } from '../../assets/icons/glyphs'
import { useI18nStore } from '../../stores/i18nStore'

/** iOS 16 风格分页指示：圆点 + 搜索胶囊 */
const props = defineProps({
  count: { type: Number, default: 1 },
  current: { type: Number, default: 0 },
  showPages: { type: Boolean, default: false }
})
const emit = defineEmits(['search'])
const i18n = useI18nStore()
</script>

<template>
  <div class="page-indicator">
    <Transition name="indicator-swap" mode="out-in">
      <div v-if="showPages && count > 1" key="pages" class="page-dots" aria-label="桌面页面">
        <span v-for="i in count" :key="i" class="dot" :class="{ active: i - 1 === current }"></span>
      </div>
      <button v-else key="search" class="search-pill" @click="emit('search')">
        <svg width="12" height="12" viewBox="0 0 24 24"><path :d="GLYPHS.search" fill="#fff" /></svg>
        <span>{{ i18n.t('search') }}</span>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.page-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  height: 26px;
}
.page-dots { display:flex; align-items:center; justify-content:center; gap:8px; min-height:26px; }
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
.indicator-swap-enter-active,.indicator-swap-leave-active { transition:opacity 150ms ease,transform 150ms ease; }
.indicator-swap-enter-from,.indicator-swap-leave-to { opacity:0;transform:scale(.86); }
</style>
