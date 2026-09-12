import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DECK,
  FAN_WEIGHTS,
  deckClampFocus,
  deckExposure,
  deckFan,
  deckMetrics,
  deckMinLeftEdge,
  deckPose,
  deckStair,
  deckVisible,
  deckZ,
  fanWeight
} from '../src/utils/switcherDeck.js'

// 430 × 932（本项目基准机型）
const m = deckMetrics(430, 932)

test('几何度量：卡宽 275、焦点层水平居中', () => {
  assert.equal(m.cardW, 275)
  assert.equal(m.cardH, 596)
  assert.equal(m.cardY, 84)
  assert.equal(m.frontX, 77.5)
  assert.equal(m.radius, 29)
  assert.equal(m.exit, 378.4)
  assert.equal(m.span, 165)
})

test('规则④ 阶梯式缩小 + 露出越来越少', () => {
  const exp = [1, 2, 3].map((k) => deckExposure(k, m.cardW))
  // 严格递减，且首层露出明显大于末层
  assert.ok(exp[0] > exp[1] && exp[1] > exp[2], `露出序列 ${exp.join('/')}`)
  assert.ok(exp[0] > 2.5 * exp[2], `首/末 = ${(exp[0] / exp[2]).toFixed(2)}`)
  // 露出宽度 33 / 18 / 10（±1px）
  assert.ok(Math.abs(exp[0] - 33) <= 1, `exp1=${exp[0]}`)
  assert.ok(Math.abs(exp[1] - 18.15) <= 1.2, `exp2=${exp[1]}`)
  assert.ok(Math.abs(exp[2] - 9.98) <= 1.2, `exp3=${exp[2]}`)
  // 缩放按层等比递减
  const scales = [0, 1, 2, 3].map((k) => deckPose(k, m, 0).scale)
  for (let k = 1; k < scales.length; k++) assert.ok(scales[k] < scales[k - 1], `scale ${scales}`)
  assert.ok(Math.abs(scales[3] - 0.8306) < 0.01, `${scales[3]}`)
})

test('规则③ 最深层左边缘不出屏（静态 + 扇开最大时都不越界）', () => {
  assert.ok(deckMinLeftEdge(m) > 0, `minLeft=${deckMinLeftEdge(m)}`)
  const fanMax = deckFan(m.span / 2, m.span) // 扇开峰值（正向）
  let minLeft = Infinity
  for (const focus of [0, 0.25, 0.5, 0.75, 1]) {
    for (const a of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
      minLeft = Math.min(minLeft, deckPose(a + focus * 0, m, fanMax).x)
    }
  }
  assert.ok(minLeft >= 0, `扇开后最小左边缘 ${minLeft.toFixed(1)}`)
})

test('规则① 层级只由索引决定，永不随焦点变化', () => {
  const base = [0, 1, 2, 3].map(deckZ)
  for (const focus of [0, 0.37, 1, 2.4, 3]) {
    for (let i = 0; i < 4; i++) assert.equal(deckZ(i), base[i], `focus=${focus} i=${i}`)
  }
  // i 越小越靠上（严格）
  for (let i = 1; i < 4; i++) assert.ok(deckZ(i) < deckZ(i - 1))
})

test('规则⑤ 最多四层：4 个槽位 + 1 张正在离场的卡，第 5 层起不渲染', () => {
  assert.equal(DECK.MAX_DEPTH, 3)
  assert.ok(deckVisible(3), '第 4 层（最深槽位）必须渲染')
  assert.ok(!deckVisible(3.01), '超过第 4 个槽位即剔除')
  assert.ok(!deckVisible(4), '第 5 张在层深 4 处必须剔除')
  assert.ok(deckVisible(-1), '正在离场的那张要留到完全出屏')
  assert.ok(!deckVisible(-1.02 - 1e-6))
})

test('规则② 下层缩小后藏在上层下方（左边缘钉住 + y 下移 + 变暗）', () => {
  const p0 = deckPose(0, m, 0)
  const p1 = deckPose(1, m, 0)
  const p2 = deckPose(2, m, 0)
  // 缩放锚点是左上角，所以左边缘严格单调左移 → 背景层只被上层盖住左露出条
  assert.ok(p1.x < p0.x && p2.x < p1.x)
  assert.ok(p1.y > p0.y && p2.y > p1.y)
  assert.ok(p1.bright < p0.bright && p2.bright < p1.bright)
  // 背景层缩放后右边缘不越过焦点层右边缘（真正「藏在上层卡片下方」）
  const right = (p) => p.x + m.cardW * p.scale
  assert.ok(right(p1) < right(p0) && right(p2) < right(p1))
})

