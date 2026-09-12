/* 数学工具：手势与动画共用 */

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

export const lerp = (a, b, t) => a + (b - a) * t

/** iOS 橡皮筋阻尼：越界越多阻力越大 */
export function rubberBand(offset, dim, factor = 0.55) {
  const abs = Math.abs(offset)
  const result = (factor * abs * dim) / (dim + factor * abs)
  return Math.sign(offset) * result
}

/** 速度采样器：环形缓冲最近 100ms 的位移，松手时估算速度 (px/ms)
 *
 * ⚠️ velocity() 必须按【调用时刻】先剔除过期样本（Ricky 2026-09-12 手感 bug 的根因）：
 *    旧实现只在 add() 里按「采样时刻」裁剪，于是「快速上滑 → 停住不动 → 松手」时，
 *    缓冲区里只剩停住前那一小段高速位移，算出的速度还是「快甩」的速度 →
 *    松手瞬间的速度门槛判定（如 HomeIndicator 的停驻激活 |v| ≤ 0.8）被误杀 →
 *    手指明明停了一两秒，却怎么都进不了 Recently。
 *    加上时间裁剪后：停住超过 100ms 就没有动量，velocity() 返回 0，符合物理直觉。 */
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
      while (samples.length > 1 && now - samples[0].time > WINDOW) samples.shift()
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
