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
  if (!svg) return ''
  // 仅替换根 <svg> 标签的 width 和 height，避免误伤内部 <rect width="...">
  svg = svg.replace(/^\s*<svg\b[^>]*>/i, (match) => {
    let m = match
    if (/width="[^"]*"/.test(m)) m = m.replace(/width="[^"]*"/, `width="${props.size}"`)
    else m = m.replace('<svg', `<svg width="${props.size}"`)
    if (/height="[^"]*"/.test(m)) m = m.replace(/height="[^"]*"/, `height="${props.size}"`)
    else m = m.replace('<svg', `<svg height="${props.size}"`)
    if (/stroke-width="[^"]*"/.test(m)) m = m.replace(/stroke-width="[^"]*"/, `stroke-width="${props.strokeWidth}"`)
    return m
  })
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
  flex: none;
  line-height: 0;
}
.l-icon :deep(svg) {
  display: block;
  flex: none;
}
</style>
