<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useSystemStore } from '../../stores/systemStore'
import { useControlStore } from '../../stores/controlStore'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { getDriver } from '../../composables/driverRegistry'
import { packLayout, isOverlapping, computeDisplayLayout, recordPositions, applyFlip } from './cc/ccLayout'
import GridButton from './cc/GridButton.vue'
import LIcon from '../ui/LIcon.vue'
import StatusIcons from '../ui/StatusIcons.vue'
import MaterialBlur from '../ui/MaterialBlur.vue'
import { clamp } from '../../utils/math'

/**
 * 控制中心（安卓液态玻璃风，移植自 android_control_center.tsx）。
 * 4 列网格：Wi-Fi/数据胶囊、媒体卡片、亮度音量竖滑块、19 个圆形开关。
 * 编辑模式：HTML5 拖拽重排（swap 虚拟显示引擎 + FLIP）、删除徽标、伸缩手柄。
 * 真实联动：亮度滑块压暗屏幕、飞行/Wi-Fi/蓝牙/蜂窝同步状态栏、相机直达应用。
 */
const system = useSystemStore()
const control = useControlStore()

const overlay = computed(() => system.overlays.controlCenter)
const visible = computed(() => overlay.value.status !== 'closed')

const layerStyle = computed(() => ({
  transform: `translateY(${(overlay.value.progress - 1) * 100}%)`,
  visibility: visible.value ? 'visible' : 'hidden',
  pointerEvents: visible.value ? 'auto' : 'none'
}))
const blurStyle = computed(() => ({ opacity: clamp(overlay.value.progress * 1.2, 0, 1) }))
const contentStyle = computed(() => ({
  transform: `translateY(${(1 - overlay.value.progress) * 26}px)`,
  opacity: clamp(overlay.value.progress * 1.5, 0, 1)
}))

/* 打开后面板上滑关闭 */
const rootRef = ref(null)
const driver = getDriver('controlCenter')
if (driver) useSwipeGesture(rootRef, driver.closeGesture)

function onCcClick(e) {
  // 编辑模式下点空白区退出编辑模式
  if (editing.value) {
    if (!e.target.closest('.cc-icon-btn, .cc-edit-group, .gb-wrap, .cc-cell')) {
      control.setEditing(false)
    }
    return
  }
  // 点击卡片、胶囊、按钮、滑块等交互元素时不退出
  if (e.target.closest('.cc-pill, .cc-media, .cc-sliders, .cc-vslider, .gb-wrap, .cc-grid-btn, .cc-icon-btn, .cc-edit-group, button, a, input, label')) {
    return
  }
  system.requestCloseOverlay('controlCenter')
}

/* ================= 网格配置 ================= */

const TOGGLES = [
  { id: 'flashlight', icon: 'flashlight', label: '手电筒', activeBg: '#22c55e', activeColor: '#fff' },
  { id: 'sound', icon: 'bell', label: '响铃', fillOnActive: true, activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'bluetooth', icon: 'bluetooth', label: '蓝牙', activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'hotspot', icon: 'radio', label: '热点', activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'airplane', icon: 'plane', label: '飞行模式', activeBg: '#fff', activeColor: '#f97316' },
  { id: 'location', icon: 'mapPin', label: '定位', fillOnActive: true, activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'screenRecord', icon: 'video', label: '录屏', fillOnActive: true, activeBg: '#fff', activeColor: '#ef4444' },
  { id: 'darkMode', icon: 'moon', label: '深色模式', activeBg: '#fff', activeColor: '#111' },
  { id: 'screenshot', icon: 'scissors', label: '截屏', activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'rotationLock', icon: 'lock', label: '锁定', activeBg: '#fff', activeColor: '#ef4444' },
  { id: 'camera', icon: 'camera', label: '相机', activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'batterySaver', icon: 'battery', label: '省电', activeBg: '#eab308', activeColor: '#fff' },
  { id: 'share', icon: 'share2', label: '分享', activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'sync', icon: 'refreshCw', label: '同步', activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'calculator', icon: 'calculator', label: '计算器', activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'scan', icon: 'scan', label: '扫一扫', activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'nfc', icon: 'nfc', label: 'NFC', activeBg: '#22c55e', activeColor: '#fff' },
  { id: 'boost', icon: 'zap', label: '加速', fillOnActive: true, activeBg: '#fff', activeColor: '#3b82f6' },
  { id: 'more', icon: 'layoutGrid', label: '更多', activeBg: '#fff', activeColor: '#3b82f6' }
]

