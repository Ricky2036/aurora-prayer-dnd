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
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  value: { type: String, default: '' },
  chevron: { type: Boolean, default: false },
  clickable: { type: Boolean, default: false },
  last: { type: Boolean, default: false }   // 组内最后一条：无分隔线
})
const emit = defineEmits(['click'])
</script>

<template>
  <div class="list-cell" :class="{ clickable: chevron || clickable }" @click="emit('click')">
    <slot name="icon">
      <div v-if="glyph || iconText" class="lc-icon" :style="{ background: iconBg }">
        <svg v-if="glyph" width="17" height="17" viewBox="0 0 24 24">
          <path :d="GLYPHS[glyph]" fill="#fff" />
        </svg>
        <span v-else class="lc-icon-text">{{ iconText }}</span>
      </div>
    </slot>
    <div class="lc-main" :class="{ 'no-sep': last }">
      <div class="lc-title-col">
        <slot name="title">
          <span class="lc-title">{{ title }}</span>
        </slot>
        <span v-if="subtitle" class="lc-subtitle">{{ subtitle }}</span>
      </div>
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
  min-height: 52px;
  cursor: default;
}
.list-cell.clickable { cursor: pointer; }
.list-cell.clickable:active { background: #E9E9EB; }

.lc-icon {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14px;
}
.lc-icon-text {
  color: #fff;
  font: 600 15px/1 var(--font-stack);
}

.lc-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 16px 13px 0;
  border-bottom: 0.5px solid #F0F1F3;
  min-width: 0;
}
.lc-main.no-sep { border-bottom: none; }

.lc-title-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.lc-title {
  font: 450 15.5px/1.3 var(--font-stack);
  color: #111111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lc-subtitle {
  font: 400 13px/1.35 var(--font-stack);
  color: var(--label-secondary);
  white-space: normal;
}
.lc-right {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
}
.lc-value {
  font: 400 14.5px/1.25 var(--font-stack);
  color: #8E8E93;
}
</style>
