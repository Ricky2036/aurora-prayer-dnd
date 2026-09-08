<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSystemStore } from '../../stores/systemStore'
import { useControlStore, LAYOUT_PRESETS, PRESET_EXCLUSIVE_IDS } from '../../stores/controlStore'
import { useI18nStore } from '../../stores/i18nStore'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { useCapture } from '../../composables/useCapture'
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
const i18n = useI18nStore()

const overlay = computed(() => system.overlays.controlCenter)
const visible = computed(() => overlay.value.status !== 'closed')

// 状态栏指示器：勿扰/热点/静音/振动 启用后，在控制中心状态行也点亮（与开关按钮同源 LIcon）
const dndOn = computed(() => control.dnd || control.doNotDisturb)

const layerStyle = computed(() => ({
  transform: `translateY(${(overlay.value.progress - 1) * 100}%)`,
  visibility: visible.value ? 'visible' : 'hidden',
  pointerEvents: visible.value ? 'auto' : 'none'
}))
/** 宫格整体缩放：派生尺寸一次性下发成 CSS 变量，
 *  模板与样式里不再出现任何 62 / 14 / 290 的硬编码。
 *  --cc-k 是纯倍率，给那些「按 62 时代手工量出来的固定像素」做等比换算用
 *  （例如 .gb-row 的 padding-left: 12px —— 原本 12+38+12=62 恰好居中，
 *    放大后 12 不变就会偏，必须跟着放大）。 */
const gridVars = computed(() => ({
  '--cc-k': control.gridScale,
  '--cc-cell': `${control.cellSize}px`,
  '--cc-gap': `${control.gridGap}px`,
  '--cc-pitch': `${control.cellPitch}px`,
  '--cc-grid-w': `${control.gridWidth}px`
}))
const blurStyle = computed(() => ({ opacity: clamp(overlay.value.progress * 1.2, 0, 1) }))
const contentStyle = computed(() => ({
  transform: `translateY(${(1 - overlay.value.progress) * 26}px)`,
  opacity: clamp(overlay.value.progress * 1.5, 0, 1)
}))

const scrollRef = ref(null)
const rootRef = ref(null)

/* ---- 溢出检测：仅在内容溢出时允许滚动 ---- */
const hasOverflow = ref(false)

function checkOverflow() {
  if (!scrollRef.value) return
  // scrollHeight 比 clientHeight 多出 4px 以上判定为溢出
  hasOverflow.value = scrollRef.value.scrollHeight > scrollRef.value.clientHeight + 4
}

let resizeObs = null
onMounted(() => {
  nextTick(() => {
    checkOverflow()
    if (scrollRef.value && typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => checkOverflow())
      resizeObs.observe(scrollRef.value)
    }
    if (scrollRef.value) {
      // 唯一的 wheel 监听。必须显式 { passive: false }，否则 preventDefault() 会被忽略。
      // 模板上不要再写 @wheel：根元素与 .cc-scroll 曾各写一次，
      // 叠加这里导致一次滚轮触发 3 次 requestCloseOverlay，关闭动画跳变。
      scrollRef.value.addEventListener('wheel', onCcWheel, { passive: false })
    }
  })
  window.addEventListener('resize', checkOverflow)
})

onBeforeUnmount(() => {
  if (resizeObs) resizeObs.disconnect()
  if (scrollRef.value) {
    scrollRef.value.removeEventListener('wheel', onCcWheel)
  }
  window.removeEventListener('resize', checkOverflow)
  window.removeEventListener('pointermove', onWindowPointerMove, true)
  window.removeEventListener('pointerup', onWindowPointerUp, true)
  window.removeEventListener('pointercancel', onWindowPointerUp, true)

  // ---- 其余残留资源：这些只在卸载瞬间生效，不影响任何正常路径 ----
  // 伸缩手柄：pointerup 用 { once: true }，若卸载前未抬起则监听残留
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  resizeState = null

  // 滑块拖拽
  if (sliderMoveHandler) {
    window.removeEventListener('pointermove', sliderMoveHandler)
    sliderMoveHandler = null
  }
  if (sliderUpHandler) {
    window.removeEventListener('pointerup', sliderUpHandler)
    sliderUpHandler = null
  }

  // 定时器
  if (interactTimer) { clearTimeout(interactTimer); interactTimer = null }
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
  if (dragStartTimer) { clearTimeout(dragStartTimer); dragStartTimer = null }
})


watch(() => overlay.value.status, (status) => {
  if (status === 'opening' || status === 'opened') {
    nextTick(() => {
      if (scrollRef.value) scrollRef.value.scrollTop = 0
      checkOverflow()
    })
  }
})

/* 宫格整体缩放会改变内容高度，但 ResizeObserver 只盯着 .cc-scroll 自身的盒子
   （它恒为 100% 高，不会变），所以必须主动复检，否则溢出状态不刷新、
   滚动与上滑关闭手势会错乱。 */
watch(() => [control.gridScale, control.editing], () => {
  nextTick(checkOverflow)
})

let isInteracting = false
let interactTimer = null
let dragStartTimer = null // onDragStart 的 setTimeout(0)，卸载时需清掉
function markInteracting() {
  isInteracting = true
  if (interactTimer) clearTimeout(interactTimer)
  interactTimer = setTimeout(() => {
    isInteracting = false
  }, 350)
}

/* ---- 未溢出时上滑关闭：图标位置不变，收起控制中心面板 ---- */
let touchStartY = 0
let touchStartX = 0
let touchStartTime = 0
let isTrackingSwipe = false

function onCcPointerDown(e) {
  if (e.button != null && e.button !== 0) return
  if (control.fineTuningMode || editing.value) return

  // 点击/触摸在任何可交互元素（网格、开关、胶囊、媒体、滑块等）上时，严禁触发上滑关闭手势检测
  if (e.target.closest('.cc-grid, .cc-cell, .gb-wrap, .cc-pill, .cc-media, .cc-sliders, .cc-header, button, input, a, .ft-hud')) {
    return
  }

  touchStartY = e.clientY
  touchStartX = e.clientX
  touchStartTime = Date.now()
  isTrackingSwipe = true

  window.addEventListener('pointermove', onWindowPointerMove, true)
  window.addEventListener('pointerup', onWindowPointerUp, true)
  window.addEventListener('pointercancel', onWindowPointerUp, true)
}

function onWindowPointerMove(e) {
  if (!isTrackingSwipe) return
  if (hasOverflow.value) return
  // 未溢出时：图标位置绝对不变，不跟随手指位移拖拽
}

function onWindowPointerUp(e) {
  if (!isTrackingSwipe) return
  isTrackingSwipe = false

  window.removeEventListener('pointermove', onWindowPointerMove, true)
  window.removeEventListener('pointerup', onWindowPointerUp, true)
  window.removeEventListener('pointercancel', onWindowPointerUp, true)

  const deltaY = e.clientY - touchStartY
  const deltaX = e.clientX - touchStartX
  const dt = Math.max(1, Date.now() - touchStartTime)
  const velocityY = Math.abs(deltaY) / dt

  touchStartY = 0
  touchStartX = 0

  // 仅在未溢出时响应上滑收起控制面板（溢出时由正常上下滚动接管）
  if (hasOverflow.value) return

  // 检测上滑手势：向上位移 > 20px 或 快速向上轻扫
  if ((deltaY < -20 || (deltaY < -10 && velocityY > 0.25)) && Math.abs(deltaY) > Math.abs(deltaX) * 0.8) {
    markInteracting()
    system.requestCloseOverlay('controlCenter')
  }
}

function onCcWheel(e) {
  if (control.fineTuningMode || editing.value) return

  // 溢出时：允许正常上下滚动，不拦截
  if (hasOverflow.value) return

  // 未溢出时：严禁任何上下滚动与橡皮筋回弹
  e.preventDefault()

  // 检测触控板双指上滑手势（向上轻扫）
  // Mac 触控板自然滚动：双指向上推时 deltaY > 0；经典向上滚动：deltaY < 0
  if (Math.abs(e.deltaY) > 12 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    markInteracting()
    system.requestCloseOverlay('controlCenter')
  }
}

