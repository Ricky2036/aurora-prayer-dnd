import { ref, shallowRef } from 'vue'
import {
  deriveHeroFrame,
  derivePreviewFrame,
  HERO_OPEN_DURATION,
  HERO_CLOSE_DURATION,
  HERO_HANDOFF_DURATION,
  deriveHandoffFrame,
  prepareNativeHandoffFrame,
  resolveCloseDuration
} from '../utils/heroGeometry'

/**
 * Hero 合成器：只有一个 requestAnimationFrame 时钟。几何、裁切、应用内容、
 * 背景和覆盖图标均从同一帧数据派生，不依赖 CSS transition/transitionend。
 */
export function useHeroTransition({
  openDuration = HERO_OPEN_DURATION,
  closeDuration = HERO_CLOSE_DURATION,
  handoffDuration = HERO_HANDOFF_DURATION
} = {}) {
  const phase = ref('closed')
  const frame = shallowRef(null)
  let animationFrame = null
  let generation = 0

  function stop() {
    generation += 1
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  function setPreview({ viewportRect, progress, viewportRadius }) {
    if (!['open', 'preview'].includes(phase.value)) return
    frame.value = derivePreviewFrame(viewportRect, progress, viewportRadius)
    phase.value = progress > 0 ? 'preview' : 'open'
  }

  function beginOpen({ viewportRect, anchorRect, viewportRadius = 47, onOpened } = {}) {
    stop()
    const run = generation
    const options = {
      direction: 'open',
      viewportRect,
      anchorRect,
      viewportRadius,
      duration: openDuration
    }
    phase.value = 'opening'
    frame.value = deriveHeroFrame({ ...options, timeMs: 0 })
    let startedAt = null
    const tick = (now) => {
      if (run !== generation) return
      if (startedAt === null) startedAt = now
      const elapsed = Math.min(openDuration, now - startedAt)
      frame.value = deriveHeroFrame({ ...options, timeMs: elapsed })
      if (elapsed >= openDuration) {
        animationFrame = null
        phase.value = 'open'
        onOpened?.()
        return
      }
      animationFrame = requestAnimationFrame(tick)
    }
    animationFrame = requestAnimationFrame(tick)
  }

  function beginClose({
    viewportRect,
    anchorRect,
    startRect,
    startRadius,
    startBackdropStrength,
    viewportRadius = 47,
    onHandoff,
    onClosed
  } = {}) {
    stop()
    const run = generation
    const duration = resolveCloseDuration({
      viewportRect,
      anchorRect,
      startRect: startRect || viewportRect,
      baseDuration: closeDuration
    })
    const options = {
      direction: 'close',
      viewportRect,
      anchorRect,
      startRect,
      startRadius,
      startBackdropStrength,
      viewportRadius,
      duration
    }
    phase.value = 'closing'
    frame.value = deriveHeroFrame({ ...options, timeMs: 0 })

    const settle = (now) => {
      if (run !== generation) return
      const elapsed = Math.min(handoffDuration, now - handoffStartedAt)
      frame.value = deriveHandoffFrame(handoffFrame, elapsed / handoffDuration)
      if (elapsed >= handoffDuration) {
        animationFrame = null
        phase.value = 'closed'
        // 同一 Vue 刷新批次中恢复真实图标并卸载镜像，整个 handoff 始终只有
        // 一个可见图标层，不再通过两层交叉淡化制造亮度变化。
        onHandoff?.()
        onClosed?.()
        return
      }
      animationFrame = requestAnimationFrame(settle)
    }

    let handoffFrame = null
    let handoffStartedAt = null
    let startedAt = null
    const tick = (now) => {
      if (run !== generation) return
      if (startedAt === null) startedAt = now
      const elapsed = Math.min(duration, now - startedAt)
      frame.value = deriveHeroFrame({ ...options, timeMs: elapsed })
      if (elapsed >= duration) {
        // 先提交一帧精确终点，让布局/合成器实际落到 anchorRect；下一帧进入
        // 仅含静止镜像的 handoff，结束时才原子替换为真实图标。
        handoffFrame = prepareNativeHandoffFrame(frame.value)
        frame.value = handoffFrame
        animationFrame = requestAnimationFrame((handoffNow) => {
          if (run !== generation) return
          handoffStartedAt = handoffNow
          phase.value = 'handoff'
          animationFrame = requestAnimationFrame(settle)
        })
        return
      }
      animationFrame = requestAnimationFrame(tick)
    }
    animationFrame = requestAnimationFrame(tick)
  }

  return { phase, frame, beginOpen, beginClose, setPreview, stop }
}
