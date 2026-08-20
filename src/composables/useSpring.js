import { ref, onUnmounted } from 'vue'
import { SPRING_PRESETS, springStep, springSettled } from '../utils/springMath'

/**
 * rAF 弹簧：把一个响应式数值用弹簧物理推向目标值。
 * 关键能力：支持把松手瞬时速度注入弹簧初速度（跟手不突兀的核心）。
 *
 * const { value, animateTo, stop } = useSpring(0, 'ios-gentle')
 * animateTo(1, { initialVelocity: -2.5 })
 */
export function useSpring(initial = 0, preset = 'ios-gentle') {
  const value = ref(initial)
  const state = { x: initial, v: 0 }
  let raf = null
  let lastTime = 0
  let target = initial
  let cfg = { ...SPRING_PRESETS[preset] }
  let onDone = null

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05) // 掉帧保护
    lastTime = now
    springStep(state, target, cfg, dt)
    value.value = state.x
    if (springSettled(state, target)) {
      state.x = target
      state.v = 0
      value.value = target
      raf = null
      const cb = onDone
      onDone = null
      cb && cb()
      return
    }
    raf = requestAnimationFrame(frame)
  }

  /**
   * @param to 目标值
   * @param opts.initialVelocity 注入初速度（与数值同单位/秒）
   * @param opts.preset 切换预设
   * @param opts.onDone 到位回调（仅成功完成时触发）
   */
  function animateTo(to, opts = {}) {
    if (opts.preset) cfg = { ...SPRING_PRESETS[opts.preset] }
    if (opts.config) cfg = { ...cfg, ...opts.config }
    target = to
    onDone = opts.onDone || null
    if (typeof opts.initialVelocity === 'number') {
      // 限制注入速度，防过冲过头（单位与数值同单位/秒）
      state.v = Math.max(-6, Math.min(6, opts.initialVelocity))
    }
    if (raf == null) {
      lastTime = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }

  /** 立即跳到某值并停止（手势接管时调用） */
  function snapTo(v) {
    if (raf != null) cancelAnimationFrame(raf)
    raf = null
    onDone = null
    state.x = v
    state.v = 0
    value.value = v
  }

  function stop() {
    if (raf != null) cancelAnimationFrame(raf)
    raf = null
    onDone = null
    state.v = 0
  }

  /** 当前速度（单位/秒），用于手势交接 */
  const velocity = () => state.v

  onUnmounted(stop)

  return { value, animateTo, snapTo, stop, velocity }
}