const baseItems = [
  { id: 'wifi', type: 'widget', size: '2x1' },
  { id: 'data', type: 'widget', size: '2x1' },
  { id: 'mediaPlayer', type: 'widget', size: '2x2' },
  { id: 'mediaControls', type: 'widget', size: '2x2' },
  { id: 'joyConnect', type: 'widget', size: '2x1' },
  { id: 'joyHeart', type: 'widget', size: '2x1' },
  ...TOGGLES.map((t) => ({ id: t.id, type: 'toggle', size: '1x1' }))
].map((i) => {
  const [w, h] = i.size.split('x').map(Number)
  return { ...i, w, h }
})

const layout = ref(packLayout(baseItems))

/* ================= 编辑模式与拖拽 ================= */

/* 编辑模式共享 controlStore（App.vue 控制台可同步切换） */
const editing = computed(() => control.editing)
const dragState = ref(null)       // { id, startR, startC, curR, curC }
const resizingId = ref(null)
const gridRef = ref(null)
const flipStore = { positions: null }

const dragOffset = { offsetX: 0, offsetY: 0, width: 0, height: 0 }
const pendingTarget = { r: null, c: null }
let hoverTimer = null

const displayLayout = computed(() => computeDisplayLayout(layout.value, dragState.value, control.dragMode))

// 显示布局变化 → FLIP 补间（含拖拽推演 / 落位 / 伸缩 resize 重排）
// flush 'post'：DOM 更新后同步 applyFlip（等同 React useLayoutEffect），
// 避免 'pre'+nextTick 在连续快速推演时回调被合并导致补间丢失。
// 不再跳过 resize：1x1→2x1 时 packLayout 会重排其它图标，需要位移动画；
// 被缩放卡片自身的宽度动画由 CSS width transition 承担，与 FLIP transform 不冲突。
watch(
  displayLayout,
  () => {
    applyFlip(gridRef.value, flipStore)
  },
  { flush: 'post' }
)

function onDragStart(e, id) {
  if (!editing.value) { e.preventDefault(); return }
  const item = layout.value.find((i) => i.id === id)
  if (!item) return
  const rect = e.currentTarget.getBoundingClientRect()
  dragOffset.offsetX = e.clientX - rect.left
  dragOffset.offsetY = e.clientY - rect.top
  dragOffset.width = rect.width
  dragOffset.height = rect.height
  pendingTarget.r = item.r
  pendingTarget.c = item.c
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', id)
  // 延迟置拖拽态：浏览器先截取不透明幽灵图，防断联
  setTimeout(() => {
    dragState.value = { id, startR: item.r, startC: item.c, curR: item.r, curC: item.c }
  }, 0)
}

function onDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (!dragState.value || !gridRef.value) return

  const rect = gridRef.value.getBoundingClientRect()
  const centerX = e.clientX - dragOffset.offsetX + dragOffset.width / 2
  const centerY = e.clientY - dragOffset.offsetY + dragOffset.height / 2
  const x = centerX - rect.left
  const y = centerY - rect.top

  let c = Math.floor(x / 90)  // col pitch = 62 + 28
  let r = Math.floor(y / 76)  // row pitch = 62 + 14
  c = clamp(c, 0, 3)
  r = Math.max(0, r)

  const dragged = layout.value.find((i) => i.id === dragState.value.id)
  if (!dragged) return
  if (c + dragged.w > 4) c = 4 - dragged.w

  // 120ms 防抖停滞雷达：极速飞过时不错乱重排
  if (dragState.value.curR !== r || dragState.value.curC !== c) {
    if (pendingTarget.r !== r || pendingTarget.c !== c) {
      pendingTarget.r = r
      pendingTarget.c = c
      clearTimeout(hoverTimer)
      hoverTimer = setTimeout(() => {
        recordPositions(gridRef.value, flipStore)
        if (dragState.value) {
          dragState.value = { ...dragState.value, curR: r, curC: c }
        }
      }, 120)
    }
  } else {
    pendingTarget.r = r
    pendingTarget.c = c
    clearTimeout(hoverTimer)
  }
}

