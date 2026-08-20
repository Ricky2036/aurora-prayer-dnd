<script setup>
import { computed } from 'vue'
import { useClock } from '../../composables/useClock'
import { useControlStore } from '../../stores/controlStore'
import { useSystemStore } from '../../stores/systemStore'
import StatusIcons from '../ui/StatusIcons.vue'

const { timeShort } = useClock()
const control = useControlStore()
const system = useSystemStore()

/** 锁屏/深色壁纸上用白字，应用内浅底用黑字 */
const props = defineProps({
  light: { type: Boolean, default: true }
})
</script>

<template>
  <div class="status-bar" :style="{ color: light ? '#fff' : '#000' }">
    <span class="sb-time" :style="{ opacity: system.baseLayer === 'lock' ? 0 : 1 }">{{ timeShort }}</span>
    <div class="sb-right">
      <StatusIcons :color="light ? '#fff' : '#000'" />
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--safe-top);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 6.5px 30px 0;
  z-index: var(--z-status-bar);
  font: 600 15px/1 var(--font-stack);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2px;
  pointer-events: none; /* 热区手势由叠层 edge 元素负责 */
}
.sb-time {
  min-width: 54px;
  height: 32px;
  display: flex;
  align-items: center;
}
.sb-right {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>