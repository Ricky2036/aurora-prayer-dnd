/* 弹簧物理：半隐式欧拉积分 + 四档 iOS 预设 */

export const SPRING_PRESETS = {
  'ios-snappy': { stiffness: 500, damping: 38, mass: 1 },
  'ios-bouncy': { stiffness: 320, damping: 28, mass: 1 },
  'ios-gentle': { stiffness: 180, damping: 24, mass: 1 },
  /* 堆叠翻卡专用 —— 由参考视频逐帧量化反推（2026-09-12 第三轮）。
     旧值 {80, 17.9} 是临界阻尼（ζ = 1.0）→ 收尾像指数衰减，没有弹性，视觉「不自然」。
     实测参考视频松手吸附段（444×960 / 24fps）：左缘 120→96→89→82→80→78→74，
     增量 -14/-10/-7/-7/-2/-1，拟合 p = 1-exp(-t/τ) 得 τ ≈ 110ms；
     随后有轻微过冲回弹（74→67→36→49→57→66→70→74）。
     → ω_n = 1/(ζ·τ) = 14 rad/s（stiffness = 196），取 ζ = 0.65（过冲 ≈ 6.7%）
       → damping = 2ζω_n = 18.2。既有 iOS 的「弹」，又不是弹床。 */
  'ios-deck': { stiffness: 196, damping: 18.2, mass: 1 }
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
