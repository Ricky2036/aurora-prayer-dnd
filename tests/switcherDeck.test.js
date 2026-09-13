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
const U_OFF = (m.screenW - m.frontX) / m.exit // 顶卡左缘越过屏宽所需进度 ≈ 1.51（第六轮）

test('几何度量：卡宽 275、焦点层水平居中', () => {
  assert.equal(m.cardW, 275)
  assert.equal(m.cardH, 596)
  assert.equal(m.frontX, 77.5)
  assert.equal(m.radius, 29)
  assert.ok(Math.abs(m.exit - 233.92) < 1e-9) // = 屏宽 × 0.544 = 卡宽 × 0.85 = 一张卡的手指行程（第六轮）
  assert.equal(m.span, 233.75) // = 卡宽 × 0.85（对齐参考视频实测 0.87 卡宽/张）
  /* 第六轮核心契约：离场槽距 ≡ 一次换卡的手指行程 → 离场卡 1:1 跟手 */
  assert.ok(Math.abs(m.exit - m.span) < 0.5, `exit=${m.exit} span=${m.span}`)
})

test('修正 A：卡片整体在删除按钮上方居中（图标行 + 卡片作为整体）', () => {
  /* 锚点：状态栏底 54（--safe-top）、删除按钮顶 = 932 - 14(home inset) - 50 - 52 = 816
     （第七轮：DOCK_GAP 26 → 50，垃圾桶整体抬高 24px，对齐真机参考图的 ≈65px） */
  assert.equal(m.topInset, 54)
  assert.equal(m.dockTop, 816)
  assert.equal(m.blockH, 24 + 12 + 596) // 图标行 24 + 间隙 12 + 卡高 596
  assert.equal(m.gap, 65) // (816 - 54 - 632) / 2
  assert.equal(m.labelY, 119) // 图标行顶部 = 54 + 65
  assert.equal(m.cardY, 155) // 卡顶 = 119 + 24 + 12
  assert.equal(m.cardY + m.cardH, 751) // 卡底
  /* 「居中」的判定：卡片底到按钮顶的留白 === 状态栏底到图标顶的留白 */
  assert.equal(m.dockTop - (m.cardY + m.cardH), m.gap)
  /* 默认兜底比例（测不到 DOM 时）也要落在 54 附近 */
  assert.equal(deckMetrics(430, 932).topInset, 54)
  /* 第七轮：垃圾桶底边距屏幕底 = home inset + DOCK_GAP，目标 ≈65px（真机参考图实测） */
  assert.equal(m.dockTop + DECK.DOCK_SIZE + DECK.DOCK_GAP + DECK.DEFAULT_HOME_INSET, 932)
  assert.equal(932 - (m.dockTop + DECK.DOCK_SIZE), 64)
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
  assert.ok(exp[0] > 8 * exp[2], `首/末 = ${(exp[0] / exp[2]).toFixed(2)}`)
  /* 第六轮：逐帧量测参考视频 → 新来卡每滑一张右移 51~56px（444 屏 / 293 卡宽 = 0.17~0.21）。
     本项目卡宽 275 → exp1 = stair(1) 应落在 47~57px。旧值 33px 被判「一次只能滑走一张」。 */
  assert.ok(exp[0] >= 47 && exp[0] <= 57, `exp1=${exp[0]}（期望 52 = 0.19 卡宽）`)
  assert.ok(Math.abs(exp[0] - 52.25) <= 1, `exp1=${exp[0]}`)
  assert.ok(Math.abs(exp[1] - 16.72) <= 1.2, `exp2=${exp[1]}`)
  assert.ok(Math.abs(exp[2] - 5.34) <= 1.2, `exp3=${exp[2]}`)
  // 缩放按层等比递减（第七轮：只到 MAX_DEPTH 层 —— 更深层在 deckPose 里被夹住）
  const scales = [0, 1, 2].map((k) => deckPose(k, m, 0).scale)
  for (let k = 1; k < scales.length; k++) assert.ok(scales[k] < scales[k - 1], `scale ${scales}`)
  assert.ok(Math.abs(scales[2] - 0.8836) < 0.01, `${scales[2]}`)
  assert.ok(Math.abs(scales[2] - DECK.SCALE_DECAY ** 2) < 1e-9)
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

test('规则⑤ 最多三层：3 个槽位 + 正在离场的卡，第 4 层起不渲染', () => {
  /* 第七轮：MAX_DEPTH 3 → 2（Ricky 需求⑨「默认堆叠状态从四层改为三层」） */
  assert.equal(DECK.MAX_DEPTH, 2)
  assert.ok(deckVisible(2), '第 3 层（最深槽位）必须渲染')
  assert.ok(!deckVisible(2.01), '超过第 3 个槽位即剔除')
  assert.ok(!deckVisible(3), '第 4 张在层深 3 处必须剔除')
  /* 第六轮：离场卡到 a ≈ -1.51 才越过右屏边（frontX + 233.92×1.51 ≈ 431），
     所以剔除界从 -1.02 放宽到 -1.56，保证出屏全程有 DOM 可画。 */
  assert.ok(deckVisible(-1), '刚换出去的那张要留在屏内露出（参考视频实测露出 ≈96px）')
  assert.ok(deckVisible(-1.5), '还没完全出屏的离场卡不能提前剔除')
  assert.ok(!deckVisible(-1.56 - 1e-6), '越过右屏边后剔除')
  assert.ok(!deckVisible(-2), '再往外一层必须剔除')
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
    for (const k of [0, 1, 2]) {
      const p = deckPose(k, m, x)
      assert.ok(Math.abs(p.x - (m.frontX - deckStair(k, m.cardW))) < 1e-6, `x=${x} k=${k} 未归位`)
      assert.ok(Math.abs(p.scale - Math.pow(DECK.SCALE_DECAY, k)) < 1e-9)
    }
  }

  /* 一整层的净位移（第七轮：三层堆叠 → 只到 d = 2）：
       travel[0] = 顶卡退出（frontX → frontX + exit，量级 ~234px）
       travel[d] = 第 d 层被推进一级槽位 = stair(d) − stair(d−1)  */
  const travel = [0, 1, 2].map((d) => deckPose(d - 1, m, 1 - 1e-9).x - deckPose(d, m, 0).x)

  for (let k = 1; k < travel.length; k++) {
    assert.ok(travel[k] < travel[k - 1], `位移未按层递减：${travel.map((v) => v.toFixed(1))}`)
  }
  assert.ok(travel[2] > 0, '最深层也必须真的往右走')

  /* 层间比例 = STAIR_DECAY 的幂：第二层 : 第三层 = 1 : 0.32。
     这是 stair 的几何级数决定的，改 STAIR_DECAY 就会同步变。 */
  assert.ok(Math.abs(travel[2] / travel[1] - DECK.STAIR_DECAY) < 1e-9, `第三层/第二层 = ${(travel[2] / travel[1]).toFixed(4)}`)
  /* 顶卡（离场卡）与第二层的量级差：第六轮逐帧实测参考视频 = 272 : 55 ≈ 4.9 : 1。
     本项目 = exit : stair(1) = 233.92 : 52.25 ≈ 4.5 : 1。
     第五轮是 378.4 : 33 ≈ 11.5 : 1 —— 正是 Ricky 口中的「一次只能滑走一张」。 */
  {
    const ratio = travel[0] / travel[1]
    assert.ok(ratio > 4 && ratio < 5.5, `顶卡/第二层 = ${ratio.toFixed(2)}（参考实测 4.9）`)
  }
})

test('第六轮·连锁：整条链从第一帧起与手指同速推进（u = x，不再后加载）', () => {
  /* 第五轮 u = x^1.6 ⇒ 前 1/3 段背景层几乎不动（x=0.2 时只走了 4%），
     叠加 stair(1)=33px，观感就是「只有顶卡在动」。
     第六轮 u = x：离场卡位移 = span·x（1:1 跟手），背景层也从第一帧就动。 */
  assert.equal(DECK.TRANS_POW, 1)
  assert.equal(DECK.EXIT_POW, 1)
  for (const x of [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
    const { u } = deckPhase(x)
    assert.ok(Math.abs(u - x) < 1e-12, `u ≠ x：${u}`)
    // 背景层从第一帧就在推进（旧实现 x=0.02 时推进量 ≈ 0）
    const moved = deckPose(1 - x, m, x).x - deckPose(1, m, 0).x
    assert.ok(moved > 0, `x=${x} 背景层未动`)
    /* 「不抢跑」：归一化进度上，背景层 (stair(1) − stair(1−x))/stair(1)
       永远不超过离场卡的进度 x（因为 stair 是凹/凸单调的几何级数）。 */
    const bgProgress = moved / deckExposure(1, m.cardW)
    assert.ok(bgProgress <= x + 1e-9, `x=${x} 背景层抢跑：${(bgProgress * 100).toFixed(1)}% > ${(x * 100).toFixed(0)}%`)
  }
  /* 1:1 跟手：离场卡一整层的位移 ≡ 一次换卡的手指行程 */
  const exitTravel = deckPose(-(1 - 1e-9), m, 1 - 1e-9).x - m.frontX
  assert.ok(Math.abs(exitTravel - m.span) < 0.5, `离场位移 ${exitTravel.toFixed(2)} ≟ 手指行程 ${m.span}`)

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

  /* 断言盲区修复（第六轮改写）：第五轮的那段断言以「顶卡出屏点」为锚，
     但第六轮把离场卡改成「一次换卡只走到右屏边内侧」（a = -1，仍在屏内），
     出屏要等第二次换卡（a = -2）。所以这里改成直接断言两件事：
       ① 离场卡在整层里（a: 0 → -1）严格单调右移，一帧不回退；
       ② 一次换卡后它仍在屏内露出，第二次换卡才真正出屏。 */
  let prevExit = -Infinity
  for (let i = 0; i <= 2000; i++) {
    const x = i / 2000
    const p = deckPose(-x, m, x)
    assert.ok(
      p.x >= prevExit - 1e-9,
      `离场卡回退：x=${x.toFixed(4)} ${prevExit.toFixed(2)} → ${p.x.toFixed(2)}`
    )
    prevExit = p.x
  }
  const parked = deckPose(-1, m, 0)
  const peek = m.screenW - parked.x
  assert.ok(peek > 60 && peek < 170, `换一张后离场卡露出 ${peek.toFixed(1)}px（参考实测 ≈96px）`)
  assert.ok(deckPose(-2, m, 0).x >= m.screenW, `换两张后仍未出屏：${deckPose(-2, m, 0).x.toFixed(1)}`)
})

test('第六轮·连锁：整段拖动里两卡始终重叠（第五轮的 ≈77px 空隙消失）', () => {
  /* 第五轮的「几何必然」：顶卡一次飞出 378px，而居中底卡的右缘最多只能到
     frontX + cardW = 352.5px ⇒ 顶卡还在屏内时就已经裂开 ≈81px 空隙 —— 这正是
     Ricky 看到的「顶卡独自飞走、底下的卡没跟上」。
     第六轮把离场卡的一层行程压到 233.9px（= 一次换卡的手指行程，1:1 跟手），
     于是顶卡左缘最多到 frontX + exit = 311.4px，恒小于底卡右缘 352.5px
     ⇒ **全程重叠，永不出现空隙**（= 用户要的「粘连在一起被拉走」）。

     注意：重叠只是「不分离」，不是「反向运动」—— 两卡的位置在整个 x∈[0,1]
     里都各自严格单调右移（由「定律三」用例守护）。 */
  const right = (p) => p.x + m.cardW * p.scale
  let minGap = Infinity
  let maxGap = -Infinity
  for (let i = 0; i <= 500; i++) {
    const x = i / 500
    const top = deckPose(-x, m, x) // 正在离场的那张
    const below = deckPose(1 - x, m, x) // 顶上来的那张
    const gap = right(below) - top.x
    minGap = Math.min(minGap, gap)
    maxGap = Math.max(maxGap, gap)
  }
  assert.ok(minGap > 0, `拖动中两卡出现空隙 ${minGap.toFixed(1)}px（第六轮应为恒重叠）`)
  assert.ok(minGap < 60, `末尾重叠过多 ${minGap.toFixed(1)}px → 离场卡几乎没走`)
  assert.ok(maxGap < m.cardW, `起始重叠超过一张卡宽 ${maxGap.toFixed(1)}px → 布局异常`)
  /* 副产物：静止态离场卡仍在屏内（旧值 455.9 > 430），这也是「连锁感」的来源之一 */
  assert.ok(deckPose(-1, m, 0).x < m.screenW, `静止态离场卡左缘 ${deckPose(-1, m, 0).x.toFixed(1)} 已出屏`)
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
  /* 第七轮：三层堆叠 → 只检查 3 个槽位之间的 2 处间距 */
  for (const x of [0, 0.25, 0.5, 0.75, 1]) {
    for (const focus of [0, 0.25, 0.5, 0.75, 1]) {
      const xs = [0, 1, 2].map((i) => deckPose(i - focus, m, x).x)
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
  const leaving = deckPose(-1, m, 0)
  const incoming = deckPose(0, m, 0)
  assert.equal(incoming.x, m.frontX)
  assert.equal(incoming.scale, 1)
  /* 第六轮：退出卡在换一张后【仍停在右屏边内侧】（对齐参考视频实测露出 ≈96px），
     换第二张才真正出屏 —— 旧契约「一张就出屏」是 Ricky 否掉的「独自飞走」。 */
  assert.ok(leaving.x < m.screenW, `退出卡左边缘 ${leaving.x.toFixed(1)} 应仍 < 屏宽 ${m.screenW}`)
  assert.ok(m.screenW - leaving.x > 60, `退出卡露出只有 ${(m.screenW - leaving.x).toFixed(1)}px`)
  assert.ok(deckPose(-2, m, 0).x > m.screenW, '换第二张后应已出屏')
  // 退出卡保持满尺寸满亮度（规则①：走到屏幕外一直是「顶层那张」）
  assert.equal(leaving.scale, 1)
  assert.equal(leaving.bright, 1)
  /* 第六轮：线性斜坡 ⇒ 严格 1:1 跟手（0.25 层 = 满量程的 25%；旧 1.6 次幂只有 ~11%） */
  const q = deckPose(-0.25, m, 0)
  const quarter = (q.x - m.frontX) / (leaving.x - m.frontX)
  assert.ok(Math.abs(quarter - 0.25) < 1e-9, `0.25 层只走了 ${(quarter * 100).toFixed(1)}%（应 25%）`)
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