function onCcClick(e) {
  // 微调模式下不关闭控制中心面板
  if (control.fineTuningMode) {
    return
  }
  // 编辑模式下点空白区退出编辑模式（防误触：拖拽/伸缩期间及网格内部点击均不退出）
  if (editing.value) {
    if (isInteracting || resizingId.value || dragState.value) return
    if (e.target.closest('.cc-grid, .cc-cell, .gb-wrap, .cc-header, .cc-header-btn, .cc-header-edit-bar, .cc-header-svg-btn, .cc-edit-group, .cc-pill, .cc-media, .cc-sliders')) {
      return
    }
    control.setEditing(false)
    return
  }
  // 点击卡片、胶囊、按钮、滑块等交互元素时不退出
  if (e.target.closest('.cc-cell, .cc-header-btn, .cc-header-edit-bar, .cc-header-svg-btn, .cc-pill, .cc-media, .cc-sliders, .cc-vslider, .gb-wrap, .cc-grid-btn, .cc-icon-btn, .cc-edit-group, button, a, input, label, .ft-hud')) {
    return
  }
  // 网格容器不整体拦截：命中砖块（含半个间隙容差）视为交互；
  // 落在真正的空白区（如最后一行右侧的空格）则退出控制中心
  if (e.target.closest('.cc-grid') && gridRef.value) {
    const GRID_PAD = 7 // 列/行间隙 14px 的一半：轻微点偏不误判为空白
    const x = e.clientX
    const y = e.clientY
    const nearCell = [...gridRef.value.querySelectorAll('.cc-cell')].some((cell) => {
      const r = cell.getBoundingClientRect()
      return x >= r.left - GRID_PAD && x <= r.right + GRID_PAD && y >= r.top - GRID_PAD && y <= r.bottom + GRID_PAD
    })
    if (nearCell) return
  }
  system.requestCloseOverlay('controlCenter')
}

function onPillClick(e, id) {
  e.stopPropagation()
  if (control.fineTuningMode) {
    e.preventDefault()
    control.selectTarget(id, 'icon')
    return
  }
  if (editing.value) return
  if (id === 'wifi') control.toggle('wifi')
  else if (id === 'data') control.toggle('cellular')
  else if (id === 'oneLeap') control.toggle('share')
}

/* ================= 网格配置 ================= */

const TOGGLES = [
  { id: 'bluetooth', icon: 'bluetooth', activeBg: '#fff', activeColor: '#258FFF', defaultSize: '1x1', hasBadge: true },
  { id: 'hotspot', icon: 'radio', activeBg: '#fff', activeColor: '#258FFF' },
  { id: 'airplane', icon: 'plane', activeBg: '#fff', activeColor: '#258FFF' },
  { id: 'location', icon: 'mapPin', fillOnActive: true, activeBg: '#fff', activeColor: '#258FFF' },
  { id: 'screenshot', icon: 'scissors', activeBg: '#fff', activeColor: '#258FFF' },
  { id: 'darkMode', icon: 'darkTheme', activeBg: '#fff', activeColor: '#258FFF', defaultSize: '1x1' },
  { id: 'dnd', icon: 'moon', fillOnActive: true, activeBg: '#fff', activeColor: '#258FFF' },
  { id: 'sound', icon: 'bell', fillOnActive: false, activeBg: '#fff', activeColor: '#258FFF', defaultSize: '1x1' },
  { id: 'rotationLock', icon: 'rotationLock', activeBg: '#fff', activeColor: '#FF3B30' },
  { id: 'screenRecord', icon: 'video', fillOnActive: true, activeBg: '#fff', activeColor: '#FF4942' },
  { id: 'batterySaver', icon: 'battery', activeBg: '#fff', activeColor: '#EBB800' },
  { id: 'autoRotate', icon: 'autoRotate', activeBg: '#fff', activeColor: '#258FFF' },
  { id: 'share', icon: 'quickShare', activeBg: '#fff', activeColor: '#258FFF' },
  { id: 'cast', icon: 'cast', activeBg: '#fff', activeColor: '#258FFF' },
  { id: 'flashlight', icon: 'flashlight', activeBg: '#fff', activeColor: '#FBB500' },
  // id 保留 calculator：控制中心状态、微调尺寸(31)、点击打开的应用全部按此 id 串联
  { id: 'calculator', icon: 'wallet', activeBg: '#fff', activeColor: '#258FFF' },
  { id: 'scan', icon: 'scan', activeBg: '#fff', activeColor: '#258FFF' },
  { id: 'boost', icon: 'zap', activeBg: '#fff', activeColor: '#258FFF' },
  // 关闭态用带斜杠的 motionComfortOff，开启态才是纯点阵 motionComfort
  { id: 'motionComfort', icon: 'motionComfort', iconOff: 'motionComfortOff', activeBg: '#fff', activeColor: '#1A88FF' },
  { id: 'liquidCooling', icon: 'liquidCooling', activeBg: '#fff', activeColor: '#1A88FF' },
  { id: 'shoulderKey', icon: 'shoulderKey', activeBg: '#fff', activeColor: '#258FFF' },
  // 已从默认布局下线（Ricky 2026-09-08）：定义保留，方便以后一键恢复。
  // 恢复方式 = 同时做两件事：把 'jbl' 加回下面的 DEFAULT_TOGGLE_IDS，
  //   并把 'jbl' 加回 controlStore 里 NOTE 的 only —— 只加一处不会生效。
  { id: 'jbl', icon: 'jbl', activeBg: '#fff', activeColor: '#258FFF' }
]

const DEFAULT_TOGGLE_IDS = [
  'flashlight', 'sound',
  'bluetooth', 'hotspot', 'airplane', 'location',
  'screenshot', 'darkMode', 'dnd', 'rotationLock',
  'screenRecord', 'batterySaver', 'autoRotate', 'share',
  'cast', 'boost', 'calculator', 'scan',
  'motionComfort', 'liquidCooling', 'shoulderKey'
  // 'jbl' 已下线：见上面 TOGGLES 里的 jbl 注释（两个地方要一起改）
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

/* 按当前「默认布局」机型过滤掉别家独有的磁贴：
   baseItems 是全量清单，PRESET_EXCLUSIVE_IDS 里的条目只有命中该机型的 only 才留下 */
const presetItems = computed(() => {
  const preset = LAYOUT_PRESETS.find((p) => p.id === control.layoutPreset) || LAYOUT_PRESETS[0]
  const only = new Set(preset.only)
  return baseItems.filter((i) => !PRESET_EXCLUSIVE_IDS.includes(i.id) || only.has(i.id))
})

const layout = ref(packLayout(presetItems.value))

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
    checkOverflow()
  },
  { flush: 'post' }
)