function onDrop(e) {
  e.preventDefault()
  if (dragState.value) {
    recordPositions(gridRef.value, flipStore)
    layout.value = displayLayout.value
    dragState.value = null
    clearTimeout(hoverTimer)
    // 落位后补一次 FLIP（覆盖 flow 吸附等推演与落位不一致的边缘情况）
    nextTick(() => applyFlip(gridRef.value, flipStore))
  }
}

function onDragEnd() {
  if (dragState.value) {
    recordPositions(gridRef.value, flipStore)
    dragState.value = null
    clearTimeout(hoverTimer)
    // 取消拖拽：布局回原位，displayLayout 引用不变 watch 不触发 → 手动补回位补间
    nextTick(() => applyFlip(gridRef.value, flipStore))
  }
}

function onRemove(id) {
  recordPositions(gridRef.value, flipStore)
  const filtered = layout.value.filter((i) => i.id !== id)
  // flow 模式：紧凑吸附；swap 模式：保留空位
  layout.value = control.dragMode === 'flow' ? packLayout(filtered) : filtered
}

function resetLayout() {
  recordPositions(gridRef.value, flipStore)
  layout.value = packLayout(baseItems)
}

/* ---- 伸缩手柄：1x1 ↔ 2x1（仅 toggle） ---- */

let resizeState = null

function onResizeStart(e, id) {
  const item = layout.value.find((i) => i.id === id)
  if (!item || item.type !== 'toggle') return
  resizeState = {
    id,
    startX: e.clientX,
    initialSize: item.size,
    snapSize: item.size,
    delta: 0
  }
  resizingId.value = id
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd, { once: true })
}

function onResizeMove(e) {
  if (!resizeState) return
  const deltaX = e.clientX - resizeState.startX
  const THRESH = 45
  if (resizeState.initialSize === '1x1') {
    resizeState.delta = clamp(deltaX, 0, 90)
    const want = resizeState.delta > THRESH ? '2x1' : '1x1'
    if (want !== resizeState.snapSize) {
      resizeState.snapSize = want
      recordPositions(gridRef.value, flipStore)
      const [w, h] = want.split('x').map(Number)
      layout.value = packLayout(layout.value.map((t) =>
        t.id === resizeState.id ? { ...t, size: want, w, h } : t
      ))
    }
  } else {
    resizeState.delta = clamp(deltaX, -90, 0)
    const want = resizeState.delta < -THRESH ? '1x1' : '2x1'
    if (want !== resizeState.snapSize) {
      resizeState.snapSize = want
      recordPositions(gridRef.value, flipStore)
      const [w, h] = want.split('x').map(Number)
      layout.value = packLayout(layout.value.map((t) =>
        t.id === resizeState.id ? { ...t, size: want, w, h } : t
      ))
    }
  }
}

function onResizeEnd() {
  window.removeEventListener('pointermove', onResizeMove)
  resizingId.value = null
  resizeState = null
}

/* ================= 开关激活 ================= */

function onActivate(id) {
  if (id === 'camera') {
    system.closeOverlay('controlCenter')
    system.openApp('camera')
    return
  }
  if (id === 'sound') return // 由 GridButton 内部 cycleSoundMode 处理
  control.toggle(id)
}

/* ================= 竖向滑块（亮度/音量） ================= */

