<script setup>
import { computed, ref } from 'vue'
import { GLYPHS } from '../../assets/icons/glyphs'
import { clamp } from '../../utils/math'

/**
 * 控制中心竖向大滑块（亮度/音量）。
 * v-model 0..1，白色填充随值增长，底部 glyph。
 */
const props = defineProps({
  modelValue: { type: Number, default: 0.5 },
  glyph: { type: String, default: 'sun' },
  height: { type: Number, default: 150 }
})
const emit = defineEmits(['update:modelValue'])

const trackRef = ref(null)
let dragging = false

function setFromEvent(e) {
  const el = trackRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const v = 1 - (e.clientY - r.top) / r.height
  emit('update:modelValue', clamp(v, 0, 1))
}

function onPointerDown(e) {
  dragging = true
  e.currentTarget.setPointerCapture?.(e.pointerId)
  setFromEvent(e)
}
function onPointerMove(e) {
  if (dragging) setFromEvent(e)
}
function onPointerUp() { dragging = false }

const fillPct = computed(() => `${props.modelValue * 100}%`)
</script>

<template>
  <div
    ref="trackRef"
    class="slider-control"
    :style="{ height: height + 'px' }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div class="sc-fill" :style="{ height: fillPct }"></div>
    <div class="sc-glyph" :class="{ active: modelValue > 0.08 }">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path :d="GLYPHS[glyph]" :fill="modelValue > 0.08 ? '#7a7a80' : '#fff'" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.slider-control {
  position: relative;
  width: 56px;
  border-radius: var(--radius-module);
  background: rgba(60, 60, 67, 0.36);
  overflow: hidden;
  touch-action: none;
  cursor: pointer;
}
.sc-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.96);
}
.sc-glyph {
  position: absolute;
  bottom: 8px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
</style>
