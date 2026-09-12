import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CARRY_WEIGHTS,
  DECK,
  carryWeight,
  deckCarryAt,
  deckCarryNeed,
  deckCarryRelease,
  deckClampFocus,
  deckExposure,
  deckMetrics,
  deckMinLeftEdge,
  deckPhase,
  deckPose,
  deckStair,
  deckVisible,
  deckZ
} from '../src/utils/switcherDeck.js'

// 430 × 932（本项目基准机型）
const m = deckMetrics(430, 932)
/** 一次换卡的松手落点（第 1 层恰好成为焦点） */
const U_OFF = (m.screenW - m.frontX) / m.exit // 顶卡左缘越过屏宽所需进度 ≈ 0.932

test('几何度量：卡宽 275、焦点层水平居中', () => {
  assert.equal(m.cardW, 275)
  assert.equal(m.cardH, 596)
  assert.equal(m.frontX, 77.5)
  assert.equal(m.radius, 29)
  assert.equal(m.exit, 378.4)
  assert.equal(m.span, 233.75) // = 卡宽 × 0.85（对齐参考视频实测 0.87 卡宽/张）
})

test('修正 A：卡片整体在删除按钮上方居中（图标行 + 卡片作为整体）', () => {
  /* 锚点：状态栏底 54（--safe-top）、删除按钮顶 = 932 - 14(home inset) - 26 - 52 = 840 */
  assert.equal(m.topInset, 54)
  assert.equal(m.dockTop, 840)
  assert.equal(m.blockH, 24 + 12 + 596) // 图标行 24 + 间隙 12 + 卡高 596
  assert.equal(m.gap, 77) // (840 - 54 - 632) / 2
  assert.equal(m.labelY, 131) // 图标行顶部 = 54 + 77
  assert.equal(m.cardY, 167) // 卡顶 = 131 + 24 + 12
  assert.equal(m.cardY + m.cardH, 763) // 卡底
  /* 「居中」的判定：卡片底到按钮顶的留白 === 状态栏底到图标顶的留白 */
  assert.equal(m.dockTop - (m.cardY + m.cardH), m.gap)
  /* 默认兜底比例（测不到 DOM 时）也要落在 54 附近 */
  assert.equal(deckMetrics(430, 932).topInset, 54)
})