function onDragStart(e, id) {
  if (!editing.value) { e.preventDefault(); return }
  markInteracting()
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
  if (dragStartTimer) clearTimeout(dragStartTimer)
  dragStartTimer = setTimeout(() => {
    dragStartTimer = null
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

  // 步距 = 格子 + 间距，随整体缩放变化，不能写死 76
  const pitch = control.cellPitch
  let c = Math.floor(x / pitch)
  let r = Math.floor(y / pitch)
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
  markInteracting()
  if (dragState.value) {
    recordPositions(gridRef.value, flipStore)
    layout.value = displayLayout.value
    dragState.value = null
    clearTimeout(hoverTimer)
    if (dragStartTimer) { clearTimeout(dragStartTimer); dragStartTimer = null }
    // 落位后补一次 FLIP（覆盖 flow 吸附等推演与落位不一致的边缘情况）
    nextTick(() => applyFlip(gridRef.value, flipStore))
  }
}

function onDragEnd() {
  markInteracting()
  if (dragState.value) {
    recordPositions(gridRef.value, flipStore)
    dragState.value = null
    clearTimeout(hoverTimer)
    if (dragStartTimer) { clearTimeout(dragStartTimer); dragStartTimer = null }
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
  layout.value = packLayout(presetItems.value)
}

/* 控制台切换默认布局：先记下旧位置，重排后由 FLIP 补间把磁贴平移过去 */
watch(presetItems, (items) => {
  recordPositions(gridRef.value, flipStore)
  layout.value = packLayout(items)
})

/* ---- 伸缩手柄：1x1 ↔ 2x1（仅 toggle） ---- */

let resizeState = null

function onResizeStart(e, id) {
  markInteracting()
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
  // 一整格的距离（格子 + 间距）与判定阈值都随整体缩放走
  const pitch = control.cellPitch
  const THRESH = pitch / 2
  if (resizeState.initialSize === '1x1') {
    resizeState.delta = clamp(deltaX, 0, pitch)
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
    resizeState.delta = clamp(deltaX, -pitch, 0)
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
  markInteracting()
  window.removeEventListener('pointermove', onResizeMove)
  if (resizeState && Math.abs(resizeState.delta) < 5) {
    const want = resizeState.initialSize === '1x1' ? '2x1' : '1x1'
    recordPositions(gridRef.value, flipStore)
    const [w, h] = want.split('x').map(Number)
    layout.value = packLayout(layout.value.map((t) =>
      t.id === resizeState.id ? { ...t, size: want, w, h } : t
    ))
  }
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
  if (id === 'calculator') {
    system.closeOverlay('controlCenter')
    system.openApp('calculator')
    return
  }
  if (id === 'screenRecord') {
    // 录屏期间再次点击 = 停止并保存（MP4，不带壳、不裁圆角、不转码）
    void toggleScreenRecord()
    return
  }
  if (id === 'screenshot') {
    void takeScreenshot()
    return
  }
  if (id === 'sound') return // 由 GridButton 内部 cycleSoundMode 处理
  control.toggle(id)
}

/* ================= 录屏 / 截图（复用控制台同一套能力） ================= */

const capture = useCapture()

/** 等控制中心收起动画播完（status 由 closing → closed），避免把收起过程录进去 */
function waitOverlayClosed(timeout = 800) {
  return new Promise((resolve) => {
    const cc = system.overlays.controlCenter
    if (!cc || cc.status === 'closed') {
      resolve()
      return
    }
    const started = Date.now()
    const tick = () => {
      if (!system.overlays.controlCenter || system.overlays.controlCenter.status === 'closed' || Date.now() - started > timeout) {
        resolve()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

/** 收起动画结束后再补一帧，确保画面已经重绘 */
function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

/* 关键：收起控制中心是同步调用，紧接着（同一 tick）就发起采集。
   getDisplayMedia 依赖浏览器「用户手势」，中间不能插 await，
   否则部分浏览器会直接静默拒绝 —— 表现就是点了完全没反应。 */
async function toggleScreenRecord() {
  if (capture.isRecording.value) {
    capture.stopRecording()
    return
  }
  system.requestCloseOverlay('controlCenter')
  // 不带金属外壳、不做圆角裁切、直出 MP4 不转码
  await capture.startRecording({
    withFrame: false,
    rounded: false,
    transcode: false,
    preferMp4: true,
    beforeStart: async () => {
      await waitOverlayClosed()
      await nextPaint()
    }
  })
}

async function takeScreenshot() {
  control.setFlag('screenshot', true)
  system.requestCloseOverlay('controlCenter')
  await capture.captureScreenshot({
    withFrame: false,
    beforeGrab: async () => {
      await waitOverlayClosed()
      await nextPaint()
    }
  })
  control.setFlag('screenshot', false)
}

/* 控制中心「录屏」按钮的高亮必须跟随真实录制状态：
   从控制台开始/停止录屏时，按钮也要同步点亮/熄灭 */
watch(
  () => capture.isRecording.value,
  (v) => control.setFlag('screenRecord', v),
  { immediate: true }
)

/* ================= 竖向滑块（亮度/音量） ================= */

/* 滑块拖拽的 window 监听句柄提升到组件作用域，卸载时可精确摘除 */
let sliderMoveHandler = null
let sliderUpHandler = null

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

  // 上一次拖拽若未正常结束（多指 / 组件被切走），先摘掉残留监听
  if (sliderMoveHandler) window.removeEventListener('pointermove', sliderMoveHandler)
  if (sliderUpHandler) window.removeEventListener('pointerup', sliderUpHandler)

  sliderMoveHandler = (ev) => setFromEvent(ev)
  sliderUpHandler = () => {
    window.removeEventListener('pointermove', sliderMoveHandler)
    sliderMoveHandler = null
    sliderUpHandler = null
  }
  window.addEventListener('pointermove', sliderMoveHandler)
  window.addEventListener('pointerup', sliderUpHandler, { once: true })
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

/** 伸缩中的实时宽度：1x1 = 一格，2x1 = 两格 + 一个间距 */
function toggleWidth(item) {
  const one = control.cellSize
  const two = control.cellSize * 2 + control.gridGap
  const base = item.size === '2x1' ? two : one
  if (resizingId.value === item.id && resizeState) {
    return (resizeState.initialSize === '2x1' ? two : one) + resizeState.delta
  }
  return base
}

function openSettings() {
  system.closeOverlay('controlCenter')
  system.openApp('settings')
}

function onHeaderBtnClick(target) {
  if (control.fineTuningMode) {
    control.selectTarget(target, 'icon')
    return
  }
  if (target === 'headerEdit') {
    control.setEditing(true)
  } else if (target === 'headerSettings') {
    openSettings()
  }
}

function onMediaCastClick(e) {
  if (control.fineTuningMode) {
    e.preventDefault()
    control.selectTarget('mediaCast', 'icon')
    return
  }
  if (!editing.value) {
    control.toggle('cast')
  }
}

const glassRing = computed(() =>
  editing.value
    ? 'inset 0 0 0 1px rgba(255,255,255,0.4)'
    : 'inset 0 0 0 1px rgba(255,255,255,0.2)'
)
</script>

<template>
  <div ref="rootRef" class="control-center" :style="[layerStyle, gridVars]" @click="onCcClick" @pointerdown="onCcPointerDown">
    <!-- 动态高斯模糊与材质混色底 -->
    <MaterialBlur />

    <!-- 全局控制中心渐变滤镜定义 -->
    <svg width="0" height="0" style="position: absolute; pointer-events: none">
      <defs>
        <linearGradient id="paint0_linear_2860_1301" x1="17.5" y1="0" x2="16.9972" y2="61.7832" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.8"/>
          <stop offset="0.3" stop-color="white" stop-opacity="0.2"/>
          <stop offset="0.7" stop-color="white" stop-opacity="0.2"/>
          <stop offset="1" stop-color="white" stop-opacity="0.5"/>
        </linearGradient>
        <linearGradient id="paint0_linear_331_95718" x1="38.9516" y1="0" x2="38.7257" y2="61.7864" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.8"/>
          <stop offset="0.3" stop-color="white" stop-opacity="0.2"/>
          <stop offset="0.7" stop-color="white" stop-opacity="0.2"/>
          <stop offset="1" stop-color="white" stop-opacity="0.5"/>
        </linearGradient>
        <linearGradient id="paint0_linear_2865_138" x1="17.5" y1="0" x2="16.9972" y2="137.783" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.8"/>
          <stop offset="0.3" stop-color="white" stop-opacity="0.2"/>
          <stop offset="0.7" stop-color="white" stop-opacity="0.2"/>
          <stop offset="1" stop-color="white" stop-opacity="0.5"/>
        </linearGradient>
      </defs>
    </svg>

    <!-- 内容层：顶部固定区 + 网格滚动区（入场动画作用于整层，二者同步淡入/位移） -->
    <div class="cc-content" :style="contentStyle">
      <!-- 顶部固定区：状态栏（运营商/信号/电池）+ 编辑/设置按钮位置固定。
           内容溢出滚动时裁切线固定在状态栏下方，网格不会把它们带走 -->
      <div class="cc-fixed-top">
      <!-- 头部：常规模式 (编辑 / 设置) -->
      <div v-if="!editing" class="cc-header">
        <button
          class="cc-header-btn"
          :class="{
            'ft-selectable': control.fineTuningMode,
            'ft-selected': control.fineTuningMode && control.selectedTarget === 'headerEdit'
          }"
          :style="{
            width: control.getBgSize('headerEdit') + 'px',
            height: control.getBgSize('headerEdit') + 'px',
            minWidth: control.getBgSize('headerEdit') + 'px',
            minHeight: control.getBgSize('headerEdit') + 'px',
            flex: `0 0 ${control.getBgSize('headerEdit')}px`
          }"
          @click.stop="onHeaderBtnClick('headerEdit')"
          :title="i18n.t('edit')"
        >
          <LIcon name="headerEdit" :size="control.getIconSize('headerEdit')" />
        </button>
        <div class="cc-header-camera-spacer"></div>
        <button
          class="cc-header-btn"
          :class="{
            'ft-selectable': control.fineTuningMode,
            'ft-selected': control.fineTuningMode && control.selectedTarget === 'headerSettings'
          }"
          :style="{
            width: control.getBgSize('headerSettings') + 'px',
            height: control.getBgSize('headerSettings') + 'px',
            minWidth: control.getBgSize('headerSettings') + 'px',
            minHeight: control.getBgSize('headerSettings') + 'px',
            flex: `0 0 ${control.getBgSize('headerSettings')}px`
          }"
          @click.stop="onHeaderBtnClick('headerSettings')"
          :title="i18n.t('settings')"
        >
          <LIcon name="headerSettings" :size="control.getIconSize('headerSettings')" />
        </button>
      </div>

      <!-- 头部：编辑模式顶栏 (设计稿原生矢量 360x56) -->
      <div v-else class="cc-header-edit-bar">
        <svg class="cc-header-edit-svg" width="360" height="56" viewBox="0 0 360 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- 左侧：重置 Plus 按钮 -->
          <g class="cc-header-svg-btn" @click.stop="resetLayout" role="button" :title="i18n.t('reset')">
            <rect x="35.5" y="6.5" width="43" height="43" rx="21.5" fill="white" fill-opacity="0.15" style="mix-blend-mode:overlay"/>
            <rect x="35.5" y="6.5" width="43" height="43" rx="21.5" fill="white" fill-opacity="0.05" style="mix-blend-mode:lighten"/>
            <rect x="35.5" y="6.5" width="43" height="43" rx="21.5" stroke="url(#paint0_linear_0_1)" style="mix-blend-mode:plus-lighter"/>
            <path d="M57 6.5C68.8741 6.5 78.5 16.1259 78.5 28C78.5 39.8741 68.8741 49.5 57 49.5C45.1259 49.5 35.5 39.8741 35.5 28C35.5 16.1259 45.1259 6.5 57 6.5Z" stroke="url(#paint1_linear_0_1)" style="mix-blend-mode:plus-lighter"/>
            <path d="M57 6.5C68.8741 6.5 78.5 16.1259 78.5 28C78.5 39.8741 68.8741 49.5 57 49.5C45.1259 49.5 35.5 39.8741 35.5 28C35.5 16.1259 45.1259 6.5 57 6.5Z" stroke="url(#paint2_linear_0_1)" style="mix-blend-mode:plus-lighter"/>
            <path d="M57 18.5859C57.25 18.5859 57.4609 18.6797 57.6328 18.8672C57.8203 19.0391 57.9141 19.25 57.9141 19.5V27.5859H66C66.25 27.5859 66.4609 27.6797 66.6328 27.8672C66.8203 28.0391 66.9141 28.25 66.9141 28.5C66.9141 28.75 66.8203 28.9688 66.6328 29.1562C66.4609 29.3281 66.25 29.4141 66 29.4141H57.9141V37.5C57.9141 37.75 57.8203 37.9688 57.6328 38.1562C57.4609 38.3281 57.25 38.4141 57 38.4141C56.75 38.4141 56.5312 38.3281 56.3438 38.1562C56.1719 37.9688 56.0859 37.75 56.0859 37.5V29.4141H48C47.75 29.4141 47.5312 29.3281 47.3438 29.1562C47.1719 28.9688 47.0859 28.75 47.0859 28.5C47.0859 28.25 47.1719 28.0391 47.3438 27.8672C47.5312 27.6797 47.75 27.5859 48 27.5859H56.0859V19.5C56.0859 19.25 56.1719 19.0391 56.3438 18.8672C56.5312 18.6797 56.75 18.5859 57 18.5859Z" fill="white"/>
          </g>

          <!-- 右侧：胶囊容器底板 -->
          <g>
            <rect x="221.5" y="6.5" width="103" height="43" rx="21.5" fill="white" fill-opacity="0.15" style="mix-blend-mode:overlay"/>
            <rect x="221.5" y="6.5" width="103" height="43" rx="21.5" fill="white" fill-opacity="0.05" style="mix-blend-mode:lighten"/>
            <rect x="221.5" y="6.5" width="103" height="43" rx="21.5" stroke="url(#paint3_linear_0_1)" style="mix-blend-mode:plus-lighter"/>
            <path d="M243 6.5H303C314.874 6.5 324.5 16.1259 324.5 28C324.5 39.8741 314.874 49.5 303 49.5H243C231.126 49.5 221.5 39.8741 221.5 28C221.5 16.1259 231.126 6.5 243 6.5Z" stroke="url(#paint4_linear_0_1)" style="mix-blend-mode:plus-lighter"/>
            <path d="M243 6.5H303C314.874 6.5 324.5 16.1259 324.5 28C324.5 39.8741 314.874 49.5 303 49.5H243C231.126 49.5 221.5 39.8741 221.5 28C221.5 16.1259 231.126 6.5 243 6.5Z" stroke="url(#paint5_linear_0_1)" style="mix-blend-mode:plus-lighter"/>
          </g>

          <!-- 右侧：设置/滑块微调按钮 (左半胶囊) -->
          <g
            class="cc-header-svg-btn"
            :class="{ active: control.fineTuningMode }"
            @click.stop="control.setFineTuningMode(!control.fineTuningMode)"
            role="button"
            :title="i18n.t('fineTuneTitle')"
          >
            <rect x="221.5" y="6.5" width="51.5" height="43" rx="21.5" fill="transparent" />
            <path d="M248.511 22.7C248.423 22.969 248.375 23.2521 248.375 23.5447C248.375 23.8377 248.424 24.1211 248.512 24.3904H240.47C240.003 24.3903 239.625 24.0113 239.625 23.5447C239.625 23.0783 240.003 22.7002 240.47 22.7H248.511ZM257.53 22.7C257.997 22.7002 258.375 23.0783 258.375 23.5447C258.375 24.0113 257.997 24.3903 257.53 24.3904H255.738C255.826 24.1211 255.875 23.8377 255.875 23.5447C255.875 23.2521 255.827 22.969 255.739 22.7H257.53Z" fill="white"/>
            <path d="M255.075 23.55C255.075 21.9207 253.754 20.5998 252.125 20.5998C250.496 20.5998 249.175 21.9207 249.175 23.55C249.175 25.1792 250.496 26.5002 252.125 26.5002C253.754 26.5002 255.075 25.1792 255.075 23.55ZM256.675 23.55C256.675 26.0629 254.638 28.0998 252.125 28.0998C249.612 28.0998 247.575 26.0629 247.575 23.55C247.575 21.0371 249.612 19.0002 252.125 19.0002C254.638 19.0002 256.675 21.0371 256.675 23.55Z" fill="white"/>
            <path d="M248.825 32.45C248.825 30.8208 247.504 29.4998 245.875 29.4998C244.246 29.4998 242.925 30.8208 242.925 32.45C242.925 34.0793 244.246 35.4002 245.875 35.4002C247.504 35.4002 248.825 34.0793 248.825 32.45ZM250.425 32.45C250.425 34.9629 248.388 36.9998 245.875 36.9998C243.362 36.9998 241.325 34.9629 241.325 32.45C241.325 29.9371 243.362 27.9002 245.875 27.9002C248.388 27.9002 250.425 29.9371 250.425 32.45Z" fill="white"/>
            <path d="M242.261 31.6003C242.173 31.9186 242.125 32.254 242.125 32.6003C242.125 32.8359 242.148 33.0662 242.189 33.2897H240.47C240.003 33.2896 239.625 32.9116 239.625 32.445C239.625 31.9784 240.003 31.6004 240.47 31.6003H242.261ZM257.53 31.6003C257.997 31.6004 258.375 31.9784 258.375 32.445C258.375 32.9116 257.997 33.2896 257.53 33.2897H249.561C249.602 33.0662 249.625 32.8359 249.625 32.6003C249.625 32.254 249.577 31.9186 249.489 31.6003H257.53Z" fill="white"/>
          </g>

          <!-- 右侧：完成 Checkmark 按钮 (右半胶囊) -->
          <g
            class="cc-header-svg-btn"
            @click.stop="control.setEditing(false)"
            role="button"
            :title="i18n.t('done')"
          >
            <rect x="273" y="6.5" width="51.5" height="43" rx="21.5" fill="transparent" />
            <path d="M306.391 21.5156C306.594 21.3125 306.828 21.2109 307.094 21.2109C307.375 21.2109 307.617 21.3125 307.82 21.5156C308.008 21.7031 308.102 21.9375 308.102 22.2188C308.102 22.5 308.008 22.7344 307.82 22.9219L295.094 35.6484C294.641 36.1016 294.086 36.3281 293.43 36.3281C292.789 36.3281 292.242 36.1016 291.789 35.6484L285.648 29.5312C285.461 29.3281 285.367 29.0938 285.367 28.8281C285.367 28.5469 285.461 28.3047 285.648 28.1016C285.852 27.9141 286.086 27.8203 286.352 27.8203C286.633 27.8203 286.875 27.9141 287.078 28.1016L293.195 34.2422C293.258 34.3047 293.336 34.3359 293.43 34.3359C293.523 34.3359 293.602 34.3047 293.664 34.2422L306.391 21.5156Z" fill="white"/>
          </g>

          <defs>
            <linearGradient id="paint0_linear_0_1" x1="42.3333" y1="12.9667" x2="72.0333" y2="43.7667" gradientUnits="userSpaceOnUse">
              <stop stop-color="white" stop-opacity="0.2"/>
              <stop offset="0.5" stop-color="white" stop-opacity="0.05"/>
              <stop offset="1" stop-color="white" stop-opacity="0.2"/>
            </linearGradient>
            <linearGradient id="paint1_linear_0_1" x1="46.3548" y1="9.19355" x2="67.6452" y2="46.8064" gradientUnits="userSpaceOnUse">
              <stop stop-color="white" stop-opacity="0.05"/>
              <stop offset="0.5" stop-color="white" stop-opacity="0"/>
              <stop offset="1" stop-color="white" stop-opacity="0.05"/>
            </linearGradient>
            <linearGradient id="paint2_linear_0_1" x1="46.3551" y1="9.39345" x2="68" y2="46.8065" gradientUnits="userSpaceOnUse">
              <stop stop-color="white" stop-opacity="0.2"/>
              <stop offset="0.3" stop-color="white" stop-opacity="0"/>
              <stop offset="0.7" stop-color="white" stop-opacity="0"/>
              <stop offset="1" stop-color="white" stop-opacity="0.1"/>
            </linearGradient>
            <linearGradient id="paint3_linear_0_1" x1="238.333" y1="12.9667" x2="259.123" y2="63.9247" gradientUnits="userSpaceOnUse">
              <stop stop-color="white" stop-opacity="0.2"/>
              <stop offset="0.5" stop-color="white" stop-opacity="0.05"/>
              <stop offset="1" stop-color="white" stop-opacity="0.2"/>
            </linearGradient>
            <linearGradient id="paint4_linear_0_1" x1="247.839" y1="9.19355" x2="259.087" y2="56.1639" gradientUnits="userSpaceOnUse">
              <stop stop-color="white" stop-opacity="0.05"/>
              <stop offset="0.5" stop-color="white" stop-opacity="0"/>
              <stop offset="1" stop-color="white" stop-opacity="0.05"/>
            </linearGradient>
            <linearGradient id="paint5_linear_0_1" x1="247.839" y1="9.39345" x2="259.371" y2="56.5064" gradientUnits="userSpaceOnUse">
              <stop stop-color="white" stop-opacity="0.2"/>
              <stop offset="0.3" stop-color="white" stop-opacity="0"/>
              <stop offset="0.7" stop-color="white" stop-opacity="0"/>
              <stop offset="1" stop-color="white" stop-opacity="0.1"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <!-- 隐私指示器区域（固定高度，避免布局跳变） -->
      <div class="cc-privacy-area" :class="{ hidden: editing }">
        <div v-if="control.showPrivacyIndicators" class="cc-privacy-pill">
          <div class="cc-priv-dots">
            <!-- 相机 -->
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="16" height="16" rx="8" fill="#EBB800"/>
              <path d="M8.88525 3.62502C8.93387 3.63196 8.979 3.63544 9.02067 3.63544C9.06928 3.63544 9.11789 3.64238 9.1665 3.65627C9.21512 3.67016 9.26025 3.68752 9.30192 3.70835C9.35053 3.72224 9.39914 3.74308 9.44775 3.77085C9.48248 3.79863 9.5172 3.82641 9.55192 3.85419C9.58664 3.88196 9.62137 3.91321 9.65609 3.94794L10.2082 4.50002C10.2637 4.55558 10.2984 4.5903 10.3123 4.60419C10.3332 4.61808 10.3471 4.62849 10.354 4.63544C10.3609 4.64238 10.3679 4.64933 10.3748 4.65627C10.3887 4.65627 10.4026 4.65627 10.4165 4.65627C10.4234 4.66321 10.4373 4.66669 10.4582 4.66669C10.479 4.66669 10.5311 4.66669 10.6144 4.66669H10.7811C10.9269 4.66669 11.0589 4.66669 11.1769 4.66669C11.295 4.66669 11.4026 4.67016 11.4998 4.6771C11.5971 4.69099 11.6908 4.70835 11.7811 4.72919C11.8714 4.74308 11.9582 4.77433 12.0415 4.82294C12.1804 4.88544 12.3019 4.97224 12.4061 5.08335C12.5103 5.18752 12.5936 5.30558 12.6561 5.43752C12.7047 5.52085 12.7394 5.60766 12.7603 5.69794C12.7811 5.78821 12.795 5.88544 12.8019 5.9896C12.8089 6.07988 12.8123 6.18405 12.8123 6.3021C12.8123 6.42016 12.8123 6.5521 12.8123 6.69794V9.89585C12.8123 10.0417 12.8123 10.1736 12.8123 10.2917C12.8123 10.4097 12.8089 10.5139 12.8019 10.6042C12.795 10.7014 12.7811 10.7986 12.7603 10.8959C12.7394 10.9861 12.7047 11.0729 12.6561 11.1563C12.5936 11.2882 12.5103 11.4063 12.4061 11.5104C12.3019 11.6146 12.1804 11.7014 12.0415 11.7709C11.9582 11.8125 11.8714 11.8438 11.7811 11.8646C11.6908 11.8854 11.5971 11.8993 11.4998 11.9063C11.4026 11.9202 11.295 11.9271 11.1769 11.9271C11.0589 11.9271 10.9269 11.9271 10.7811 11.9271H5.21859C5.07275 11.9271 4.94081 11.9271 4.82275 11.9271C4.7047 11.9271 4.59706 11.9202 4.49984 11.9063C4.40262 11.8993 4.30887 11.8854 4.21859 11.8646C4.12831 11.8438 4.0415 11.8125 3.95817 11.7709C3.81928 11.7014 3.69775 11.6146 3.59359 11.5104C3.48942 11.4063 3.40609 11.2882 3.34359 11.1563C3.29498 11.0729 3.26025 10.9861 3.23942 10.8959C3.21859 10.7986 3.2047 10.7014 3.19775 10.6042C3.19081 10.5139 3.18734 10.4097 3.18734 10.2917C3.18734 10.1736 3.18734 10.0417 3.18734 9.89585V6.69794C3.18734 6.5521 3.18734 6.42016 3.18734 6.3021C3.18734 6.18405 3.19081 6.07988 3.19775 5.9896C3.2047 5.88544 3.21859 5.78821 3.23942 5.69794C3.26025 5.60766 3.2915 5.52085 3.33317 5.43752C3.40262 5.30558 3.48942 5.18752 3.59359 5.08335C3.69775 4.97224 3.81928 4.88544 3.95817 4.82294C4.0415 4.77433 4.12831 4.74308 4.21859 4.72919C4.30887 4.70835 4.40262 4.69099 4.49984 4.6771C4.59706 4.67016 4.7047 4.66669 4.82275 4.66669C4.94081 4.66669 5.07275 4.66669 5.21859 4.66669H5.38525C5.46859 4.66669 5.52067 4.66669 5.5415 4.66669C5.56234 4.66669 5.57623 4.66321 5.58317 4.65627C5.59706 4.65627 5.60748 4.65627 5.61442 4.65627C5.62831 4.64933 5.63873 4.64238 5.64567 4.63544C5.65262 4.62849 5.66303 4.61808 5.67692 4.60419C5.69775 4.5903 5.73595 4.55558 5.7915 4.50002L6.34359 3.94794C6.37831 3.91321 6.41303 3.88196 6.44775 3.85419C6.48248 3.82641 6.5172 3.79863 6.55192 3.77085C6.60053 3.74308 6.64567 3.72224 6.68734 3.70835C6.73595 3.68752 6.78456 3.67016 6.83317 3.65627C6.88178 3.64238 6.92692 3.63544 6.96859 3.63544C7.0172 3.63544 7.06581 3.63196 7.11442 3.62502H8.88525ZM7.99984 6.18752C7.70817 6.18752 7.43387 6.24308 7.17692 6.35419C6.91998 6.4653 6.69428 6.61808 6.49984 6.81252C6.31234 7.00002 6.16303 7.22224 6.05192 7.47919C5.94081 7.72919 5.88525 8.00002 5.88525 8.29169C5.88525 8.58335 5.94081 8.85766 6.05192 9.1146C6.16303 9.37155 6.31234 9.59724 6.49984 9.79169C6.69428 9.97919 6.91998 10.1285 7.17692 10.2396C7.43387 10.3507 7.70817 10.4063 7.99984 10.4063C8.2915 10.4063 8.56581 10.3507 8.82275 10.2396C9.0797 10.1285 9.30192 9.97919 9.48942 9.79169C9.68387 9.59724 9.83664 9.37155 9.94775 9.1146C10.0589 8.85766 10.1144 8.58335 10.1144 8.29169C10.1144 8.00002 10.0589 7.72919 9.94775 7.47919C9.83664 7.22224 9.68387 7.00002 9.48942 6.81252C9.30192 6.61808 9.0797 6.4653 8.82275 6.35419C8.56581 6.24308 8.2915 6.18752 7.99984 6.18752ZM7.99984 6.85419C8.39567 6.85419 8.73595 6.99655 9.02067 7.28127C9.30539 7.55905 9.44775 7.89585 9.44775 8.29169C9.44775 8.69446 9.30539 9.03821 9.02067 9.32294C8.73595 9.60071 8.39567 9.7396 7.99984 9.7396C7.604 9.7396 7.26373 9.60071 6.979 9.32294C6.69428 9.03821 6.55192 8.69446 6.55192 8.29169C6.55192 7.89585 6.69428 7.55905 6.979 7.28127C7.26373 6.99655 7.604 6.85419 7.99984 6.85419ZM11.0415 5.78127C10.8957 5.78127 10.7707 5.83335 10.6665 5.93752C10.5693 6.03474 10.5207 6.1528 10.5207 6.29169C10.5207 6.43752 10.5693 6.56252 10.6665 6.66669C10.7707 6.76391 10.8957 6.81252 11.0415 6.81252C11.1804 6.81252 11.2984 6.76391 11.3957 6.66669C11.4998 6.56252 11.5519 6.43752 11.5519 6.29169C11.5519 6.1528 11.4998 6.03474 11.3957 5.93752C11.2984 5.83335 11.1804 5.78127 11.0415 5.78127Z" fill="white"/>
            </svg>
            <!-- 麦克风 -->
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="16" height="16" rx="8" fill="#FF4942"/>
              <path d="M11.2603 7.78127C11.3644 7.78127 11.4512 7.81599 11.5207 7.88544C11.5901 7.95488 11.6248 8.04169 11.6248 8.14585C11.6248 8.61808 11.5415 9.06252 11.3748 9.47919C11.2082 9.89585 10.979 10.2674 10.6873 10.5938C10.3957 10.9132 10.0519 11.1771 9.65609 11.3854C9.25331 11.5868 8.82623 11.7118 8.37484 11.7604V12.7396C8.37484 12.8438 8.33664 12.9306 8.26025 13C8.19081 13.0764 8.104 13.1146 7.99984 13.1146C7.89567 13.1146 7.80539 13.0764 7.729 13C7.65956 12.9306 7.62484 12.8438 7.62484 12.7396V11.7604C7.17345 11.7118 6.74637 11.5868 6.34359 11.3854C5.94775 11.1771 5.604 10.9132 5.31234 10.5938C5.02067 10.2674 4.7915 9.89585 4.62484 9.47919C4.45817 9.06252 4.37484 8.61808 4.37484 8.14585C4.37484 8.04169 4.40956 7.95488 4.479 7.88544C4.54845 7.81599 4.63525 7.78127 4.73942 7.78127C4.84359 7.78127 4.93039 7.81599 4.99984 7.88544C5.07623 7.95488 5.11442 8.04169 5.11442 8.14585C5.11442 8.54863 5.18734 8.92363 5.33317 9.27085C5.48595 9.62502 5.69428 9.93405 5.95817 10.1979C6.22206 10.4549 6.52762 10.6597 6.87484 10.8125C7.229 10.9653 7.604 11.0417 7.99984 11.0417C8.39567 11.0417 8.77067 10.9653 9.12484 10.8125C9.47206 10.6597 9.77762 10.4549 10.0415 10.1979C10.3054 9.93405 10.5137 9.62502 10.6665 9.27085C10.8123 8.92363 10.8853 8.54863 10.8853 8.14585C10.8853 8.04169 10.92 7.95488 10.9894 7.88544C11.0658 7.81599 11.1561 7.78127 11.2603 7.78127ZM7.99984 3.5521C8.52067 3.5521 8.97206 3.72919 9.354 4.08335C9.73595 4.43752 9.92692 4.87155 9.92692 5.38544V8.2396C9.92692 8.75349 9.73595 9.18752 9.354 9.54169C8.97206 9.89585 8.52067 10.0729 7.99984 10.0729C7.479 10.0729 7.02762 9.89585 6.64567 9.54169C6.26373 9.18752 6.07275 8.75349 6.07275 8.2396V5.38544C6.07275 4.87155 6.26373 4.43752 6.64567 4.08335C7.02762 3.72919 7.479 3.5521 7.99984 3.5521Z" fill="white"/>
            </svg>
            <!-- 定位 -->
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="16" height="16" rx="8" fill="#1A88FF"/>
              <path d="M7.99984 3.63186C8.5415 3.63186 9.05192 3.73255 9.53109 3.93394C10.0033 4.14227 10.4165 4.42352 10.7707 4.77769C11.1318 5.13186 11.413 5.54852 11.6144 6.02769C11.8228 6.50686 11.9269 7.01727 11.9269 7.55894C11.9269 7.78811 11.9061 8.0138 11.8644 8.23602C11.8297 8.4513 11.7741 8.65963 11.6978 8.86102C11.6283 9.0763 11.538 9.28116 11.4269 9.47561C11.3158 9.67005 11.1908 9.85408 11.0519 10.0277C10.9269 10.1805 10.7603 10.3749 10.5519 10.611C10.3505 10.8541 10.1318 11.111 9.89567 11.3819C9.6665 11.6457 9.43734 11.9062 9.20817 12.1631C8.979 12.4201 8.77762 12.6457 8.604 12.8402C8.44428 13.0207 8.24289 13.111 7.99984 13.111C7.75678 13.111 7.55539 13.0207 7.39567 12.8402C7.22206 12.6457 7.02067 12.4201 6.7915 12.1631C6.56234 11.9062 6.3297 11.6457 6.09359 11.3819C5.86442 11.111 5.64914 10.8541 5.44775 10.611C5.23942 10.3749 5.07275 10.1805 4.94775 10.0277C4.80887 9.85408 4.68387 9.67005 4.57275 9.47561C4.46164 9.28116 4.37137 9.0763 4.30192 8.86102C4.22553 8.65963 4.1665 8.4513 4.12484 8.23602C4.09012 8.0138 4.07275 7.78811 4.07275 7.55894C4.07275 7.01727 4.17692 6.50686 4.38525 6.02769C4.58664 5.54852 4.86442 5.13186 5.21859 4.77769C5.5797 4.42352 5.99637 4.14227 6.46859 3.93394C6.94775 3.73255 7.45817 3.63186 7.99984 3.63186ZM7.99984 5.99644C7.56928 5.99644 7.20123 6.14922 6.89567 6.45477C6.59706 6.76033 6.44775 7.12838 6.44775 7.55894C6.44775 7.9895 6.59706 8.35755 6.89567 8.66311C7.20123 8.96172 7.56928 9.11102 7.99984 9.11102C8.43039 9.11102 8.79498 8.96172 9.09359 8.66311C9.39914 8.35755 9.55192 7.9895 9.55192 7.55894C9.55192 7.12838 9.39914 6.76033 9.09359 6.45477C8.79498 6.14922 8.43039 5.99644 7.99984 5.99644Z" fill="white"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- 状态行 (支持单卡一行 / 双卡两行) -->
      <div class="cc-status" :class="{ hidden: editing, 'is-dual': control.showDualSim }">
        <template v-if="!control.showDualSim">
          <div class="cc-status-row cc-status-single">
            <div class="cc-status-left">
              <StatusIcons color="#fff" :show-wifi="false" :show-signal="true" :show-battery="false" />
              <span class="cc-carrier">{{ i18n.ccLabel('carrier1') }}</span>
            </div>
            <div class="cc-status-right">
              <LIcon v-if="dndOn" name="moon" :size="13" class="cc-ind" />
              <LIcon v-if="control.hotspot" name="radio" :size="13" class="cc-ind" />
              <LIcon v-if="control.soundMode === 'mute'" name="bellOff" :size="13" class="cc-ind" />
              <LIcon v-if="control.soundMode === 'vibrate'" name="vibrate" :size="13" class="cc-ind" />
              <StatusIcons color="#fff" :show-wifi="true" :show-signal="false" :show-battery="false" />
              <span class="cc-battery-pct">91%</span>
              <StatusIcons color="#fff" :show-wifi="false" :show-signal="false" :show-battery="true" />
            </div>
          </div>
        </template>
        <template v-else>
          <div class="cc-status-dual-rows">
            <!-- 第 1 行: 卡1 信号 + 中国电信 / Wi-Fi + 电量百分比 + 电池 (与单卡第1行完全一致) -->
            <div class="cc-status-row">
              <div class="cc-status-left">
                <StatusIcons color="#fff" :show-wifi="false" :show-signal="true" :show-battery="false" />
                <span class="cc-carrier">{{ i18n.ccLabel('carrier1') }}</span>
              </div>
              <div class="cc-status-right">
                <StatusIcons color="#fff" :show-wifi="true" :show-signal="false" :show-battery="false" />
                <span class="cc-battery-pct">91%</span>
                <StatusIcons color="#fff" :show-wifi="false" :show-signal="false" :show-battery="true" />
              </div>
            </div>
            <!-- 第 2 行: 卡2 信号 + 中国移动 / 蓝牙 -->
            <div class="cc-status-row">
              <div class="cc-status-left">
                <StatusIcons color="#fff" :show-wifi="false" :show-signal="true" :show-battery="false" />
                <span class="cc-carrier">{{ i18n.ccLabel('carrier2') }}</span>
              </div>
              <!-- 只保留蓝牙，且必须复用蓝牙按钮那颗图标（lucide.js 的 bluetooth），
                   不要用 stroke 版手写 SVG —— 14px 下会糊成一坨变形的线 -->
              <div class="cc-status-right cc-status-sub-icons">
                <LIcon name="bluetooth" :size="14" />
              </div>
            </div>
          </div>
        </template>
      </div>

      </div>

      <!-- 可滚动区：只有网格滚动，裁切线 = 顶部固定区下缘（状态栏下方） -->
      <div
        ref="scrollRef"
        class="cc-scroll"
        :class="{ 'has-overflow': hasOverflow, 'is-editing': editing }"
        :style="{
          overflowY: hasOverflow ? 'auto' : 'hidden',
          touchAction: hasOverflow ? 'pan-y' : 'none'
        }"
      >
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
          <div
            v-if="item.id === 'wifi'"
            class="cc-pill"
            :class="{
              'ft-selectable': control.fineTuningMode,
              'ft-selected': control.fineTuningMode && control.selectedTarget === 'wifi'
            }"
            @click="onPillClick($event, 'wifi')"
          >
            <svg class="cc-pill-bg-svg" width="100%" height="100%" viewBox="0 0 138 62" preserveAspectRatio="none" fill="none">
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="rgba(255, 255, 255, 0.04)" stroke="url(#paint0_linear_331_95718)" vector-effect="non-scaling-stroke" />
            </svg>
            <div
              class="cc-pill-icon"
              :style="{
                width: control.getBgSize('wifi') + 'px',
                height: control.getBgSize('wifi') + 'px',
                flex: '0 0 ' + control.getBgSize('wifi') + 'px',
                background: control.wifi ? '#258FFF' : 'rgba(255, 255, 255, 0.2)',
                color: '#fff',
                opacity: control.wifi ? 1 : 0.6
              }"
            >
              <LIcon name="wifi" :size="control.getIconSize('wifi')" />
            </div>
            <div class="cc-pill-text">
              <span class="cc-pill-title">Transsion</span>
              <span class="cc-pill-sub">{{ control.wifi ? 'Mobile' : i18n.t('turnOff') }}</span>
            </div>
          </div>

          <!-- 数据胶囊 -->
          <div
            v-else-if="item.id === 'data'"
            class="cc-pill"
            :class="{
              'ft-selectable': control.fineTuningMode,
              'ft-selected': control.fineTuningMode && control.selectedTarget === 'data'
            }"
            @click="onPillClick($event, 'data')"
          >
            <svg class="cc-pill-bg-svg" width="100%" height="100%" viewBox="0 0 138 62" preserveAspectRatio="none" fill="none">
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="rgba(255, 255, 255, 0.04)" stroke="url(#paint0_linear_331_95718)" vector-effect="non-scaling-stroke" />
            </svg>
            <div
              class="cc-pill-icon"
              :style="{
                width: control.getBgSize('data') + 'px',
                height: control.getBgSize('data') + 'px',
                flex: '0 0 ' + control.getBgSize('data') + 'px',
                background: control.cellular ? '#31C65A' : 'rgba(255,255,255,0.2)',
                color: '#fff',
                opacity: control.cellular ? 1 : 0.6
              }"
            >
              <LIcon name="arrowDownUp" :size="control.getIconSize('data')" />
            </div>
            <div class="cc-pill-text">
              <!-- 运营商名走 i18n（zh 中国电信 / en China Telecom / bn），别再硬编码 -->
              <span class="cc-pill-title">{{ i18n.ccLabel('carrier1') }}</span>
              <span class="cc-pill-sub">{{ control.cellular ? '102 MB' : i18n.t('turnOff') }}</span>
            </div>
          </div>

          <!-- 媒体播放器 (2x2 138x138) -->
          <div v-else-if="item.id === 'mediaPlayer'" class="cc-media">
            <svg class="cc-media-bg-svg" width="100%" height="100%" viewBox="0 0 138 138" fill="none">
              <rect x="0.5" y="0.5" width="137" height="137" rx="30.5" fill="rgba(255, 255, 255, 0.04)" stroke="url(#paint0_linear_2865_138)" vector-effect="non-scaling-stroke" />
            </svg>
            <div class="cc-media-top">
              <img :src="albumCover" alt="Album Cover" class="cc-media-cover" />
              <button
                class="cc-media-cast"
                :class="{
                  'ft-target-hover': control.fineTuningMode,
                  'ft-target-selected': control.fineTuningMode && control.selectedTarget === 'mediaCast'
                }"
                :style="{
                  width: `${control.getBgSize('mediaCast')}px`,
                  height: `${control.getBgSize('mediaCast')}px`,
                  borderRadius: `${control.getBgSize('mediaCast') / 2}px`
                }"
                @click.stop="onMediaCastClick"
              >
                <LIcon name="mediaCast" :size="control.getIconSize('mediaCast')" />
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
            <div class="cc-vslider" @pointerdown="sliderPointer($event, 'brightness')">
              <svg class="cc-vslider-bg-svg" width="100%" height="100%" viewBox="0 0 62 138" preserveAspectRatio="none" fill="none">
                <rect x="0.5" y="0.5" width="61" height="137" rx="30.5" fill="rgba(255, 255, 255, 0.04)" stroke="url(#paint0_linear_2865_138)" vector-effect="non-scaling-stroke" />
              </svg>
              <div class="cc-vslider-fill" :style="{ height: brightnessPct + '%' }"></div>
              <div class="cc-vslider-icon">
                <LIcon name="sun" :size="26" />
              </div>
            </div>
            <div class="cc-vslider" @pointerdown="sliderPointer($event, 'volume')">
              <svg class="cc-vslider-bg-svg" width="100%" height="100%" viewBox="0 0 62 138" preserveAspectRatio="none" fill="none">
                <rect x="0.5" y="0.5" width="61" height="137" rx="30.5" fill="rgba(255, 255, 255, 0.04)" stroke="url(#paint0_linear_2865_138)" vector-effect="non-scaling-stroke" />
              </svg>
              <div class="cc-vslider-fill" :style="{ height: volumePct + '%' }"></div>
              <div class="cc-vslider-icon">
                <LIcon name="volume2" :size="26" />
              </div>
            </div>
          </div>

          <!-- OneLeap (2x1) -->
          <div
            v-else-if="item.id === 'joyConnect'"
            class="cc-pill"
            :class="{
              'ft-selectable': control.fineTuningMode,
              'ft-selected': control.fineTuningMode && control.selectedTarget === 'oneLeap'
            }"
            @click="onPillClick($event, 'oneLeap')"
          >
            <svg class="cc-pill-bg-svg" width="100%" height="100%" viewBox="0 0 138 62" preserveAspectRatio="none" fill="none">
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="rgba(255, 255, 255, 0.04)" stroke="url(#paint0_linear_331_95718)" vector-effect="non-scaling-stroke" />
            </svg>
            <div
              class="cc-pill-icon"
              :style="{
                width: control.getBgSize('oneLeap') + 'px',
                height: control.getBgSize('oneLeap') + 'px',
                flex: '0 0 ' + control.getBgSize('oneLeap') + 'px',
                background: 'rgba(255, 255, 255, 0.16)'
              }"
            >
              <LIcon name="link2" :size="control.getIconSize('oneLeap')" />
            </div>
            <div class="cc-pill-text"><span class="cc-pill-title">{{ i18n.ccLabel('oneLeap') }}</span></div>
          </div>

          <!-- Health&SPO (2x1) -->
          <div
            v-else-if="item.id === 'joyHeart'"
            class="cc-pill"
            :class="{
              'ft-selectable': control.fineTuningMode,
              'ft-selected': control.fineTuningMode && control.selectedTarget === 'health'
            }"
            @click="onPillClick($event, 'health')"
          >
            <svg class="cc-pill-bg-svg" width="100%" height="100%" viewBox="0 0 138 62" preserveAspectRatio="none" fill="none">
              <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="rgba(255, 255, 255, 0.04)" stroke="url(#paint0_linear_331_95718)" vector-effect="non-scaling-stroke" />
            </svg>
            <div
              class="cc-pill-icon"
              :style="{
                width: control.getBgSize('health') + 'px',
                height: control.getBgSize('health') + 'px',
                flex: '0 0 ' + control.getBgSize('health') + 'px',
                background: 'rgba(255, 255, 255, 0.16)'
              }"
            >
              <LIcon name="heart" :size="control.getIconSize('health')" />
            </div>
            <div class="cc-pill-text"><span class="cc-pill-title">{{ i18n.ccLabel('health') }}</span></div>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" fill="rgba(255, 255, 255, 0.24)" stroke="url(#cc_del_stroke)" stroke-width="1"/>
              <rect x="6.3335" y="11" width="11.3333" height="2.33333" rx="1.16667" fill="white"/>
              <defs>
                <linearGradient id="cc_del_stroke" x1="6" y1="3" x2="18" y2="21" gradientUnits="userSpaceOnUse">
                  <stop stop-color="white" stop-opacity="0.95"/>
                  <stop offset="0.5" stop-color="white" stop-opacity="0.3"/>
                  <stop offset="1" stop-color="white" stop-opacity="0.75"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
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
  color: #fff;
}

