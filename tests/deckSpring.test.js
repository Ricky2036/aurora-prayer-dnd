import assert from 'node:assert/strict'
import test from 'node:test'
import { SPRING_PRESETS, springStep } from '../src/utils/springMath.js'

/**
 * 堆叠翻卡弹簧（ios-deck）的量化契约。
 *
 * 来源：2026-09-12 第三轮，对 Ricky 提供的参考视频（444×960 / 24fps / 314 帧）逐帧量化。
 * 松手吸附段卡片左缘 120→96→89→82→80→78→74，增量 -14/-10/-7/-7/-2/-1：
 * 拟合 p = 1 - exp(-t/τ) 得 τ ≈ 110ms；随后有过冲回弹（74→67→36→49→57→66→70→74）。
 * 旧值 {80, 17.9} 是 ζ = 1.0 的临界阻尼（无过冲、收尾像指数衰减）→ 视觉「不自然」。
 */
const cfg = SPRING_PRESETS['ios-deck']
const wn = Math.sqrt(cfg.stiffness / cfg.mass)
const zeta = cfg.damping / (2 * Math.sqrt(cfg.stiffness * cfg.mass))

test('ios-deck：ω_n = 14 rad/s、ζ = 0.65（欠阻尼，带轻微弹性）', () => {
  assert.ok(Math.abs(wn - 14) < 0.2, `ω_n = ${wn.toFixed(2)}`)
  assert.ok(Math.abs(zeta - 0.65) < 0.02, `ζ = ${zeta.toFixed(3)}`)
})

test('ios-deck：时间常数 τ = 1/(ζω_n) ≈ 110ms（对齐参考视频实测）', () => {
  const tau = 1 / (zeta * wn)
  assert.ok(Math.abs(tau - 0.11) < 0.012, `τ = ${(tau * 1000).toFixed(0)}ms`)
})

test('ios-deck：理论过冲 5%~10%（「有弹性但不是弹床」）', () => {
  const os = Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta))
  assert.ok(os > 0.05 && os < 0.1, `过冲 ${(os * 100).toFixed(1)}%`)
})

test('ios-deck：数值积分 1→0，过冲落区间且 3τ 内收敛到 5%', () => {
  const state = { x: 1, v: 0 }
  const dt = 1 / 240
  let peak = 1
  let tLastOut = 0 // 最后一次越出 ±5% 的时刻（= 真正收敛，过冲之后）
  for (let t = 0; t < 1.2; t += dt) {
    springStep(state, 0, cfg, dt)
    if (state.x < peak) peak = state.x
    if (Math.abs(state.x) >= 0.05) tLastOut = t
  }
  assert.ok(-peak > 0.05 && -peak < 0.09, `数值过冲 ${(-peak * 100).toFixed(1)}%`)
  assert.ok(tLastOut > 0.2 && tLastOut < 0.5, `收敛到 5% 用时 ${(tLastOut * 1000).toFixed(0)}ms`)
  assert.ok(Math.abs(state.x) < 0.02, `1.2s 后残差 ${state.x.toFixed(4)}`)
})

test('ios-deck：注入初速度不会被放大到失控（越界防爆）', () => {
  const state = { x: 0, v: 6 }
  const dt = 1 / 240
  let peak = 0
  for (let t = 0; t < 1.5; t += dt) {
    springStep(state, 0, cfg, dt)
    peak = Math.max(peak, Math.abs(state.x))
  }
  assert.ok(peak < 1.2, `注入 6 单位/s 的峰值位移 ${peak.toFixed(2)} 应 < 1.2 层`)
})