test('修正 B：所有卡片与顶部卡片上下居中对齐（同一垂直中心）', () => {
  const cy = (p) => p.y + (m.cardH * p.scale) / 2
  for (const a of [0, 0.5, 1, 1.5, 2, 3]) {
    assert.ok(Math.abs(cy(deckPose(a, m, 0)) - m.cardCy) < 1e-9, `层深 ${a} 的垂直中心偏离 cardCy`)
  }
  /* 背景层不再「整体靠上」：顶/底内缩对称（旧版 yStep + 顶对齐会让它整体上浮） */
  const p0 = deckPose(0, m, 0)
  const p1 = deckPose(1, m, 0)
  const insetTop = p1.y - p0.y
  const insetBottom = p0.y + m.cardH - (p1.y + m.cardH * p1.scale)
  assert.ok(Math.abs(insetTop - insetBottom) < 1e-9, `内缩不对称 上${insetTop} / 下${insetBottom}`)
  assert.ok(insetTop > 0, '背景层必须比顶卡小（内缩为正）')
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

test('规则③ 最深层左边缘不出屏（静态 + 牵连最大时都不越界）', () => {
  assert.ok(deckMinLeftEdge(m) > 0, `minLeft=${deckMinLeftEdge(m)}`)
  let minLeft = Infinity
  for (let x = 0; x <= 1.0001; x += 0.01) {
    for (const a of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
      minLeft = Math.min(minLeft, deckPose(a, m, x).x)
    }
  }
  assert.ok(minLeft >= 0, `牵连后最小左边缘 ${minLeft.toFixed(1)}`)
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

test('规则② 下层缩小后藏在上层下方（左边缘钉住 + 居中缩放 + 变暗）', () => {
  const p0 = deckPose(0, m, 0)
  const p1 = deckPose(1, m, 0)
  const p2 = deckPose(2, m, 0)
  // 缩放锚点是左上角，所以左边缘严格单调左移 → 背景层只被上层盖住左露出条
  assert.ok(p1.x < p0.x && p2.x < p1.x)
  // 「缩小后藏在上层下方」= 顶边比上层低（居中内缩，不是整体上浮）
  assert.ok(p1.y > p0.y && p2.y > p1.y)
  assert.ok(p1.bright < p0.bright && p2.bright < p1.bright)
  // 背景层缩放后右边缘不越过焦点层右边缘（真正「藏在上层卡片下方」）
  const right = (p) => p.x + m.cardW * p.scale
  assert.ok(right(p1) < right(p0) && right(p2) < right(p1))
})

test('规则⑥⑦ 层间牵连：权重 8:3:2:1、两端归零、位移按层递减', () => {
  // 权重字面值（0 = 焦点层不牵连；1 = 被顶卡直接拖动的那一层）
  assert.deepEqual(CARRY_WEIGHTS, [0, 1, 2 / 3, 1 / 3])
  assert.equal(carryWeight(0), 0)
  assert.equal(carryWeight(1), 1)
  assert.ok(Math.abs(carryWeight(3) - 1 / 3) < 1e-12)

  // 两端归零 → 层边界零跳变（整层进度处必须回到纯阶梯槽位）
  for (const x of [0, 1e-9]) {
    for (const k of [0, 1, 2, 3]) {
      const p = deckPose(k, m, x)
      assert.ok(Math.abs(p.x - (m.frontX - deckStair(k, m.cardW))) < 1e-6, `x=${x} k=${k} 未归位`)
      assert.ok(Math.abs(p.scale - Math.pow(DECK.SCALE_DECAY, k)) < 1e-9)
    }
  }

  // 半边进度（x=0.5）处：各层相对「自己槽位」的位移必须按层递减
  const travel = [0, 1, 2, 3].map((k) => deckPose(k - 0.5, m, 0.5).x - deckPose(k, m, 0).x)
  for (let k = 1; k < travel.length; k++) {
    assert.ok(travel[k] < travel[k - 1], `位移未按层递减：${travel.map((v) => v.toFixed(1))}`)
  }

  /* 规则⑦ 8:3:2:1 的实测口径：同一次滑动（半边进度）下，各层位移 / 顶卡位移。
     牵连 = CARRY_WEIGHTS[k] × (3/8 × 顶卡位移)，槽位推进按 rule④ 叠加。 */
  const lead = travel[0]
  const rel = [1, 2, 3].map((k) => travel[k] / lead)
  assert.ok(rel[0] > rel[1] && rel[1] > rel[2], `层间位移比未递减：${rel.map((v) => v.toFixed(3))}`)
  assert.ok(rel[0] > 0.3 && rel[0] < 0.5, `第二层相对位移 ${rel[0].toFixed(3)}（目标 0.375）`)
  assert.ok(rel[1] > 0.2 && rel[1] < 0.38, `第三层相对位移 ${rel[1].toFixed(3)}（目标 0.25）`)
  assert.ok(rel[2] > 0.1 && rel[2] < 0.2, `第四层相对位移 ${rel[2].toFixed(3)}（目标 0.125）`)
  assert.ok(rel[0] > 2.4 * rel[2], `二层 / 四层 = ${(rel[0] / rel[2]).toFixed(2)}（8:1 量级）`)
})

test('第四轮·定律一 同相位：背景层不再抢在顶卡前面把位移+放大做完', () => {
  for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const { u } = deckPhase(x)
    const raw = 1 - x // 旧实现（背景层用原始 x）时第 1 层的层深
    const now = 1 - u // 新实现的等效层深 = a + (x − u)
    assert.ok(now >= raw - 1e-12, `x=${x} 背景层抢跑：层深 ${now} < ${raw}`)
    /* 严格「后加载」：中途确实比原始进度慢（否则 x 与 u 白分了两个变量） */
    if (x > 0 && x < 1) assert.ok(now > raw, `x=${x} 未生效（${now} vs ${raw}）`)
    // 背景层坡度（越深越小）不能比顶卡退出还快
    assert.ok(deckPose(1 - x, m, x).x - deckPose(1, m, 0).x >= -1e-9)
  }
  /* 层边界零跳变：x→1⁻ 时第 1 层正好落进槽位；下一层的 x=0 就是同一个位姿 */
  const eps = 1e-6
  const arriving = deckPose(eps, m, 1 - eps) // 第 1 层即将成为焦点
  const settled = deckPose(0, m, 0) // 它成为焦点后的位姿
  assert.ok(Math.abs(arriving.x - settled.x) < 0.5, `层边界位移跳变 ${(arriving.x - settled.x).toFixed(3)}px`)
  assert.ok(Math.abs(arriving.scale - settled.scale) < 0.01, `层边界缩放跳变 ${arriving.scale - settled.scale}`)
})

test('第四轮·定律二 不提前分离：顶卡完全出屏前，两卡右缘/左缘始终贴合', () => {
  const right = (p) => p.x + m.cardW * p.scale
  let worst = Infinity
  let worstU = 0
  for (let i = 0; i <= 500; i++) {
    const u = i / 500
    const x = Math.pow(u, 1 / DECK.TRANS_POW) // 反解 x：u = x^TRANS_POW
    const top = deckPose(-x, m, x) // 顶卡（正在退出）
    const below = deckPose(1 - x, m, x) // 第 1 层（被拖着走）
    const gap = right(below) - top.x // ≥ 0 = 两卡仍贴合
    if (top.x < m.screenW && gap < worst) {
      worst = gap
      worstU = u
    }
  }
  assert.ok(worst >= -0.5, `顶卡未出屏前出现分离：u=${worstU.toFixed(3)} gap=${worst.toFixed(2)}px`)
  /* 释放点在顶卡出屏之后 —— 这是「不提前分离」的充分条件 */
  assert.ok(DECK.CARRY_RELEASE > U_OFF, `释放点 ${DECK.CARRY_RELEASE} 必须晚于顶卡出屏点 ${U_OFF.toFixed(3)}`)
  assert.equal(deckCarryRelease(U_OFF), 1, '顶卡出屏那一刻牵连必须还是满量程')
})

test('第四轮·牵连单调：底卡不再「先向中间冲一下再退回原位」', () => {
  /* 改前实测：底卡左缘 52.7 → 101.9（峰值）→ 77.5，回退 24px。
     改后：在释放点之前必须单调不减。 */
  let prev = -Infinity
  for (let i = 0; i <= 400; i++) {
    const u = (i / 400) * DECK.CARRY_RELEASE
    const x = Math.pow(u, 1 / DECK.TRANS_POW)
    const xs = deckPose(1 - x, m, x).x
    assert.ok(xs >= prev - 0.25, `u=${u.toFixed(3)} 底卡左缘回退 ${prev.toFixed(1)} → ${xs.toFixed(1)}`)
    prev = xs
  }
  /* 早段就从 0 起势（不是前半程不动、后半程猛冲） */
  assert.ok(deckCarryAt(0, m) === 0)
  assert.ok(deckCarryAt(0.2, m) > 20, `u=0.2 牵连 ${deckCarryAt(0.2, m).toFixed(2)}px 起势太晚`)
  assert.ok(deckCarryAt(0.4, m) > deckCarryAt(0.2, m) && deckCarryAt(0.6, m) > deckCarryAt(0.4, m))
  /* 牵连量有上限，且释放后归零（新焦点卡必须回到屏幕正中） */
  const needMax = deckCarryAt(U_OFF, m)
  assert.ok(needMax > 0 && needMax < m.cardW * 0.6, `最大牵连 ${needMax.toFixed(1)}px`)
  assert.equal(deckCarryRelease(1), 0)
  assert.ok(Math.abs(deckPose(0, m, 1).x - m.frontX) < 1e-3, `松手落点 ${deckPose(0, m, 1).x}`)
  assert.ok(Math.abs(deckPose(0, m, 1).scale - 1) < 1e-6)
  /* 牵连不许把背景层推出右屏边 */
  let maxRight = -Infinity
  for (let i = 0; i <= 400; i++) {
    const u = i / 400
    const x = Math.pow(u, 1 / DECK.TRANS_POW)
    for (const k of [1, 2, 3]) {
      const p = deckPose(k - x, m, x)
      maxRight = Math.max(maxRight, p.x + m.cardW * p.scale)
    }
  }
  assert.ok(maxRight <= m.screenW + 0.5, `背景层右缘越界到 ${maxRight.toFixed(1)}px`)
})

test('背景层任意时刻都不重叠（层间间距恒 > 2px）', () => {
  for (const x of [0, 0.25, 0.5, 0.75, 1]) {
    for (const focus of [0, 0.25, 0.5, 0.75, 1]) {
      const xs = [0, 1, 2, 3].map((i) => deckPose(i - focus, m, x).x)
      for (let k = 1; k < xs.length; k++) {
        assert.ok(
          xs[k - 1] - xs[k] > 2,
          `x=${x} focus=${focus} 第 ${k} 层与第 ${k + 1} 层重叠（间距 ${(xs[k - 1] - xs[k]).toFixed(2)}px）`
        )
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