/* 内容层：顶部固定区 + 网格滚动区，纵向 flex 分割（入场动画作用于这一层） */
.cc-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  /* 顶部 8px 从原 .cc-scroll 迁来：固定区与滚动区共用同一上边距 */
  padding: 8px 0 0;
  will-change: transform, opacity;
}

/* 顶部固定区：状态栏 + 编辑/设置按钮。在滚动容器之外，
   溢出滚动时网格在它下缘被裁切，不会从它底下钻过去 */
.cc-fixed-top {
  flex: none;
  position: relative;
  z-index: 20;
}

.cc-scroll {
  position: relative;
  flex: 1 1 0;
  /* flex 子项默认 min-height:auto，不归零的话内容会把自己撑高而不是滚动 */
  min-height: 0;
  scrollbar-width: none;
  /* 底部留白 = 导航条预留高度。
     导航条现在全局可见且浮在控制中心之上（z 96 > 94），内容不留白就会压在横条下面。
     原本这里是 12px 的「离屏幕底留白」，与导航条预留是同一件事，所以是**取代**不是叠加 ——
     叠加会让 1.00 倍（底部仅剩 22px 余量）刚好顶到溢出临界线上。
     scrollHeight 自动包含这个留白，「是否溢出」也就等价于「先减去导航条高度再比」。
     注意：顶部固定区已移出滚动容器，溢出 =「网格高度 > (屏高 − 固定区 − 导航条预留)」，
     数学上与旧的整块滚动完全等价（差值两侧同时挪走了固定区高度）。
     顶部 7px = 状态栏与网格之间 14px 间距的一半，用于容纳画在元素外侧的微调选中框。 */
  padding: 7px 0 var(--home-indicator-inset);
}
.cc-scroll.is-editing {
  /* 编辑态原为 90px，同样把其中的 12px 基准换成导航条预留值，总高保持不变 */
  padding: 8px 0 calc(76px + var(--home-indicator-inset));
}
.cc-scroll.has-overflow {
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}
.cc-scroll:not(.has-overflow) {
  overflow-y: hidden;
  overscroll-behavior-y: none;
}
.cc-scroll::-webkit-scrollbar { display: none; }