function sliderPointer(e, key) {
  if (editing.value) return
  e.stopPropagation()
  const track = e.currentTarget
  const setFromEvent = (ev) => {
    const r = track.getBoundingClientRect()
    const ratio = clamp((r.bottom - ev.clientY) / r.height, 0, 1)
    if (key === 'brightness') control.setBrightness(Math.max(0.25, ratio))
    else control.setVolume(ratio)
  }
  setFromEvent(e)
  const move = (ev) => setFromEvent(ev)
  const up = () => {
    window.removeEventListener('pointermove', move)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up, { once: true })
}

/* ================= 其他 ================= */

const brightnessPct = computed(() => control.brightness * 100)
const volumePct = computed(() => control.volume * 100)

function cellStyle(item) {
  return {
    gridRow: `${item.r + 1} / span ${item.h}`,
    gridColumn: `${item.c + 1} / span ${item.w}`,
    zIndex: resizingId.value === item.id ? 40 : (dragState.value?.id === item.id ? 50 : 10),
    opacity: dragState.value?.id === item.id ? 0 : 1,
    pointerEvents: dragState.value?.id === item.id ? 'none' : 'auto'
  }
}

function toggleWidth(item) {
  const base = item.size === '2x1' ? 152 : 62
  if (resizingId.value === item.id && resizeState) {
    return (resizeState.initialSize === '2x1' ? 152 : 62) + resizeState.delta
  }
  return base
}

function openSettings() {
  system.closeOverlay('controlCenter')
  system.openApp('settings')
}

const glassRing = computed(() =>
  editing.value
    ? 'inset 0 0 0 1px rgba(255,255,255,0.4)'
    : 'inset 0 0 0 1px rgba(255,255,255,0.2)'
)
</script>

