import { onMounted, onUnmounted } from 'vue'
import { clamp, rubberBand, createVelocityTracker } from '../utils/math'

/**
 * 通用跟手滑动手势（Pointer Events，鼠标/触摸统一）。
 *
 * useSwipeGesture(elRef, {
 *   axis: 'y',            // 主轴
 *   direction: -1,        // 有效方向（上滑=-1，下滑=+1，左滑=-1，右滑=+1）
 *   edgeZone: null,       // { from: 'top'|'bottom'|'left'|'right', size: 28 } 起始热区（相对元素自身）
 *   span: 848,            // 进度满量程（px）
 *   canStart: () => true, // 前置条件
 *   onStart,              // 手势捕获成功
 *   onProgress(p, deltaPx),   // 拖拽中：p 为 0..1 进度
 *   onRelease(p, velocity) => target // 松手：返回 0|1 作为弹簧落点；velocity 单位 progress/s
 * })
 *
 * 关键点：pointerdown 在元素上，move/up/cancel 挂在 window 上 ——
 * 窄热区（如 22px 侧缘）内第一步移动就离开元素也能持续追踪。
 * 返回值暴露 lastDragEndAt()：拖拽结束时间戳，click 处理器用它抑制
 * 拖拽松手后紧随的合成 click（避免误触 tap 行为）。
 */
export function useSwipeGesture(elRef, options) {
  const {
    axis = 'y',
    direction = -1,
    edgeZone = null,
    span = 800,
    threshold = 8,
    canStart = null,
    onStart = null,
    onProgress = null,
    onRelease = null
  } = options

  let el = null
  let tracking = false   // 已按下，等待方向锁定
  let captured = false   // 方向已锁定，手势归我
  let startPos = 0
  let startOther = 0
  let lastDelta = 0
  let dragEndAt = 0
  const tracker = createVelocityTracker()

  const posOf = (e) => (axis === 'y' ? e.clientY : e.clientX)
  const otherOf = (e) => (axis === 'y' ? e.clientX : e.clientY)

  function inEdgeZone(e) {
    if (!edgeZone || !el) return true
    const r = el.getBoundingClientRect()
    const scale = axis === 'y' ? r.height / (options.logicalHeight || r.height)
                               : r.width / (options.logicalWidth || r.width)
    const size = edgeZone.size * (scale || 1)
    switch (edgeZone.from) {
      case 'top': return e.clientY - r.top <= size
      case 'bottom': return r.bottom - e.clientY <= size
      case 'left': return e.clientX - r.left <= size
      case 'right': return r.right - e.clientX <= size
      default: return true
    }
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return
    if (canStart && !canStart(e)) return
    if (!inEdgeZone(e)) return
    tracking = true
    captured = false
    startPos = posOf(e)
    startOther = otherOf(e)
    lastDelta = 0
    tracker.reset()
    tracker.add(0)
    // move/up 挂 window：指针离开窄热区后仍能追踪到阈值并完成手势
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', onPointerCancel, true)
  }

  function unbindWindow() {
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', onPointerUp, true)
    window.removeEventListener('pointercancel', onPointerCancel, true)
  }

  function onPointerMove(e) {
    if (!tracking) return
    const delta = (posOf(e) - startPos) * direction
    const otherDelta = otherOf(e) - startOther

    if (!captured) {
      // 方向锁定：主轴位移超阈值且明显大于副轴
      if (Math.abs(delta) < threshold && Math.abs(otherDelta) < threshold) return
      if (Math.abs(otherDelta) > Math.abs(delta) * 1.2) {
        tracking = false // 让位给其他滚动/手势
        unbindWindow()
        return
      }
      if (delta < 0) { tracking = false; unbindWindow(); return } // 反方向不接管
      captured = true
      tracker.reset()
      tracker.add(0)
      onStart && onStart()
    }

    let d = delta
    // 越界橡皮筋（0..span 之外）
    if (d < 0) d = rubberBand(d, span * 0.4)
    if (d > span) d = span + rubberBand(d - span, span * 0.4)
    lastDelta = d
    tracker.add(d)
    const p = clamp(d / span, -0.2, 1.2)
    onProgress && onProgress(clamp(p, 0, 1), d)
    // 捕获期间抑制事件继续传播（防文本选中/点击穿透等默认行为）
    e.preventDefault?.()
  }

  /** 结束（松手或系统取消）：有捕获就走完整 release 流程，绝不留下悬空进度 */
  function finish(e, cancelled) {
    if (!tracking) return
    tracking = false
    unbindWindow()
    if (!captured) return
    captured = false
    dragEndAt = Date.now()
    const vPx = cancelled ? 0 : tracker.velocity()  // px/ms
    const vProgress = (vPx * 1000) / span           // progress/s
    const p = clamp(lastDelta / span, 0, 1)
    const target = onRelease ? onRelease(p, vProgress) : (p > 0.5 ? 1 : 0)
    return target
  }

  function onPointerUp(e) { finish(e, false) }
  function onPointerCancel(e) { finish(e, true) }

  onMounted(() => {
    el = elRef.value
    if (!el) return
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', onPointerDown)
  })

  onUnmounted(() => {
    unbindWindow()
    if (!el) return
    el.removeEventListener('pointerdown', onPointerDown)
  })

  return {
    /** 拖拽结束时间戳（含 cancel），用于抑制紧随的 click */
    lastDragEndAt: () => dragEndAt
  }
}