/* 头部 */
.cc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: var(--cc-grid-w);
  margin: 0 auto 6px;
  padding: 0;
  height: 30px;
  position: relative;
  z-index: 20;
  color: #fff;
  /* 只把编辑/设置按钮往下移，不挤占下方网格布局（transform 不参与文档流） */
  transform: translateY(8px);
}
.cc-header-camera-spacer {
  width: 16px;
  height: 16px;
  pointer-events: none;
}
.cc-header-btn {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(25px) saturate(180%);
  -webkit-backdrop-filter: blur(25px) saturate(180%);
  border: none;
  padding: 0;
  cursor: pointer;
  position: relative;
  z-index: 20;
  overflow: visible;
  transition: transform 0.15s ease, opacity 0.15s ease;
  color: #fff;
}
.cc-header-btn:active {
  transform: scale(0.92);
  opacity: 0.8;
}
.cc-header-btn.ft-selectable {
  cursor: pointer;
}
.cc-header-btn.ft-selectable:hover {
  outline: 1.5px dashed rgba(37, 143, 255, 0.6);
  outline-offset: 1px;
}
.cc-header-btn.ft-selected {
  outline: var(--ft-select-width) solid var(--ft-select-color) !important;
  outline-offset: var(--ft-select-offset) !important;
  box-shadow: var(--ft-select-glow) !important;
}
.cc-edit-group {
  display: flex;
  align-items: center;
  height: 30px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(25px) saturate(180%);
  -webkit-backdrop-filter: blur(25px) saturate(180%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  overflow: hidden;
  position: relative;
  z-index: 20;
}
.cc-group-btn {
  width: 32px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
}
.cc-group-btn:hover { background: rgba(255, 255, 255, 0.15); }
.cc-group-btn.active { background: #258fff; color: #fff; }
.cc-group-btn:active { transform: scale(0.92); opacity: 0.8; }
.cc-group-divider {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.2);
}

/* 编辑模式顶栏 */
.cc-header-edit-bar {
  width: 360px;
  height: 56px;
  margin: 0 auto 10px;
  position: relative;
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
}
.cc-header-edit-svg {
  display: block;
  overflow: visible;
}
.cc-header-svg-btn {
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.cc-header-svg-btn:hover {
  opacity: 0.85;
}
.cc-header-svg-btn:active {
  transform: scale(0.96);
  transform-origin: center;
}
.cc-header-svg-btn.active path {
  fill: #70b4ff !important;
}

/* 隐私指示器区域 (固定高度，无论是否显示隐私图标均占位，避免状态栏及底部开关位置跳变) */
.cc-privacy-area {
  height: 20px;
  width: var(--cc-grid-w);
  margin: 2px auto 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.cc-privacy-area.hidden {
  opacity: 0;
  height: 0;
  margin: 0;
  overflow: hidden;
}
.cc-privacy-pill {
  display: flex;
  align-items: center;
  pointer-events: auto;
  user-select: none;
  animation: ccPrivFadeIn 0.2s ease;
}
@keyframes ccPrivFadeIn {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}
.cc-priv-dots {
  display: flex;
  align-items: center;
  gap: 4px;
}
.cc-priv-dots svg {
  display: block;
  flex-shrink: 0;
}

.cc-status {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  width: var(--cc-grid-w);
  /* 下间距 14px 的一半（7px）让给滚动区做顶部内边距：
     裁切起始线因此上移到「状态栏与网格按钮间距的中点」，
     最顶排砖块被选中时，画在元素外侧的选中框才有地方显示，不会被切掉。 */
  margin: 0 auto 7px;
  padding: 0;
  height: 16px;
  color: rgba(255, 255, 255, 0.95);
  transition: opacity 0.3s ease, height 0.25s ease;
}
.cc-status.is-dual {
  height: 36px;
}
.cc-status.hidden {
  opacity: 0;
  height: 0;
  margin: 0;
  overflow: hidden;
  pointer-events: none;
}
.cc-status-dual-rows {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cc-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 16px;
  width: 100%;
}
.cc-status-sub-icons {
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0.88;
}
.cc-tag-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 11px;
  padding: 0 2.5px;
  font-size: 7.5px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.2px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.85);
  color: #fff;
  transform: scale(0.9);
  transform-origin: left center;
}
.cc-roam-r {
  font-size: 9px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
  margin-right: -1px;
}
.cc-carrier-name {
  font: 500 11.5px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.95);
  white-space: nowrap;
}
.cc-net-speed {
  font: 600 7px/0.95 var(--font-stack);
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: -0.2px;
  margin-left: 2px;
  transform: scale(0.85);
  transform-origin: left center;
}
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
.cc-ind {
  flex: 0 0 auto;
  /* 与右侧 Wi-Fi/电量图标保持同色同高，视觉上属于同一状态行 */
  color: rgba(255, 255, 255, 0.95);
}
.cc-battery-pct {
  font: 600 13px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.95);
}