<template>
  <div ref="rootRef" class="control-center" :style="layerStyle" @click="onCcClick">
    <!-- 动态高斯模糊与材质混色底 -->
    <MaterialBlur />

    <div class="cc-scroll" :style="contentStyle">
      <!-- 头部：设置 / 编辑 -->
      <div class="cc-header">
        <template v-if="!editing">
          <button class="cc-icon-btn" @click="openSettings"><LIcon name="settings" :size="20" /></button>
          <button class="cc-icon-btn" @click="control.setEditing(true)"><LIcon name="pencil" :size="18" /></button>
        </template>
        <template v-else>
          <button class="cc-icon-btn cc-glass" @click="resetLayout"><LIcon name="plus" :size="20" :stroke-width="1.5" /></button>
          <div class="cc-edit-group">
            <button class="cc-icon-btn cc-glass cc-group-left" @click="resetLayout"><LIcon name="slidersHorizontal" :size="16" /></button>
            <button class="cc-icon-btn cc-glass" @click="control.setEditing(false)"><LIcon name="check" :size="18" :stroke-width="2.5" /></button>
          </div>
        </template>
      </div>

      <!-- 状态行 -->
      <div class="cc-status" :class="{ hidden: editing }">
        <span class="cc-carrier">中国电信</span>
        <div class="cc-status-icons">
          <StatusIcons color="#fff" :show-wifi="true" :show-battery="true" />
        </div>
      </div>

      <!-- 网格 -->
      <div ref="gridRef" class="cc-grid" @dragover="onDragOver" @drop="onDrop">
        <div
          v-for="item in displayLayout"
          :key="item.id"
          class="cc-cell"
          :data-id="item.id"
          :style="cellStyle(item)"
          :draggable="editing && resizingId === null"
          @dragstart="onDragStart($event, item.id)"
          @dragend="onDragEnd"
        >
          <!-- Wi-Fi 胶囊 -->
          <div v-if="item.id === 'wifi'" class="cc-pill" :style="{ boxShadow: glassRing }" @click="!editing && control.toggle('wifi')">
            <div class="cc-pill-icon" :style="{ background: control.wifi ? '#258FFF' : 'rgba(255,255,255,0.2)' }">
              <LIcon name="wifi" :size="22" />
            </div>
            <div class="cc-pill-text">
              <span class="cc-pill-title">Aurora_5G</span>
              <span class="cc-pill-sub">{{ control.wifi ? '已连接' : '已断开' }}</span>
            </div>
          </div>

          <!-- 数据胶囊 -->
          <div v-else-if="item.id === 'data'" class="cc-pill" :style="{ boxShadow: glassRing }" @click="!editing && control.toggle('cellular')">
            <div class="cc-pill-icon" :style="{ background: control.cellular ? '#22c55e' : 'rgba(255,255,255,0.2)' }">
              <LIcon name="arrowDownUp" :size="20" />
            </div>
            <div class="cc-pill-text">
              <span class="cc-pill-title">中国电信</span>
              <span class="cc-pill-sub">{{ control.cellular ? '3.38 MB' : '已关闭' }}</span>
            </div>

                      </div>

          <!-- 媒体播放器 -->
          <div v-else-if="item.id === 'mediaPlayer'" class="cc-media" :style="{ boxShadow: glassRing }">
            <button class="cc-cast"><LIcon name="cast" :size="12" /></button>
            <div class="cc-media-state">{{ control.mediaPlaying ? '正在播放' : '暂无播放' }}</div>
            <div class="cc-media-btns">
              <button class="cc-mc"><LIcon name="skipBack" :size="16" :filled="true" /></button>
              <button class="cc-mc" @click.stop="!editing && control.toggle('mediaPlaying')">
                <LIcon :name="control.mediaPlaying ? 'pause' : 'play'" :size="24" :filled="true" />
              </button>
              <button class="cc-mc"><LIcon name="skipForward" :size="16" :filled="true" /></button>
            </div>

                      </div>

          <!-- 亮度 / 音量竖滑块 -->
          <div v-else-if="item.id === 'mediaControls'" class="cc-sliders">
            <div class="cc-vslider" :style="{ boxShadow: glassRing }" @pointerdown="sliderPointer($event, 'brightness')">
              <div class="cc-vslider-fill" :style="{ height: brightnessPct + '%' }"></div>
              <div class="cc-vslider-icon" :class="{ warm: control.brightness > 0.15 }">
                <LIcon name="sun" :size="22" />
              </div>
            </div>
            <div class="cc-vslider" :style="{ boxShadow: glassRing }" @pointerdown="sliderPointer($event, 'volume')">
              <div class="cc-vslider-fill" :style="{ height: volumePct + '%' }"></div>
              <div class="cc-vslider-icon" :class="{ cool: control.volume > 0.15 }">
                <LIcon name="volume2" :size="22" />
              </div>
            </div>
          </div>

          <!-- Joy Connect -->
          <div v-else-if="item.id === 'joyConnect'" class="cc-pill" :style="{ boxShadow: glassRing }">
            <div class="cc-pill-icon" style="background: rgba(255,255,255,0.2)">
              <LIcon name="link2" :size="18" style="transform: rotate(-45deg)" />
            </div>
            <div class="cc-pill-text"><span class="cc-pill-title">Joy Connect</span></div>

                      </div>

          <!-- Joy Heart -->
          <div v-else-if="item.id === 'joyHeart'" class="cc-pill" :style="{ boxShadow: glassRing }">
            <div class="cc-pill-icon" style="background: rgba(255,255,255,0.2)">
              <LIcon name="heart" :size="18" />
            </div>
            <div class="cc-pill-text cc-heart-text">
              <span>67bpm · 94%</span>
              <span>71ms · 25</span>
            </div>

                      </div>

          <!-- 圆形开关 -->
          <GridButton
            v-else
            :item="TOGGLES.find((t) => t.id === item.id)"
            :editing="editing"
            :resizing="resizingId === item.id"
            :expanded="item.size === '2x1'"
            :computed-width="toggleWidth(item)"
            @activate="onActivate"
            @resize-start="onResizeStart"
            @remove="onRemove"
          />

          <!-- 编辑模式统一删除徽标（widget 类型，挂在 cell 级避免被容器 overflow 裁切） -->
          <div
            v-if="editing && item.type === 'widget'"
            class="cc-remove cc-remove-cell"
            @click.stop="onRemove(item.id)"
          >
            <LIcon name="minus" :size="12" :stroke-width="3" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.control-center {
  position: absolute;
  inset: 0;
  z-index: var(--z-control-center);
  will-change: transform;
}

