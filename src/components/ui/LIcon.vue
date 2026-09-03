<script setup>
import { computed } from 'vue'
import { LUCIDE } from '../../assets/icons/lucide'

/**
 * Lucide 图标渲染器：内联 SVG（stroke=currentColor），尺寸/描边粗细可调。
 * <LIcon name="wifi" :size="20" :stroke-width="2" class="text-white" />
 */
const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
  strokeWidth: { type: [Number, String], default: 2 },
  filled: { type: Boolean, default: false } // fill=currentColor（播放键等需要填充的场景）
})

const html = computed(() => {
  let svg = LUCIDE[props.name] || ''
  svg = svg
    .replace(/width="[^"]*"/, `width="${props.size}"`)
    .replace(/height="[^"]*"/, `height="${props.size}"`)
    .replace(/stroke-width="[^"]*"/, `stroke-width="${props.strokeWidth}"`)
  if (props.filled) {
    svg = svg.replace(/fill="none"/, 'fill="currentColor"')
  }
  return svg
})
</script>

<template>
  <span class="l-icon" v-html="html"></span>
</template>

<style scoped>
.l-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}
</style>