/* 网格：4 列，尺寸全部由 --cc-cell / --cc-gap 驱动（整体缩放时等比放大） */
.cc-grid {
  display: grid;
  grid-template-columns: repeat(4, var(--cc-cell));
  grid-auto-rows: var(--cc-cell);
  column-gap: var(--cc-gap);
  row-gap: var(--cc-gap);
  width: var(--cc-grid-w);
  margin: 0 auto;
  min-height: 500px;
  padding-bottom: 0;
}
.is-editing .cc-grid {
  padding-bottom: 30px;
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
  border-radius: calc(var(--cc-cell) / 2);
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
.cc-pill.ft-selectable {
  cursor: pointer;
}
.cc-pill.ft-selectable:hover {
  outline: 1.5px dashed rgba(37, 143, 255, 0.6);
  outline-offset: 1px;
}
.cc-pill.ft-selected {
  outline: var(--ft-select-width) solid var(--ft-select-color) !important;
  outline-offset: var(--ft-select-offset) !important;
  box-shadow: var(--ft-select-glow) !important;
  z-index: 10 !important;
}
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
  border-radius: calc(var(--cc-cell) / 2);
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
  gap: var(--cc-gap, 14px);
  position: relative;
}
.cc-vslider {
  flex: 1;
  border-radius: calc(var(--cc-cell) / 2);
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(30px) saturate(200%);
  -webkit-backdrop-filter: blur(30px) saturate(200%);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  touch-action: none;
}
.cc-vslider-bg-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}
.cc-vslider-fill {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  background: #fff;
  transition: height 0.1s ease-out;
  z-index: 1;
}
.cc-vslider-icon {
  position: absolute;
  bottom: 18px;
  left: 0; right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 3;
}

/* 删除徽标（widget 通用） */
.cc-remove {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  overflow: visible;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
  transition: transform 0.15s ease, opacity 0.15s ease, filter 0.15s ease;
}
.cc-remove:hover {
  transform: scale(1.12);
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.6));
}
.cc-remove:active {
  transform: scale(0.92);
}
</style>
