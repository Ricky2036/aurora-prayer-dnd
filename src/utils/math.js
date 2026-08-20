/* 数学工具：手势与动画共用 */

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

export const lerp = (a, b, t) => a + (b - a) * t

/** iOS 橡皮筋阻尼：越界越多阻力越大 */
export function rubberBand(offset, dim, factor = 0.55) {
  const abs = Math.abs(offset)
  const result = (factor * abs * dim) / (dim + factor * abs)
  return Math.sign(offset) * result
}

/** 速度采样器：环形缓冲最近 100ms 的位移，松手时估算速度 (px/ms) */
export function createVelocityTracker() {
  const samples = []
  const WINDOW = 100
  return {
    add(pos, time = performance.now()) {
      samples.push({ pos, time })
      const cutoff = time - WINDOW
      while (samples.length > 2 && samples[0].time < cutoff) samples.shift()
    },
    velocity(now = performance.now()) {
      if (samples.length < 2) return 0
      const first = samples[0]
      const last = samples[samples.length - 1]
      const dt = last.time - first.time
      if (dt < 16) return 0
      return (last.pos - first.pos) / dt
    },
    reset() { samples.length = 0 }
  }
}
