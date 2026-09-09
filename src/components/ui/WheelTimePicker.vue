<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '07:00'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

// 解析时间 HH:mm
function parseTime(val) {
  if (!val || typeof val !== 'string') return { h: 7, m: 0 }
  const parts = val.split(':').map(Number)
  const h = Number.isFinite(parts[0]) ? (parts[0] + 24) % 24 : 7
  const m = Number.isFinite(parts[1]) ? (parts[1] + 60) % 60 : 0
  return { h, m }
}

const currentH = ref(parseTime(props.modelValue).h)
const currentM = ref(parseTime(props.modelValue).m)

watch(
  () => props.modelValue,
  (val) => {
    const { h, m } = parseTime(val)
    currentH.value = h
    currentM.value = m
  }
)

function pad2(n) {
  return String(n).padStart(2, '0')
}

function emitUpdate() {
  const formatted = `${pad2(currentH.value)}:${pad2(currentM.value)}`
  emit('update:modelValue', formatted)
  emit('change', { hour: currentH.value, minute: currentM.value, formatted })
}

function stepHour(delta) {
  currentH.value = (currentH.value + delta + 24) % 24
  emitUpdate()
}

function stepMinute(delta) {
  currentM.value = (currentM.value + delta + 60) % 60
  emitUpdate()
}

// 滚轮事件累加器
let hourWheelAccum = 0
let minWheelAccum = 0
const WHEEL_THRESHOLD = 20

function onWheelHour(e) {
  hourWheelAccum += e.deltaY
  if (Math.abs(hourWheelAccum) >= WHEEL_THRESHOLD) {
    const step = hourWheelAccum > 0 ? 1 : -1
    stepHour(step)
    hourWheelAccum = 0
  }
}

function onWheelMinute(e) {
  minWheelAccum += e.deltaY
  if (Math.abs(minWheelAccum) >= WHEEL_THRESHOLD) {
    const step = minWheelAccum > 0 ? 1 : -1
    stepMinute(step)
    minWheelAccum = 0
  }
}

// 指针/触摸拖拽交互
const isDraggingHour = ref(false)
const isDraggingMin = ref(false)
let dragStartY = 0
let dragStartVal = 0
const ROW_HEIGHT = 38

function onPointerDownHour(e) {
  isDraggingHour.value = true
  dragStartY = e.clientY
  dragStartVal = currentH.value
  window.addEventListener('pointermove', onPointerMoveHour)
  window.addEventListener('pointerup', onPointerUpHour)
  window.addEventListener('pointercancel', onPointerUpHour)
}

function onPointerMoveHour(e) {
  if (!isDraggingHour.value) return
  const dy = e.clientY - dragStartY
  const steps = Math.round(dy / ROW_HEIGHT)
  const nextH = (dragStartVal - steps + 2400) % 24
  if (nextH !== currentH.value) {
    currentH.value = nextH
    emitUpdate()
  }
}

function onPointerUpHour() {
  isDraggingHour.value = false
  window.removeEventListener('pointermove', onPointerMoveHour)
  window.removeEventListener('pointerup', onPointerUpHour)
  window.removeEventListener('pointercancel', onPointerUpHour)
}

function onPointerDownMin(e) {
  isDraggingMin.value = true
  dragStartY = e.clientY
  dragStartVal = currentM.value
  window.addEventListener('pointermove', onPointerMoveMin)
  window.addEventListener('pointerup', onPointerUpMin)
  window.addEventListener('pointercancel', onPointerUpMin)
}

function onPointerMoveMin(e) {
  if (!isDraggingMin.value) return
  const dy = e.clientY - dragStartY
  const steps = Math.round(dy / ROW_HEIGHT)
  const nextM = (dragStartVal - steps + 6000) % 60
  if (nextM !== currentM.value) {
    currentM.value = nextM
    emitUpdate()
  }
}

function onPointerUpMin() {
  isDraggingMin.value = false
  window.removeEventListener('pointermove', onPointerMoveMin)
  window.removeEventListener('pointerup', onPointerUpMin)
  window.removeEventListener('pointercancel', onPointerUpMin)
}

// 5 个展示槽位的相对偏移
const OFFSETS = [-2, -1, 0, 1, 2]
</script>

<template>
  <div class="wheel-time-picker">
    <!-- 小时滚轮 -->
    <div
      class="wheel-column"
      @wheel.prevent="onWheelHour"
      @pointerdown="onPointerDownHour"
    >
      <div
        v-for="offset in OFFSETS"
        :key="`h_${offset}`"
        class="wheel-row"
        :class="{
          'row-center': offset === 0,
          'row-near': Math.abs(offset) === 1,
          'row-far': Math.abs(offset) === 2
        }"
        @click="stepHour(offset)"
      >
        {{ pad2((currentH + offset + 24) % 24) }}
      </div>
    </div>

    <div class="wheel-gap"></div>

    <!-- 分钟滚轮 -->
    <div
      class="wheel-column"
      @wheel.prevent="onWheelMinute"
      @pointerdown="onPointerDownMin"
    >
      <div
        v-for="offset in OFFSETS"
        :key="`m_${offset}`"
        class="wheel-row"
        :class="{
          'row-center': offset === 0,
          'row-near': Math.abs(offset) === 1,
          'row-far': Math.abs(offset) === 2
        }"
        @click="stepMinute(offset)"
      >
        {{ pad2((currentM + offset + 60) % 60) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.wheel-time-picker {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  touch-action: none;
  padding: 12px 0;
  box-sizing: border-box;
}

.wheel-column {
  width: 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: grab;
}

.wheel-column:active {
  cursor: grabbing;
}

.wheel-gap {
  width: 48px;
}

.wheel-row {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;
  transition: all 0.16s cubic-bezier(0.25, 1, 0.5, 1);
  cursor: pointer;
  letter-spacing: -0.5px;
}

/* 居中选中项：高亮白大字 */
.row-center {
  font-size: 38px;
  font-weight: 600;
  color: #ffffff;
  opacity: 1;
  transform: scale(1.05);
}

/* 临近项：弱化 */
.row-near {
  font-size: 27px;
  font-weight: 500;
  color: #8e8e93;
  opacity: 0.45;
}

/* 远端项：极大弱化 */
.row-far {
  font-size: 21px;
  font-weight: 400;
  color: #636366;
  opacity: 0.22;
}
</style>
