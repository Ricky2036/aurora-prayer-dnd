<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  GRID_SCALE_MAX,
  GRID_SCALE_MIN,
  ITEM_LABELS,
  useControlStore
} from '../../stores/controlStore'

const control = useControlStore()
const isDefaultSaved = ref(false)

/* ---- 宫格整体缩放（格子 + 间距 + 图标 + 底板一起等比放大） ---- */
/* 屏宽写死 360：这是原型机的固定逻辑宽度，留白是它的因变量 */
const SCREEN_W = 360

const sideMargin = computed(() => (SCREEN_W - control.gridWidth) / 2)
/** 网格宽超过屏宽说明放大过头了，HUD 里标红提醒 */
const isOverWide = computed(() => control.gridWidth > SCREEN_W - 0.5)

function onGridScaleInput(e) {
  const v = Number(e.target.value)
  if (Number.isFinite(v)) control.setGridScale(v)
}

/** ± 按钮步进 0.01（与滑杆 step 一致），先取整到两位小数避免浮点尾差 */
function stepGridScale(dir) {
  control.setGridScale(Math.round((control.gridScale + dir * 0.01) * 100) / 100)
}

/** 一键回到 1.00 倍 */
function resetGridScale() {
  control.resetGridScale()
}

const currentTargetId = computed(() => control.selectedTarget)
const currentTargetName = computed(() => {
  return ITEM_LABELS[currentTargetId.value] || currentTargetId.value || '点击手机内任意图标'
})

const isSubIcon = computed(() => control.selectedSubTarget === 'icon')

const currentSize = computed(() => {
  if (!currentTargetId.value) return 24
  if (isSubIcon.value) {
    return control.getIconSize(currentTargetId.value)
  }
  return control.getBgSize(currentTargetId.value)
})

/* 与 controlStore.setIconSize(8~64) / setBgSize(16~100) 的 clamp 区间保持一致 */
const SIZE_LIMITS = { icon: [8, 64], bg: [16, 100] }

function limits() {
  return isSubIcon.value ? SIZE_LIMITS.icon : SIZE_LIMITS.bg
}

/**
 * 输入中：只接受完全合法的值。
 * 空串（正在删空重输）与越界值一律不落库 —— 否则 store 立刻 clamp 回 8/16
 * 并通过 :value 回写 DOM，用户想输 "24" 时先删空就被劫持成 "8"，无法连续编辑。
 */
function onNumberInput(e) {
  const id = currentTargetId.value
  if (!id) return
  const raw = String(e.target.value ?? '').trim()
  if (raw === '') return
  const val = Number(raw)
  const [min, max] = limits()
  if (!Number.isFinite(val) || val < min || val > max) return
  const rounded = Math.round(val)
  if (isSubIcon.value) {
    control.setIconSize(id, rounded)
  } else {
    control.setBgSize(id, rounded)
  }
}

/** 失焦：把非法 / 越界 / 空的中间态规范化回合法值，保证 UI 与 store 一致 */
function onNumberBlur(e) {
  const id = currentTargetId.value
  const [min, max] = limits()
  const fallback = currentSize.value
  const raw = String(e.target.value ?? '').trim()
  let next = Number(raw)
  if (!id || raw === '' || !Number.isFinite(next)) {
    e.target.value = fallback
    return
  }
  next = Math.round(Math.min(max, Math.max(min, next)))
  e.target.value = next
  if (isSubIcon.value) {
    control.setIconSize(id, next)
  } else {
    control.setBgSize(id, next)
  }
}

function adjust(delta) {
  control.adjustCurrent(delta)
}

function resetCurrent() {
  if (currentTargetId.value) {
    control.resetItem(currentTargetId.value)
  }
}

function resetAll() {
  if (confirm('确定要清空未保存的微调，将所有图标重置为默认值吗？')) {
    control.resetAllOverrides()
  }
}

function onSetAsDefault() {
  control.setAsDefault(currentTargetId.value)
  try {
    const config = control.exportConfig()
    navigator?.clipboard?.writeText?.(JSON.stringify(config, null, 2))
  } catch (e) {}

  isDefaultSaved.value = true
  setTimeout(() => {
    isDefaultSaved.value = false
  }, 1800)
}

