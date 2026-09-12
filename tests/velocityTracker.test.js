import assert from 'node:assert/strict'
import test from 'node:test'
import { createVelocityTracker } from '../src/utils/math.js'

/** 造一个「0/10/20ms 各走 10px」的采样序列（= 1 px/ms） */
function makeTracker(step = 10, gap = 10, t0 = 1000) {
  const t = createVelocityTracker()
  t.reset()
  for (let i = 0; i < 3; i++) t.add(step * i, t0 + gap * i)
  return t
}

test('连续移动：速度 = 位移 / 时间（px/ms）', () => {
  const v = makeTracker().velocity(1020)
  assert.ok(Math.abs(v - 1) < 0.01, `v=${v}（期望 1）`)
  // 反向
  const back = makeTracker(-10).velocity(1020)
  assert.ok(back < 0, `v=${back}`)
})

test('停住 >100ms 再松手 → 速度为 0（不能用停住前的旧速度）', () => {
  // 手指停在 1020ms 处，到 1320ms 才松手 → 早已没有动量
  assert.equal(makeTracker().velocity(1320), 0)
  // 停 120ms 同样算停住（窗口 100ms）
  assert.equal(makeTracker().velocity(1140), 0)
  // 只停 40ms：窗口内仍有样本，动量保留
  assert.ok(makeTracker().velocity(1060) > 0)
})

test('慢速移动速度接近 0', () => {
  const slow = makeTracker(1, 100)
  assert.ok(Math.abs(slow.velocity(1200)) < 0.02)
})

test('样本不足 / reset 后速度恒为 0，不产生 NaN', () => {
  const t = createVelocityTracker()
  assert.equal(t.velocity(), 0)
  t.reset()
  t.add(5, 0)
  assert.equal(t.velocity(0), 0)
  t.reset()
  assert.equal(t.velocity(999999), 0)
})
