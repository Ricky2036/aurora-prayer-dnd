<script setup>
import { computed } from 'vue'
import { useClock } from '../../composables/useClock'
import { useControlStore } from '../../stores/controlStore'
import { useSystemStore } from '../../stores/systemStore'
import { useRecorderStore } from '../../stores/recorderStore'
import StatusIcons from '../ui/StatusIcons.vue'
import LIcon from '../ui/LIcon.vue'

const { timeShort } = useClock()
const control = useControlStore()
const system = useSystemStore()
const recorder = useRecorderStore()

/** 当正在录音且不在录音应用内（灵动岛已激活显示）时，或者锁屏层时，隐藏状态栏原始时间 */
const hideTime = computed(() => {
  return system.baseLayer === 'lock' || (recorder.isRecording && system.activeAppId !== 'voicememos')
})

/** 锁屏/深色壁纸上用白字，应用内浅底用黑字 */
const props = defineProps({
  light: { type: Boolean, default: true }
})

/* 状态栏指示图标：启用对应功能时点亮（图标与对应开关按钮同源，保证视觉一致）
 * DND 有两个状态字段（控制中心 control.dnd 与设置页 control.doNotDisturb 未互相同步），
 * 任一为 true 都点亮，两个入口都能在状态栏看到。 */
const dndOn = computed(() => control.dnd || control.doNotDisturb)
</script>

<template>
  <div class="status-bar" :style="{ color: light ? '#fff' : '#000' }">
    <span class="sb-time" :style="{ opacity: hideTime ? 0 : 1 }">{{ timeShort }}</span>
    <div class="sb-right">
      <LIcon v-if="dndOn" name="moon" :size="18" :stroke-width="2.5" class="sb-ind" />
      <LIcon v-if="control.hotspot" name="radio" :size="18" :stroke-width="2.5" class="sb-ind" />
      <LIcon v-if="control.soundMode === 'mute'" name="bellOff" :size="18" :stroke-width="2.5" class="sb-ind" />
      <LIcon v-if="control.soundMode === 'vibrate'" name="vibrate" :size="18" :stroke-width="2.5" class="sb-ind" />
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
.sb-ind {
  flex: 0 0 auto;
}
</style>