function onKeyDown(e) {
  if (!control.fineTuningMode) return

  // 避免在 input 输入时冲突
  if (e.target.tagName === 'INPUT' && e.target.type === 'number') return

  if (e.key === 'ArrowUp' || e.key === '=' || e.key === '+') {
    e.preventDefault()
    adjust(1)
  } else if (e.key === 'ArrowDown' || e.key === '-' || e.key === '_') {
    e.preventDefault()
    adjust(-1)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="cct-panel">
    <!-- 宫格整体缩放：格子 / 间距 / 图标 / 底板一起等比放大 -->
    <div class="cct-global">
      <div class="cct-global-head">
        <span class="cct-global-title">宫格整体缩放</span>
        <button class="cct-reset-scale-btn" @click="resetGridScale" title="回到 1.00 倍">复位</button>
      </div>

      <!-- 实时数值 HUD：调参时直接读数，不用拿尺子量 -->
      <div class="cct-hud">
        <div class="cct-hud-item">
          <span class="cct-hud-val">{{ control.gridScale.toFixed(2) }}<i>×</i></span>
          <span class="cct-hud-key">倍率</span>
        </div>
        <div class="cct-hud-item">
          <span class="cct-hud-val">{{ control.cellSize.toFixed(1) }}<i>px</i></span>
          <span class="cct-hud-key">格子</span>
        </div>
        <div class="cct-hud-item">
          <span class="cct-hud-val">{{ control.gridWidth.toFixed(1) }}<i>px</i></span>
          <span class="cct-hud-key">网格宽</span>
        </div>
        <div class="cct-hud-item" :class="{ 'is-warn': isOverWide }">
          <span class="cct-hud-val">{{ sideMargin.toFixed(1) }}<i>px</i></span>
          <span class="cct-hud-key">两侧留白</span>
        </div>
      </div>

      <div class="cct-slider-row">
        <!-- 图标用 SVG 而不是 − / + 字符：字形基线会让符号视觉上偏下，SVG 几何居中 -->
        <button class="cct-step-btn" @click="stepGridScale(-1)" title="减小 0.01">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1.6 5h6.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </button>
        <input
          class="cct-slider"
          type="range"
          :min="GRID_SCALE_MIN"
          :max="GRID_SCALE_MAX"
          step="0.01"
          :value="control.gridScale"
          @input="onGridScaleInput"
        />
        <button class="cct-step-btn" @click="stepGridScale(1)" title="增大 0.01">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M5 1.6v6.8M1.6 5h6.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 目标指示条 -->
    <div class="cct-target-bar">
      <div class="cct-target-info">
        <span class="cct-pulse-dot"></span>
        <span class="cct-target-label">选中目标:</span>
        <span class="cct-target-name" :title="currentTargetName">{{ currentTargetName }}</span>
      </div>
      <button
        v-if="currentTargetId"
        class="cct-reset-item-btn"
        @click="resetCurrent"
        title="恢复默认"
        aria-label="恢复默认"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </button>
    </div>

    <!-- 子目标切换 (图标 vs 底板) -->
    <div class="cct-sub-tabs">
      <button
        class="cct-sub-tab"
        :class="{ active: isSubIcon }"
        @click="control.setSelectedSubTarget('icon')"
      >
        图标尺寸
      </button>
      <button
        class="cct-sub-tab"
        :class="{ active: !isSubIcon }"
        @click="control.setSelectedSubTarget('bg')"
      >
        底板大小
      </button>
    </div>

    <!-- 步进按钮与数字输入 (仅保留 -1 / 尺寸 / +1) -->
    <div class="cct-controls">
      <button class="cct-btn cct-btn-step" @click="adjust(-1)">-1</button>

      <div class="cct-val-box">
        <input
          type="number"
          class="cct-number-input"
          :value="currentSize"
          :min="isSubIcon ? 8 : 16"
          :max="isSubIcon ? 64 : 100"
          step="1"
          @input="onNumberInput"
          @blur="onNumberBlur"
          @keydown.enter="$event.target.blur()"
        />
        <span class="cct-unit">px</span>
      </div>

      <button class="cct-btn cct-btn-step" @click="adjust(1)">+1</button>
    </div>

    <!-- 底部操作区 (保存退出) -->
    <div class="cct-footer">
      <button class="cct-action-btn cct-save-exit" @click="control.saveAllAndExit()">
        保存退出
      </button>
    </div>
  </div>
</template>

<style scoped>
.cct-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

/* ============ 宫格整体缩放 ============ */
.cct-global {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 9px 10px 10px;
}

.cct-global-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cct-global-title {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
}

.cct-reset-scale-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  padding: 2px 8px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}
.cct-reset-scale-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

/* 数值 HUD：等宽数字，拖动时不跳位 */
.cct-hud {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.cct-hud-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 5px 2px 4px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
}

.cct-hud-val {
  font-size: 12.5px;
  font-weight: 500;
  color: #fff;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
  line-height: 1.2;
}

.cct-hud-val i {
  font-style: normal;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
  margin-left: 1px;
}

.cct-hud-key {
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.2;
}

.cct-hud-item.is-warn .cct-hud-val { color: #ff9d95; }

.cct-slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ± 步进按钮：每次 0.01，与滑杆 step 对齐 */
.cct-step-btn {
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.18s ease, color 0.18s ease, transform 0.12s ease;
}
/* svg 自身居中：块级化避免行内基线留白把图标顶偏 */
.cct-step-btn svg {
  display: block;
  width: 10px;
  height: 10px;
}
.cct-step-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}
.cct-step-btn:active {
  transform: scale(0.9);
}

.cct-slider {
  flex: 1;
  height: 3px;
  appearance: none;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  outline: none;
  cursor: pointer;
}

.cct-slider::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #fff;
  border: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  cursor: pointer;
}

