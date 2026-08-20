/* 弹簧物理：半隐式欧拉积分 + 三档 iOS 预设 */

export const SPRING_PRESETS = {
  'ios-snappy': { stiffness: 500, damping: 38, mass: 1 },
  'ios-bouncy': { stiffness: 320, damping: 28, mass: 1 },
  'ios-gentle': { stiffness: 180, damping: 24, mass: 1 }
}

/**
 * 逐帧推进弹簧。
 * @param state {{ x: number, v: number }} 当前位移与速度（会被原地修改）
 * @param target number 目标值
 * @param cfg {{ stiffness, damping, mass }}
 * @param dt number 秒
 */
export function springStep(state, target, cfg, dt) {
  // 防大步长爆炸：拆成最多 1/120s 的小步
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    const force = -cfg.stiffness * (state.x - target) - cfg.damping * state.v
    state.v += (force / cfg.mass) * h
    state.x += state.v * h
  }
}

/** 弹簧是否已静止（阈值放宽，避免高速注入时收尾拖沓） */
export function springSettled(state, target) {
  return Math.abs(state.v) < 0.02 && Math.abs(state.x - target) < 0.001
}