.cc-scroll {
  position: relative;
  height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  padding: calc(var(--safe-top) + 2px) 0 90px;
  will-change: transform, opacity;
}
.cc-scroll::-webkit-scrollbar { display: none; }

/* 头部 */
.cc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  margin-bottom: 8px;
  height: 36px;
}
.cc-icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s ease;
}
.cc-icon-btn:hover { background: rgba(255, 255, 255, 0.15); }
.cc-glass {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}
.cc-edit-group {
  display: flex;
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
}
.cc-edit-group .cc-icon-btn { border-radius: 0; box-shadow: none; background: transparent; }
.cc-group-left { border-right: 1px solid rgba(255, 255, 255, 0.2); }

/* 状态行 */
.cc-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 22px;
  height: 20px;
  margin-bottom: 14px;
  font: 500 12px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.95);
  transition: opacity 0.3s ease;
}
.cc-status.hidden { opacity: 0; }
.cc-status-icons {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 网格：4 列 × 62px，列距 28px，行距 14px */
.cc-grid {
  display: grid;
  grid-template-columns: repeat(4, 62px);
  grid-auto-rows: 62px;
  column-gap: 28px;
  row-gap: 14px;
  width: 332px;
  margin: 0 auto;
  min-height: 500px;
  padding-bottom: 40px;
}
.cc-cell {
  position: relative;
  display: flex;
  justify-content: flex-start;
  flex-shrink: 0;
  transition: opacity 0.2s ease;
}

/* 2x1 胶囊 */
.cc-pill {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  padding: 6px 12px 6px 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(30px) saturate(200%);
  -webkit-backdrop-filter: blur(30px) saturate(200%);
  cursor: pointer;
  transition: background 0.3s ease;
  overflow: hidden;
}
.cc-pill:hover { background: rgba(255, 255, 255, 0.22); }
.cc-pill-icon {
  flex: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition: background 0.3s ease;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.15);
}
.cc-pill-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
}
.cc-pill-title {
  font: 500 12px/1.2 var(--font-stack);
  color: rgba(255, 255, 255, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-pill-sub {
  font: 400 10px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.6);
  margin-top: 3px;
}
.cc-heart-text {
  font: 400 10px/1.3 var(--font-stack);
  color: rgba(255, 255, 255, 0.8);
  gap: 2px;
}

/* 媒体播放器 */
.cc-media {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 24px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(30px) saturate(200%);
  -webkit-backdrop-filter: blur(30px) saturate(200%);
  overflow: hidden;
}
.cc-cast {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}
.cc-media-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 500 13px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1px;
  pointer-events: none;
}
.cc-media-btns {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  padding-bottom: 4px;
}
.cc-mc {
  padding: 6px;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  transition: color 0.2s ease;
}
.cc-mc:hover { color: rgba(255, 255, 255, 0.95); }

/* 竖滑块 */
.cc-sliders {
  width: 100%;
  height: 100%;
  display: flex;
  gap: 14px;
  position: relative;
}
.cc-vslider {
  flex: 1;
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(30px) saturate(200%);
  -webkit-backdrop-filter: blur(30px) saturate(200%);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  touch-action: none;
}
.cc-vslider-fill {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  background: #fff;
  transition: height 0.1s ease-out;
}
.cc-vslider-icon {
  position: absolute;
  bottom: 20px;
  left: 0; right: 0;
  display: flex;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  pointer-events: none;
  transition: color 0.3s ease;
}
.cc-vslider-icon.warm { color: #FAB500; }
.cc-vslider-icon.cool { color: #258FFF; }

/* 删除徽标（widget 通用） */
.cc-remove {
  position: absolute;
  top: -2px;
  left: -2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(12px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  cursor: pointer;
  transition: background 0.2s ease;
}
.cc-remove:hover { background: rgba(239, 68, 68, 0.8); }
</style>