.cct-slider::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #fff;
  border: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  cursor: pointer;
}

.cct-target-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 6px 10px;
}

.cct-target-info {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  flex: 1;
}

.cct-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 6px #38bdf8;
  flex-shrink: 0;
  animation: cctPulse 1.6s infinite ease-in-out;
}

@keyframes cctPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.cct-target-label {
  font: 500 11px/1 var(--font-stack);
  color: #a1a1aa;
  flex-shrink: 0;
}

.cct-target-name {
  font: 600 11px/1 var(--font-stack);
  color: #38bdf8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.cct-reset-item-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.cct-reset-item-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

.cct-reset-item-btn:active {
  transform: scale(0.92);
}

.cct-sub-tabs {
  display: flex;
  background: #101014;
  border: 1px solid #27272a;
  border-radius: 10px;
  padding: 2px;
  gap: 2px;
}

.cct-sub-tab {
  flex: 1;
  background: transparent;
  border: none;
  color: #a1a1aa;
  font: 500 11px/1 var(--font-stack);
  padding: 6px 0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
}

.cct-sub-tab.active {
  background: #2563eb;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
}

.cct-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cct-btn {
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  color: #e4e4e7;
  font: 600 11.5px/1 var(--font-stack);
  padding: 7px 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 44px;
  user-select: none;
}

.cct-btn:hover {
  background: #3f3f46;
  color: #ffffff;
}

.cct-btn:active {
  transform: scale(0.95);
}

.cct-btn-step {
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.4);
  font-size: 13px;
  font-weight: 700;
}

.cct-val-box {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #101014;
  border: 1px solid rgba(59, 130, 246, 0.45);
  border-radius: 8px;
  padding: 6px 12px;
  flex: 1;
}

.cct-number-input {
  width: 40px;
  background: transparent;
  border: none;
  outline: none;
  color: #ffffff;
  font: 700 15px/1 var(--font-stack);
  text-align: right;
  padding: 0;
  -moz-appearance: textfield;
}

.cct-number-input::-webkit-outer-spin-button,
.cct-number-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.cct-unit {
  font-size: 12px;
  color: #71717a;
  margin-left: 3px;
}

.cct-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 2px;
}

.cct-action-btn {
  flex: 1;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  color: #d4d4d8;
  font: 500 12px/1 var(--font-stack);
  padding: 8px 0;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.cct-action-btn:hover {
  background: #3f3f46;
  color: #ffffff;
}

.cct-save-exit {
  background: rgba(37, 99, 235, 0.18);
  border-color: rgba(59, 130, 246, 0.4);
  color: #93c5fd;
  font-weight: 600;
}

.cct-save-exit:hover {
  background: rgba(37, 99, 235, 0.3);
  color: #ffffff;
}
</style>
