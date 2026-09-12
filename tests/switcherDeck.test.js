import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DECK,
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

test('规则⑥⑦ 层间位移按层递减（由 stair 的几何级数天然给出，不再叠加任何包络）', () => {
  // 两端 = 纯阶梯槽位 → 层边界零跳变（拖满整层时必须正好落进槽位）
  for (const x of [0, 1e-9]) {
    for (const k of [0, 1, 2, 3]) {
      const p = deckPose(k, m, x)
      assert.ok(Math.abs(p.x - (m.frontX - deckStair(k, m.cardW))) < 1e-6, `x=${x} k=${k} 未归位`)
      assert.ok(Math.abs(p.scale - Math.pow(DECK.SCALE_DECAY, k)) < 1e-9)
    }
  }

  /* 一整层的净位移：
       travel[0] = 顶卡退出（frontX → frontX + exit，量级 ~378px）
       travel[d] = 第 d 层被推进一级槽位 = stair(d) − stair(d−1)  */
  const travel = [0, 1, 2, 3].map((d) => deckPose(d - 1, m, 1 - 1e-9).x - deckPose(d, m, 0).x)

  for (let k = 1; k < travel.length; k++) {
    assert.ok(travel[k] < travel[k - 1], `位移未按层递减：${travel.map((v) => v.toFixed(1))}`)
  }
  assert.ok(travel[3] > 0, '最深层也必须真的往右走')

  /* 层间比例 = STAIR_DECAY 的幂：第二层 : 第三层 : 第四层 = 1 : 0.55 : 0.30。
     这是 stair 的几何级数决定的，改 STAIR_DECAY 就会同步变。 */
  assert.ok(Math.abs(travel[2] / travel[1] - DECK.STAIR_DECAY) < 1e-9, `第三层/第二层 = ${(travel[2] / travel[1]).toFixed(4)}`)
  assert.ok(
    Math.abs(travel[3] / travel[1] - DECK.STAIR_DECAY ** 2) < 1e-9,
    `第四层/第二层 = ${(travel[3] / travel[1]).toFixed(4)}`
  )
  /* 顶卡与第二层的量级差（如实记录：≈11.5:1）。
     第四轮曾用牵连包络把第二层顶到 3/8，但那必然带来回退（见定律三）。 */
  assert.ok(travel[0] / travel[1] > 10, `顶卡/第二层 = ${(travel[0] / travel[1]).toFixed(2)}`)
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

test('第五轮·定律三 不得回退：整段拖动（含顶卡出屏之后）背景层只许向右', () => {
  /* 改前实测：慢拖 1.25 层，卡 1 左缘 峰值 156.1 → 78.7，单次回退 77.4px，
     且随后还有 118.7 → 81.3 的二次回退 —— 就发生在顶卡出屏之后。
     根因是牵连释放包络必须在一层末尾归零。本轮直接去掉牵连。 */
  for (const d of [1, 2, 3]) {
    let prevX = -Infinity
    let prevS = -Infinity
    for (let i = 0; i <= 2000; i++) {
      const x = i / 2000
      const p = deckPose(d - x, m, x)
      assert.ok(
        p.x >= prevX - 1e-9,
        `depth${d} 位置回退：x=${x.toFixed(4)} ${prevX.toFixed(2)} → ${p.x.toFixed(2)}`
      )
      assert.ok(p.scale >= prevS - 1e-12, `depth${d} 缩放回退：x=${x.toFixed(4)}`)
      prevX = p.x
      prevS = p.scale
    }
  }

  /* 断言盲区修复：第四轮只检查「顶卡还在屏内」那一段单调，而出屏点之后
     恰好是 release 塌缩的区间。这里显式覆盖出屏之后的半层。
     注意这段的自然位移只有 ~2.9px —— 正因为如此，改前那 77px 的回退才会
     显得像「啪地跳回去」：整层最后 4% 的自然行程根本撑不起 77px 的回退。 */
  const xOff = Math.pow(U_OFF, 1 / DECK.TRANS_POW)
  const atOff = deckPose(1 - xOff, m, xOff).x
  const atEnd = deckPose(0, m, 1 - 1e-9).x
  assert.ok(atEnd > atOff, `顶卡出屏后底卡仍回退：${atOff.toFixed(2)} → ${atEnd.toFixed(2)}`)
  assert.ok(atEnd - atOff > 1, `出屏后底卡只走了 ${(atEnd - atOff).toFixed(2)}px`)
  assert.ok(atEnd - atOff < 6, `出屏后底卡走太多（${(atEnd - atOff).toFixed(2)}px）→ 说明又出现了额外包络`)
})

test('第五轮·几何必然：居中布局下两卡的「贴合」只可能维持到 x≈0.72', () => {
  /* 这不是缺陷，是几何：顶卡左缘到屏宽 430 时，居中底卡（scale 1）的右缘最多
     frontX + cardW = 352.5px —— 必然留下 ~77px 空隙。要全程贴合只有两条路：
       ① 让底卡在拖动中放大到 ≈1.28 倍（参考机那种更深的堆叠）；
       ② 允许底卡先冲过头再退回（Ricky 第五轮已否决）。
     所以这里断言的是「重叠窗口足够长」，并把几何上限固定在测试里。 */
  const right = (p) => p.x + m.cardW * p.scale
  let lastOverlapX = 0
  let minGapOnScreen = Infinity
  for (let i = 0; i <= 500; i++) {
    const x = i / 500
    const top = deckPose(-x, m, x)
    const below = deckPose(1 - x, m, x)
    const gap = right(below) - top.x
    if (gap >= 0) lastOverlapX = x
    if (top.x < m.screenW) minGapOnScreen = Math.min(minGapOnScreen, gap)
  }
  assert.ok(lastOverlapX > 0.6, `两卡过早分离：最后重叠于 x=${lastOverlapX.toFixed(3)}`)
  /* 如实记录：顶卡在屏内时确实会出现空隙，最深到 -81px（就是「顶卡快出屏」那段）。
     本轮接受它，换取「绝不在拖动中往左走」。 */
  assert.ok(minGapOnScreen < 0 && minGapOnScreen > -85, `屏内最小贴合差 ${minGapOnScreen.toFixed(1)}px`)
  const maxReach = m.frontX + m.cardW
  assert.ok(maxReach < m.screenW - 70, `底卡满尺寸居中时的右缘上限 ${maxReach} 距屏宽不足 70px`)
})

test('第五轮：位移与放大「同时」发生（同相位，不是先位移后放大）', () => {
  /* depth1 在整层内位置与缩放都严格单调，且推进节奏一致 ——
     这是「一边被拖着走、一边放大」的量化判据。 */
  const pts = [0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => {
    const x = Math.min(v, 1 - 1e-9)
    return deckPose(1 - x, m, x)
  })
  for (let k = 1; k < pts.length; k++) {
    assert.ok(pts[k].x > pts[k - 1].x, `位置未推进：x=${k}`)
    assert.ok(pts[k].scale > pts[k - 1].scale, `缩放未推进：x=${k}`)
  }
  const totalX = pts[5].x - pts[0].x
  const totalS = pts[5].scale - pts[0].scale
  /* 「同时」的严格判据：找出「位移刚好走到 25%」的那个 x，此刻缩放也必须
     已经走过 ≥20%。如果是「先位移、后放大」，这里会接近 0。 */
  const frac = (p) => ({ x: (p.x - pts[0].x) / totalX, s: (p.scale - pts[0].scale) / totalS })
  let syncAt = null
  for (let i = 1; i <= 400; i++) {
    const v = (i / 400) * 0.9
    const p = deckPose(1 - v, m, v)
    const f = frac(p)
    if (f.x >= 0.25) {
      syncAt = { v, f }
      break
    }
  }
  assert.ok(syncAt, '位移在整层内没走到 25%？')
  assert.ok(
    syncAt.f.s >= 0.2,
    `位移走到 25% 时缩放只走了 ${(syncAt.f.s * 100).toFixed(0)}% → 两者不同步（先位移后放大）`
  )
  assert.ok(syncAt.f.x < 0.35, `位移跳太快：${(syncAt.f.x * 100).toFixed(0)}%`)
  /* 反过来：缩放不许领先位移太多（否则就是「先放大后位移」） */
  assert.ok(syncAt.f.s - syncAt.f.x < 0.15, `缩放比位移超前 ${((syncAt.f.s - syncAt.f.x) * 100).toFixed(0)}%`)

  // 松手落点：新焦点卡回到屏幕正中、满尺寸
  assert.ok(Math.abs(deckPose(0, m, 1).x - m.frontX) < 1e-3, `松手落点 ${deckPose(0, m, 1).x}`)
  assert.ok(Math.abs(deckPose(0, m, 1).scale - 1) < 1e-6)

  // 背景层右缘永不越出屏幕
  let maxRight = -Infinity
  for (let i = 0; i <= 400; i++) {
    const x = i / 400
    for (const d of [1, 2, 3]) {
      const p = deckPose(d - x, m, x)
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
