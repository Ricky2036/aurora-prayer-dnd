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
import albumCover from '../../assets/icons/album_cover.png'

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

const scrollRef = ref(null)
watch(() => overlay.value.status, (status) => {
  if (status === 'opening' || status === 'opened') {
    nextTick(() => {
      if (scrollRef.value) scrollRef.value.scrollTop = 0
    })
  }
})

/* 打开后面板上滑关闭 */
const rootRef = ref(null)
const driver = getDriver('controlCenter')
if (driver) useSwipeGesture(rootRef, driver.closeGesture)

function onCcClick(e) {
  // 编辑模式下点空白区退出编辑模式
  if (editing.value) {
    if (!e.target.closest('.cc-header-btn, .cc-icon-btn, .cc-edit-group, .gb-wrap, .cc-cell')) {
      control.setEditing(false)
    }
    return
  }
  // 点击卡片、胶囊、按钮、滑块等交互元素时不退出
  if (e.target.closest('.cc-header-btn, .cc-pill, .cc-media, .cc-sliders, .cc-vslider, .gb-wrap, .cc-grid-btn, .cc-icon-btn, .cc-edit-group, button, a, input, label')) {
    return
  }
  system.requestCloseOverlay('controlCenter')
}

/* ================= 网格配置 ================= */

const TOGGLES = [
  { id: 'bluetooth', icon: 'bluetooth', label: 'Bluetooth', activeBg: '#258FFF', activeColor: '#fff', defaultSize: '2x1' },
  { id: 'hotspot', icon: 'radio', label: '热点', activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'airplane', icon: 'plane', label: '飞行模式', activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'location', icon: 'mapPin', label: '定位', fillOnActive: true, activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'screenshot', icon: 'scissors', label: '截屏', activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'darkMode', icon: 'darkTheme', label: 'Dark Theme', activeBg: '#258FFF', activeColor: '#fff', defaultSize: '2x1' },
  { id: 'dnd', icon: 'moon', label: '勿扰', fillOnActive: true, activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'sound', icon: 'bell', label: '响铃', fillOnActive: true, activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'rotationLock', icon: 'rotationLock', label: '锁定', activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'screenRecord', icon: 'video', label: '录屏', fillOnActive: true, activeBg: '#ef4444', activeColor: '#fff' },
  { id: 'batterySaver', icon: 'battery', label: '省电', activeBg: '#eab308', activeColor: '#fff' },
  { id: 'autoRotate', icon: 'autoRotate', label: '旋转', activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'share', icon: 'quickShare', label: '分享', activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'cast', icon: 'cast', label: '投屏', activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'flashlight', icon: 'flashlightOn', label: '手电筒', activeBg: '#fff', activeColor: '#FBB500' },
  { id: 'calculator', icon: 'calculator', label: '计算器', activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'scan', icon: 'scan', label: '扫一扫', activeBg: '#258FFF', activeColor: '#fff' },
  { id: 'boost', icon: 'zap', label: '加速', fillOnActive: true, activeBg: '#258FFF', activeColor: '#fff' }
]

const DEFAULT_TOGGLE_IDS = [
  'bluetooth', 'hotspot', 'airplane',
  'location', 'screenshot', 'darkMode',
  'dnd', 'sound', 'rotationLock', 'screenRecord',
  'batterySaver', 'autoRotate', 'share', 'cast'
]