test('规则⑥⑦ 拖动期扇开：8:3:2:1（实测比例）', () => {
  // 正弦包络：整层处归零、半层处最大 → 交接零跳变
  assert.ok(Math.abs(deckFan(m.span, m.span)) < 1e-9)
  assert.ok(Math.abs(deckFan(0, m.span)) < 1e-9)
  assert.ok(Math.abs(deckFan(-m.span, m.span)) < 1e-9)
  assert.ok(Math.abs(deckFan(m.span / 2, m.span) - 1) < 1e-9)
  // 反向拖动（往更新的卡）不扇开：扇开若与阶梯同向会叠加成碰撞（实测两层压成一张）
  assert.equal(deckFan(-m.span / 2, m.span), 0)
  assert.equal(deckFan(-1, m.span), 0)

  // 权重字面值 = 8:3:2:1
  assert.deepEqual(FAN_WEIGHTS, [1, 0.375, 0.25, 0.125])
  assert.equal(fanWeight(0), 1)
  assert.equal(fanWeight(1), 0.375)
  assert.equal(fanWeight(3), 0.125)

  // 半层处实测各层位移，归一化后应接近 8:3:2:1
  const fanN = deckFan(m.span / 2, m.span)
  const travel = [0, 1, 2, 3].map((k) => {
    const rest = deckPose(k, m, 0).x
    const now = deckPose(k - 0.5, m, fanN).x
    return now - rest
  })
  for (let k = 1; k < travel.length; k++) assert.ok(travel[k] < travel[k - 1], `位移递减 ${travel.map((v) => v.toFixed(1))}`)
  const rel = travel.map((v) => v / travel[3])
  assert.ok(rel[0] > 6.5 && rel[0] < 9, `顶卡相对位移 ${rel[0].toFixed(2)}（目标 8）`)
  assert.ok(rel[1] > 2.4 && rel[1] < 4.1, `第二层 ${rel[1].toFixed(2)}（目标 3）`)
  assert.ok(rel[2] > 1.3 && rel[2] < 2.3, `第三层 ${rel[2].toFixed(2)}（目标 2）`)
})

test('背景层任意时刻都不重叠（反向拖动也不许压成一张）', () => {
  for (const [dx, fanN] of [[m.span / 2, deckFan(m.span / 2, m.span)], [-m.span / 2, deckFan(-m.span / 2, m.span)]]) {
    void dx
    for (const focus of [0, 0.25, 0.5, 0.75, 1]) {
      const xs = [0, 1, 2, 3].map((i) => deckPose(i - focus, m, fanN).x)
      for (let k = 1; k < xs.length; k++) {
        assert.ok(xs[k - 1] - xs[k] > 2, `focus=${focus} 第 ${k} 层与第 ${k + 1} 层重叠（间距 ${(xs[k - 1] - xs[k]).toFixed(2)}px）`)
      }
    }
  }
})

test('交接零跳变：整层拖动后新焦点卡正好落在屏幕正中', () => {
  // focus = 1（拖满一整层、扇开已归零）
  const exit = deckPose(0, m, 0) // 旧焦点卡：a = 1 - 1 = 0 → 但用 a=-1 表示它已退出
  void exit
  const leaving = deckPose(-1, m, 0)
  const incoming = deckPose(0, m, 0)
  assert.equal(incoming.x, m.frontX)
  assert.equal(incoming.scale, 1)
  // 退出卡完全离开屏幕（右边缘之外）
  assert.ok(leaving.x >= m.screenW, `退出卡左边缘 ${leaving.x} 应 ≥ ${m.screenW}`)
  // 退出卡保持满尺寸满亮度（规则①：走到屏幕外一直是「顶层那张」）
  assert.equal(leaving.scale, 1)
  assert.equal(leaving.bright, 1)
  // 幂律斜坡起步接近 1:1 跟手（0.25 层只走满量程的 ~11%）
  const q = deckPose(-0.25, m, 0)
  assert.ok(q.x - m.frontX < 50, `0.25 层位移 ${(q.x - m.frontX).toFixed(1)}px`)
})

test('越界阻尼：两端都压扁且不失控', () => {
  // n = 4 张卡 → 合法区间 0..3
  assert.equal(deckClampFocus(1.5, 4), 1.5)
  assert.equal(deckClampFocus(3, 4), 3)
  assert.ok(deckClampFocus(3.5, 4) < 3.5 && deckClampFocus(3.5, 4) > 3)
  assert.ok(deckClampFocus(-1, 4) > -1 && deckClampFocus(-1, 4) <= 0)
  assert.ok(deckClampFocus(-99, 4) >= -0.6)
  assert.ok(deckClampFocus(99, 4) <= 3.6)
})

test('阶梯单调性：层深连续变化时位移平滑（无阶跃）', () => {
  let prev = deckPose(0, m, 0).x
  for (let a = 0.05; a <= 3.0001; a += 0.05) {
    const x = deckPose(a, m, 0).x
    assert.ok(x <= prev + 1e-9, `a=${a.toFixed(2)} 位移回升 ${prev}→${x}`)
    assert.ok(prev - x < 12, `a=${a.toFixed(2)} 单步跳变过大 ${(prev - x).toFixed(2)}px`)
    prev = x
  }
})

test('卡宽为 0（未测量）时不抛异常', () => {
  const z = deckMetrics(0, 0)
  const p = deckPose(1, z, 0)
  assert.equal(Number.isFinite(p.x), true)
  assert.equal(deckStair(2, 0), 0)
})
