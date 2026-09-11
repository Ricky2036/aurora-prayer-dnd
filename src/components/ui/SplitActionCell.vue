<script setup>
import ToggleSwitch from './ToggleSwitch.vue'

/**
 * 分割动作列表单元格 (SplitActionCell)
 * 参考图2设计：
 * - 左侧为应用图标与标题/副标题区域，点击可进入二级菜单 (emit 'navigate' / 'click')
 * - 开关前方有一条精致的细竖线，清晰提示左侧与右侧为独立交互区域
 * - 右侧包含独立操作（默认内置 ToggleSwitch，可通过 #action 自定义）
 */
const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  switchColor: { type: String, default: 'blue' }, // 'blue' | 'green'
  clickable: { type: Boolean, default: true },
  last: { type: Boolean, default: false }
})

const emit = defineEmits(['navigate', 'click', 'update:modelValue'])

function onNavClick(e) {
  if (!props.clickable) return
  emit('navigate', e)
  emit('click', e)
}

function onToggle(val) {
  emit('update:modelValue', val)
}
</script>

<template>
  <div class="split-action-cell" :class="{ 'no-sep': last }">
    <!-- 左侧可点击进入二级菜单的区域 -->
    <div
      class="sac-nav"
      :class="{ 'is-clickable': clickable }"
      role="button"
      tabindex="0"
      @click="onNavClick"
      @keydown.enter="onNavClick"
    >
      <div class="sac-icon">
        <slot name="icon" />
      </div>
      <div class="sac-text">
        <slot name="title">
          <span class="sac-title">{{ title }}</span>
        </slot>
        <slot name="subtitle">
          <span v-if="subtitle" class="sac-subtitle">{{ subtitle }}</span>
        </slot>
      </div>
    </div>

    <!-- 垂直分割细竖线：提示左侧可进入二级菜单 -->
    <div class="sac-divider" aria-hidden="true"></div>

    <!-- 右侧独立控制开关区 -->
    <div class="sac-action" @click.stop>
      <slot name="action">
        <ToggleSwitch
          :model-value="modelValue"
          :color="switchColor"
          :disabled="disabled"
          @update:modelValue="onToggle"
        />
      </slot>
    </div>
  </div>
</template>

<style scoped>
.split-action-cell {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--bg-cell, #ffffff);
  min-height: 58px;
  padding-left: 16px;
  padding-right: 16px;
  box-sizing: border-box;
}

/* 组内非最后一行底部分割线（从文字起始位置 68px 对齐） */
.split-action-cell::after {
  content: '';
  position: absolute;
  left: 68px;
  right: 0;
  bottom: 0;
  height: 0.5px;
  background: #F0F1F3;
  pointer-events: none;
}

.split-action-cell.no-sep::after {
  display: none;
}

/* 左侧二级导航区域 */
.sac-nav {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  padding-top: 10px;
  padding-bottom: 10px;
  user-select: none;
  border-radius: 8px;
  transition: opacity 0.15s ease;
}

.sac-nav.is-clickable {
  cursor: pointer;
}

.sac-nav.is-clickable:active {
  opacity: 0.65;
}

.sac-icon {
  flex: none;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14px;
}

.sac-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}

.sac-title {
  font: 500 16px/1.3 var(--font-stack);
  color: #111111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.2px;
}

.sac-subtitle {
  font: 400 12.5px/1.3 var(--font-stack);
  color: #8E8E93;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 垂直细竖线：100% 还原图 2 细腻提示线 */
.sac-divider {
  flex: none;
  width: 0.5px;
  height: 24px;
  background: #E5E5EA;
  margin-left: 12px;
  margin-right: 12px;
}

/* 右侧开关控制区 */
.sac-action {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