const baseItems = [
  { id: 'wifi', type: 'widget', size: '2x1' },
  { id: 'data', type: 'widget', size: '2x1' },
  { id: 'mediaPlayer', type: 'widget', size: '2x2' },
  { id: 'mediaControls', type: 'widget', size: '2x2' },
  { id: 'joyConnect', type: 'widget', size: '2x1' },
  { id: 'joyHeart', type: 'widget', size: '2x1' },
  ...DEFAULT_TOGGLE_IDS.map((id) => {
    const t = TOGGLES.find((item) => item.id === id)
    return { id: t.id, type: 'toggle', size: t.defaultSize || '1x1' }
  })
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

  let c = Math.floor(x / 76)  // col pitch = 62 + 14 = 76
  let r = Math.floor(y / 76)  // row pitch = 62 + 14 = 76
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
  const THRESH = 38
  if (resizeState.initialSize === '1x1') {
    resizeState.delta = clamp(deltaX, 0, 76)
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
    resizeState.delta = clamp(deltaX, -76, 0)
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
  const base = item.size === '2x1' ? 138 : 62
  if (resizingId.value === item.id && resizeState) {
    return (resizeState.initialSize === '2x1' ? 138 : 62) + resizeState.delta
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

    <!-- 全局控制中心渐变滤镜定义 -->
    <svg width="0" height="0" style="position: absolute; pointer-events: none">
      <defs>
        <linearGradient id="paint0_linear_2860_1301" x1="17.5" y1="0" x2="16.9972" y2="61.7832" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.3"/>
          <stop offset="0.3" stop-color="white" stop-opacity="0.02"/>
          <stop offset="0.7" stop-color="white" stop-opacity="0.02"/>
          <stop offset="1" stop-color="white" stop-opacity="0.2"/>
        </linearGradient>
        <linearGradient id="paint0_linear_331_95718" x1="38.9516" y1="0" x2="38.7257" y2="61.7864" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.3"/>
          <stop offset="0.3" stop-color="white" stop-opacity="0.02"/>
          <stop offset="0.7" stop-color="white" stop-opacity="0.02"/>
          <stop offset="1" stop-color="white" stop-opacity="0.2"/>
        </linearGradient>
      </defs>
    </svg>

    <div ref="scrollRef" class="cc-scroll" :style="contentStyle">
      <!-- 头部：编辑 (左) / 设置 (右) -->
      <div class="cc-header">
        <template v-if="!editing">
          <button class="cc-header-btn" @click.stop="control.setEditing(true)" title="编辑"><LIcon name="headerEdit" :size="30" /></button>
          <div class="cc-header-camera-spacer"></div>
          <button class="cc-header-btn" @click.stop="openSettings" title="设置"><LIcon name="headerSettings" :size="30" /></button>
        </template>
        <template v-else>
          <button class="cc-icon-btn cc-glass" @click.stop="resetLayout"><LIcon name="plus" :size="20" :stroke-width="1.5" /></button>
          <div class="cc-edit-group">
            <button class="cc-icon-btn cc-glass cc-group-left" @click.stop="resetLayout"><LIcon name="slidersHorizontal" :size="16" /></button>
            <button class="cc-icon-btn cc-glass" @click.stop="control.setEditing(false)"><LIcon name="check" :size="18" :stroke-width="2.5" /></button>
          </div>
        </template>
      </div>

      <!-- 隐私指示器胶囊 (Camera Recording Map >) -->
      <div class="cc-privacy-pill" :class="{ hidden: editing }">
        <div class="cc-priv-dots">
          <span class="cc-priv-dot cc-priv-cam">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </span>
          <span class="cc-priv-dot cc-priv-mic">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
          </span>
          <span class="cc-priv-dot cc-priv-loc">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </span>
        </div>
        <span class="cc-priv-text">Camera Recording Map</span>
        <svg class="cc-priv-chevron" width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 1l4 4-4 4"/>
        </svg>
      </div>

      <!-- 状态行 -->
      <div class="cc-status" :class="{ hidden: editing }">
        <div class="cc-status-left">
          <StatusIcons color="#fff" :show-wifi="false" :show-battery="false" :show-signal="true" />
          <span class="cc-vonr">VoNR</span>
          <span class="cc-carrier">Orange</span>
        </div>
        <div class="cc-status-right">
          <span class="cc-battery-pct">86%</span>
          <StatusIcons color="#fff" :show-wifi="false" :show-signal="false" :show-battery="true" />
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
          <div v-if="item.id === 'wifi'" class="cc-pill" @click="!editing && control.toggle('wifi')">
            <svg class="cc-pill-bg-svg" width="100%" height="100%" viewBox="0 0 138 62" preserveAspectRatio="none" fill="none">
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="#A6A6A6" fill-opacity="0.1" style="mix-blend-mode:overlay"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="#494949" fill-opacity="0.5" style="mix-blend-mode:color-dodge"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="white" fill-opacity="0.08"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" stroke="url(#paint0_linear_331_95718)" style="mix-blend-mode:plus-lighter" vector-effect="non-scaling-stroke"/>
            </svg>
            <div class="cc-pill-icon" :style="{ opacity: control.wifi ? 1 : 0.4 }">
              <LIcon name="wifi" :size="38" />
            </div>
            <div class="cc-pill-text">
              <span class="cc-pill-title">Transsion</span>
              <span class="cc-pill-sub">{{ control.wifi ? 'Mobile' : '关闭' }}</span>
            </div>
          </div>

          <!-- 数据胶囊 -->
          <div v-else-if="item.id === 'data'" class="cc-pill" @click="!editing && control.toggle('cellular')">
            <svg class="cc-pill-bg-svg" width="100%" height="100%" viewBox="0 0 138 62" preserveAspectRatio="none" fill="none">
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="#A6A6A6" fill-opacity="0.1" style="mix-blend-mode:overlay"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="#494949" fill-opacity="0.5" style="mix-blend-mode:color-dodge"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="white" fill-opacity="0.08"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" stroke="url(#paint0_linear_331_95718)" style="mix-blend-mode:plus-lighter" vector-effect="non-scaling-stroke"/>
            </svg>
            <div class="cc-pill-icon" :style="{ background: control.cellular ? '#31C65A' : 'rgba(255,255,255,0.2)' }">
              <LIcon name="arrowDownUp" :size="20" />
            </div>
            <div class="cc-pill-text">
              <span class="cc-pill-title">Orange</span>
              <span class="cc-pill-sub">{{ control.cellular ? '102 MB' : '已关闭' }}</span>
            </div>
          </div>

          <!-- 媒体播放器 (2x2 138x138) -->
          <div v-else-if="item.id === 'mediaPlayer'" class="cc-media">
            <svg class="cc-media-bg-svg" width="100%" height="100%" viewBox="0 0 138 138" fill="none">
              <rect x="0.5" y="0.5" width="137" height="137" rx="30.5" stroke="url(#paint0_linear_2860_1301)" vector-effect="non-scaling-stroke" />
            </svg>
            <div class="cc-media-top">
              <img :src="albumCover" alt="Album Cover" class="cc-media-cover" />
              <button class="cc-media-cast" @click.stop="!editing && control.toggle('cast')">
                <LIcon name="radio" :size="15" />
              </button>
            </div>
            <div class="cc-media-info">
              <div class="cc-media-title">Big Big World</div>
              <div class="cc-media-artist">Emilia</div>
            </div>
            <div class="cc-media-btns">
              <button class="cc-mc" @click.stop><LIcon name="skipBack" :size="16" :filled="true" /></button>
              <button class="cc-mc cc-mc-play" @click.stop="!editing && control.toggle('mediaPlaying')">
                <LIcon :name="control.mediaPlaying ? 'pause' : 'play'" :size="20" :filled="true" />
              </button>
              <button class="cc-mc" @click.stop><LIcon name="skipForward" :size="16" :filled="true" /></button>
            </div>
          </div>

          <!-- 亮度 / 音量竖滑块 (2x2 138x138) -->
          <div v-else-if="item.id === 'mediaControls'" class="cc-sliders">
            <div class="cc-vslider" :style="{ boxShadow: glassRing }" @pointerdown="sliderPointer($event, 'brightness')">
              <div class="cc-vslider-fill" :style="{ height: brightnessPct + '%' }"></div>
              <div class="cc-vslider-icon">
                <LIcon name="sun" :size="28" />
              </div>
            </div>
            <div class="cc-vslider" :style="{ boxShadow: glassRing }" @pointerdown="sliderPointer($event, 'volume')">
              <div class="cc-vslider-fill" :style="{ height: volumePct + '%' }"></div>
              <div class="cc-vslider-icon">
                <LIcon name="volume2" :size="28" />
              </div>
            </div>
          </div>

          <!-- OneLeap (2x1) -->
          <div v-else-if="item.id === 'joyConnect'" class="cc-pill" @click="!editing && control.toggle('share')">
            <svg class="cc-pill-bg-svg" width="100%" height="100%" viewBox="0 0 138 62" preserveAspectRatio="none" fill="none">
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="#A6A6A6" fill-opacity="0.1" style="mix-blend-mode:overlay"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="#494949" fill-opacity="0.5" style="mix-blend-mode:color-dodge"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="white" fill-opacity="0.08"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" stroke="url(#paint0_linear_331_95718)" style="mix-blend-mode:plus-lighter" vector-effect="non-scaling-stroke"/>
            </svg>
            <div class="cc-pill-icon">
              <LIcon name="link2" :size="38" />
            </div>
            <div class="cc-pill-text"><span class="cc-pill-title">OneLeap</span></div>
          </div>

          <!-- Health&SPO (2x1) -->
          <div v-else-if="item.id === 'joyHeart'" class="cc-pill">
            <svg class="cc-pill-bg-svg" width="100%" height="100%" viewBox="0 0 138 62" preserveAspectRatio="none" fill="none">
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="#A6A6A6" fill-opacity="0.1" style="mix-blend-mode:overlay"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="#494949" fill-opacity="0.5" style="mix-blend-mode:color-dodge"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="white" fill-opacity="0.08"/>
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" stroke="url(#paint0_linear_331_95718)" style="mix-blend-mode:plus-lighter" vector-effect="non-scaling-stroke"/>
            </svg>
            <div class="cc-pill-icon">
              <LIcon name="heart" :size="38" />
            </div>
            <div class="cc-pill-text"><span class="cc-pill-title">Health&SPO</span></div>
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
  padding: 12px 0 90px;
  will-change: transform, opacity;
}
.cc-scroll::-webkit-scrollbar { display: none; }

/* 头部 */
.cc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 290px;
  margin: 0 auto 6px;
  padding: 0;
  height: 30px;
  position: relative;
  z-index: 20;
}
.cc-header-camera-spacer {
  width: 16px;
  height: 16px;
  pointer-events: none;
}
.cc-header-btn {
  width: 30px;
  height: 30px;
  min-width: 30px;
  min-height: 30px;
  flex: 0 0 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  position: relative;
  z-index: 20;
  overflow: visible;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.cc-header-btn:active {
  transform: scale(0.92);
  opacity: 0.8;
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

/* 隐私指示器胶囊 */
.cc-privacy-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 999px;
  padding: 3px 10px 3px 4px;
  margin: 0 auto 10px;
  width: fit-content;
  color: #fff;
  transition: opacity 0.3s ease;
  user-select: none;
}
.cc-privacy-pill.hidden { opacity: 0; pointer-events: none; }
.cc-priv-dots {
  display: flex;
  align-items: center;
  gap: 3px;
}
.cc-priv-dot {
  width: 17px;
  height: 17px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cc-priv-dot.cc-priv-cam { background: #FAB500; }
.cc-priv-dot.cc-priv-mic { background: #FF4D4F; }
.cc-priv-dot.cc-priv-loc { background: #258FFF; }
.cc-priv-text {
  font: 500 11px/1.2 var(--font-stack);
  letter-spacing: -0.1px;
  color: rgba(255, 255, 255, 0.95);
  margin: 0 1px;
}
.cc-priv-chevron {
  display: block;
}

/* 状态行 */
.cc-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 290px;
  margin: 0 auto 14px;
  padding: 0;
  height: 16px;
  color: rgba(255, 255, 255, 0.95);
  transition: opacity 0.3s ease;
}
.cc-status.hidden { opacity: 0; }
.cc-status-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cc-vonr {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 13px;
  padding: 0 3px;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.2px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  color: #fff;
}
.cc-carrier {
  font: 500 13px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.95);
}
.cc-status-right {
  display: flex;
  align-items: center;
  gap: 5px;
}
.cc-battery-pct {
  font: 600 13px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.95);
}

/* 网格：4 列 × 62px，列距 14px，行距 14px = 290px */
.cc-grid {
  display: grid;
  grid-template-columns: repeat(4, 62px);
  grid-auto-rows: 62px;
  column-gap: 14px;
  row-gap: 14px;
  width: 290px;
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
  border-radius: 31px;
  padding: 0 10px 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(25px) saturate(180%);
  -webkit-backdrop-filter: blur(25px) saturate(180%);
  cursor: pointer;
  overflow: hidden;
  transition: background 0.3s ease;
}
.cc-pill:hover { background: rgba(255, 255, 255, 0.22); }
.cc-pill-bg-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
.cc-pill > *:not(.cc-pill-bg-svg) {
  position: relative;
  z-index: 1;
}
.cc-pill-icon {
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-left: 0;
  transition: background 0.3s ease, opacity 0.3s ease;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
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
  letter-spacing: -0.2px;
  color: rgba(255, 255, 255, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-pill-sub {
  font: 400 11px/1.2 var(--font-stack);
  color: rgba(255, 255, 255, 0.65);
  margin-top: 2px;
}
.cc-heart-text {
  font: 400 10px/1.3 var(--font-stack);
  color: rgba(255, 255, 255, 0.8);
  gap: 2px;
}

/* 媒体播放器 (2x2 138x138) */
.cc-media {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 31px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: radial-gradient(ellipse at 50% 100%, rgba(255, 113, 30, 0.45) 0%, rgba(255, 113, 30, 0.2) 35%, rgba(255, 113, 30, 0) 75%), rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(25px) saturate(180%);
  -webkit-backdrop-filter: blur(25px) saturate(180%);
  overflow: hidden;
}
.cc-media-bg-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
.cc-media > *:not(.cc-media-bg-svg) {
  position: relative;
  z-index: 1;
}
.cc-media-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.cc-media-cover {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: cover;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}
.cc-media-cast {
  width: 28px;
  height: 28px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.16);
  border: 0.5px solid rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}
.cc-media-cast:hover {
  background: rgba(255, 255, 255, 0.25);
}
.cc-media-info {
  display: flex;
  flex-direction: column;
  margin-top: 4px;
}
.cc-media-title {
  font: 600 13px/1.2 var(--font-stack);
  color: #fff;
  letter-spacing: 0.2px;
}
.cc-media-artist {
  font: 400 11px/1.2 var(--font-stack);
  color: rgba(255, 255, 255, 0.75);
  margin-top: 2px;
}
.cc-media-btns {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  margin-top: 4px;
}
.cc-mc {
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.2s ease;
}
.cc-mc:active {
  transform: scale(0.9);
}

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
  border-radius: 31px;
  background: rgba(255, 255, 255, 0.16);
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
  bottom: 18px;
  left: 0; right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

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
