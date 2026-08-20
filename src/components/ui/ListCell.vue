<script setup>
import { GLYPHS } from '../../assets/icons/glyphs'

/**
 * iOS 分组列表单元格（设置/信息/电话通用）。
 * 左图标(彩底圆角) + 标题 + 右值/箭头/自定义右槽。
 */
const props = defineProps({
  glyph: { type: String, default: '' },
  iconBg: { type: String, default: '#8E8E93' },
  iconText: { type: String, default: '' },  // 无 glyph 时显示首字符
  title: { type: String, required: true },
  value: { type: String, default: '' },
  chevron: { type: Boolean, default: false },
  last: { type: Boolean, default: false }   // 组内最后一条：无分隔线
})
const emit = defineEmits(['click'])
</script>

<template>
  <div class="list-cell" :class="{ clickable: chevron }" @click="emit('click')">
    <div v-if="glyph || iconText" class="lc-icon" :style="{ background: iconBg }">
      <svg v-if="glyph" width="17" height="17" viewBox="0 0 24 24">
        <path :d="GLYPHS[glyph]" fill="#fff" />
      </svg>
      <span v-else class="lc-icon-text">{{ iconText }}</span>
    </div>
    <div class="lc-main" :class="{ 'no-sep': last }">
      <span class="lc-title">{{ title }}</span>
      <div class="lc-right">
        <slot name="right">
          <span v-if="value" class="lc-value">{{ value }}</span>
          <svg v-if="chevron" width="8" height="13" viewBox="0 0 8 13">
            <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-cell {
  display: flex;
  align-items: center;
  background: var(--bg-cell);
  padding-left: 16px;
  min-height: 48px;
  cursor: default;
}
.list-cell.clickable { cursor: pointer; }
.list-cell.clickable:active { background: #E9E9EB; }

.lc-icon {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 8.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 13px;
}
.lc-icon-text {
  color: #fff;
  font: 600 14px/1 var(--font-stack);
}

.lc-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 12px 0;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12);
  min-width: 0;
}
.lc-main.no-sep { border-bottom: none; }

.lc-title {
  font: 400 15px/1.25 var(--font-stack);
  color: var(--label);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lc-right {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
}
.lc-value {
  font: 400 15px/1.25 var(--font-stack);
  color: var(--label-secondary);
}
</style>
