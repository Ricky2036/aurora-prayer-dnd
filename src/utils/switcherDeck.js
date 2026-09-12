/**
 * Recent 堆叠几何 —— 纯函数（无 Vue / 无 DOM），AppSwitcher 与单测共用。
 *
 * Ricky 2026-09-12 定的七条硬规则：
 *   ① 「层级关系不变，顶层的卡片一直到滑动到屏幕外都要在顶层」
 *      → z 只由【列表索引 i】决定：z(i) = Z_BASE - i，永远不随焦点变化。
 *   ② 「下层卡片缩小后藏在上层卡片下方」
 *      → 背景层向左阶梯铺开 + 按层等比缩小。
 *   ③ 「左侧边缘不超出屏幕左侧边框」
 *      → 最深层的左边缘 = frontX - stair(3) > 0（430 屏上 16.4px，再叠硬 clamp 兜底）。
 *   ④ 「底层卡片成阶梯式缩小，露出越来越少」
 *      → 几何级数：stair(k) = base·(1-decay^k)/(1-decay)。
 *   ⑤ 「同时最多展示四层」→ MAX_DEPTH = 3（焦点层 + 3 层背景）。
 *   ⑥ 「根据滑动的距离动态调整顶卡与第二三四层的[间距]」
 *      → 拖动期叠加一个「牵连」位移，幅度随【层过渡进度】走（两端归零）。
 *   ⑦ 「同样滑动距离顶层移动距离 8:3:2:1」
 *      → 牵连权重 CARRY_WEIGHTS = [0, 1, 0.6, 0.36] 按层递减。
 *
 * ── 2026-09-12 第三轮（Ricky 提交参考视频后的四条修正）──
 *   A. 「卡片整体位置太靠上了，改为在删除按钮上方居中显示」
 *      → 不再用固定 Y_FRAC，改为【「图标行 + 间隙 + 卡片」作为整体，垂直居中于
 *        [状态栏底, 删除按钮顶] 区间】。实测参考视频：状态栏底 45、按钮顶 830（444×960），
 *        整体 97~784 → 中心 440.5，与区间中心 437.5 吻合（误差 3px）。
 *   B. 「卡片堆叠后方的卡片整体靠上，改为所有卡片与顶部卡片上下居中对齐」
 *      → 删掉 Y_STEP_FRAC；y = cardCy - cardH·scale/2 —— 所有层共用同一个垂直中心，
 *        缩放导致的内缩上下对称（旧版 transform-origin:0 0 让背景层顶部对齐、整体上浮）。
 *   C. 「应用图标过小，应用图标与卡片作为整体进行居中显示」
 *      → 图标行纳入 A 的居中计算（LABEL_ROW_H + LABEL_GAP），图标由 18 → 24px。
 *   D. 「整个横滑动效非常不自然」
 *      → 抽帧量化参考视频（444×960 / 24fps / 314 帧）：
 *        · 松手吸附是【缓出】：左缘 120→96→89→82→80→78→74，增量 -14/-10/-7/-7/-2/-1/-4，
 *          拟合 p = 1-exp(-t/τ)，τ ≈ 110ms（63% 在 115ms 完成）；
 *        · 到位时有【轻微过冲回弹】（74→67→36→49→57→66→70→74），不是临界阻尼的死板收尾；
 *        · 拖动灵敏度：完成一次换卡实际拖动 ≈ 0.87 卡宽（旧版 0.60 过于灵敏）。
 *        → ios-deck 弹簧由 {80, 17.9}（ζ=1.0 临界阻尼、无弹性）改为 {196, 18.2}
 *          （ω_n=14, ζ=0.65, τ=110ms, 过冲 ≈6.7%）；FOCUS_SPAN_FRAC 0.60 → 0.85。
 *
 * ── 2026-09-12 第四轮（Ricky 第二个参考视频：卡片之间的【相对运动】规律）──
 *   原话：「顶层卡片应该像是拉着底层卡片一起往右移动，但是现在的底层卡片先做向中间位移
 *          放大的动画，应该是一边被顶层卡片拖着向右移动一边放大，直到顶层卡片完全滑出
 *          屏幕两张卡片才完全分离。」
 *
 *   逐帧实测【改前】（430×932，慢拖一整层 span=233.75px，顶卡左缘 x0 / 底卡左缘 x1）：
 *     dx=117  x0=202.5  x1= 96.4  s1=0.970  重叠 +160
 *     dx=156  x0=267.8  x1=101.9 ←峰值      重叠 +103
 *     dx=195  x0=360.6  x1= 95.1  s1=0.990  重叠   +6.7
 *     dx=199  x0=369.8  x1= 93.8            重叠   -3.5  ←提前分离（顶卡还有 60px 没出屏）
 *     dx=234  x0=455.9  x1= 77.5  s1=1.000  重叠 -103
 *   两个真实缺陷：
 *     ① 底卡左缘【先增后减】（101.9 → 77.5，回退 24px）—— 它不是被拖着走，而是
 *        「先向中间冲一下再退回原位」。根因 = 扇开用 sin 半波包络，在一层之内先推远再收回；
 *     ② 顶卡还有 60px 没出屏，两卡就分离了（重叠转负）—— 底卡把「向中间的位移+放大」
 *        提前做完，然后顶卡才慢慢飘走。
 *
 *   物理修正（两条定律）：
 *     定律一【同相位】顶卡退出与背景层推进必须共用【同一个层过渡进度 u】
 *       → 旧实现顶卡用 x^EXIT_POW（后加载）、背景层用原始 x（前加载）→ 背景层抢跑。
 *         统一后背景层同样「后加载」：先被拖着走，末段才收进槽位。
 *     定律二【不提前分离】顶卡左缘越过屏宽之前，第 1 层的右缘必须始终 ≥ 顶卡左缘
 *       → 牵连位移取【贴合所需的最小量】need(u) = max(0, 顶卡左缘 − 第1层右缘)，
 *         并压到 u = CARRY_RELEASE 之后才释放 → 屏幕上两卡全程贴合，绝不提前分离。
 *
 * 坐标约定：
 *   a = i - focus         连续「层深」，0 = 焦点层（屏幕正中），正数 = 更早的层（往左）
 *   负数 = 比焦点更新的卡（往右退出屏幕）
 *   所有位移都以卡片【左上角】为基准（transform-origin: 0 0）。
 */

/** 几何常量（屏幕分数 / px） */
export const DECK = {
  CARD_W_FRAC: 0.64, // 卡宽 = 屏宽 × 0.64
  CARD_H_FRAC: 0.64, // 卡高 = 屏高 × 0.64（与屏幕同比例 → 预览零裁切）
  RADIUS_FRAC: 0.0667,
  /* 顶部安全距离：状态栏底部。运行时从 CSS 变量 --safe-top 实测（本项目 54px）；
     这里 0.058 = 54/932 仅作测不到 DOM 时的兜底。 */
  TOP_INSET_FRAC: 0.058,
  /* 底部删除按钮：直径 + 距 home indicator 的距离（须与 .switcher-dock 的 CSS 一致） */
  DOCK_SIZE: 52,
  DOCK_GAP: 26,
  DEFAULT_HOME_INSET: 14,
  /* 卡片上方的图标行：行高（= 图标尺寸）+ 与卡顶的间隙 */
  LABEL_ROW_H: 24,
  LABEL_GAP: 12,
  STAIR_BASE_FRAC: 0.12, // stair(1) = 0.12 × cardW
  STAIR_DECAY: 0.55, // 阶梯衰减 → 露出 1 : 0.55 : 0.30
  SCALE_DECAY: 0.94, // scale(k) = 0.94^k
  BRIGHT_STEP: 0.16, // 每层亮度 -16%
  EXIT_FRAC: 0.88, // 退出斜坡满量程 = 屏宽 × 0.88（保证左边缘越过右屏边）
  EXIT_POW: 1.6, // >1 → 起步接近 1:1 跟手，末段加速离场
  /* 层过渡进度指数：u = frac^TRANS_POW。必须与 EXIT_POW 同值 —— 顶卡退出与背景层推进
     共用同一个 u 是「不再抢跑」的关键（见头部「定律一」）。 */
  TRANS_POW: 1.6,
  /* 牵连释放起点（u）：≥ 顶卡出屏所需。u_off = (屏宽 − frontX)/exit = 352.5/378.4 = 0.932，
     取 0.95 留余量 → 「顶卡完全滑出屏幕」之前绝不分离（定律二）。 */
  CARRY_RELEASE: 0.95,
  /* 牵连基准幅度（占顶卡位移的比例）= 深度 1 那一层的份额 = 3/8。见 CARRY_WEIGHTS。 */
  CARRY_FRAC: 0.375,
  MAX_DEPTH: 3, // 同时最多 4 层
  Z_BASE: 10000, // z(i) = Z_BASE - i（固定，永不随焦点变）
  FOCUS_SPAN_FRAC: 0.85, // 拖动 0.85 × cardW ≈ 完成一次换卡（对齐参考视频实测 0.87）
  RUBBER: 0.35 // 越界阻尼系数
}

/** 牵连权重 —— 按【整层深度】取（0 = 焦点层不牵连；1 = 被顶卡直接拖动的那一层）。
 *  相对深度 1 的倍数 = 1 : 2/3 : 1/3，乘上基准幅度 DECK.CARRY_FRAC(3/8) 后
 *  正好是 Ricky 规则⑦的 8 : 3 : 2 : 1 位移比。 */
export const CARRY_WEIGHTS = [0, 1, 2 / 3, 1 / 3]

/**
 * 屏幕尺寸 → 几何度量。
 *
 * 垂直布局（修正 A/B/C）：
 *   blockH  = 图标行 + 间隙 + 卡高
 *   gap     = (删除按钮顶 - 状态栏底 - blockH) / 2      ← 上下留白相等 = 整体居中
 *   labelY  = 状态栏底 + gap                            ← 图标行顶部
 *   cardY   = labelY + 图标行 + 间隙                     ← 卡顶（scale = 1 时）
 *   cardCy  = cardY + cardH / 2                          ← 所有层共用的垂直中心
 *
 * @param opts.topInset   状态栏底部（px，实测 --safe-top）
 * @param opts.homeInset  home indicator 高度（px）
 * @param opts.dockSize   删除按钮直径（px）
 */
export function deckMetrics(screenW, screenH, opts = {}) {
  const cardW = Math.round(screenW * DECK.CARD_W_FRAC)
  const cardH = Math.round(screenH * DECK.CARD_H_FRAC)
  const radius = Math.round(screenW * DECK.RADIUS_FRAC)

  const dockSize = opts.dockSize ?? DECK.DOCK_SIZE
  const homeInset = opts.homeInset ?? DECK.DEFAULT_HOME_INSET
  const dockTop = screenH - homeInset - DECK.DOCK_GAP - dockSize
  const topInset = opts.topInset ?? Math.round(screenH * DECK.TOP_INSET_FRAC)

  const blockH = DECK.LABEL_ROW_H + DECK.LABEL_GAP + cardH
  const gap = Math.max(0, (dockTop - topInset - blockH) / 2)
  const labelY = topInset + gap
  const cardY = labelY + DECK.LABEL_ROW_H + DECK.LABEL_GAP
  const cardCy = cardY + cardH / 2

  return {
    screenW,
    screenH,
    cardW,
    cardH,
    cardY,
    cardCy,
    labelY,
    dockTop,
    topInset,
    gap,
    blockH,
    frontX: (screenW - cardW) / 2, // 焦点层左边缘（= 水平居中）
    radius,
    exit: screenW * DECK.EXIT_FRAC,
    span: cardW * DECK.FOCUS_SPAN_FRAC,
    previewScale: screenW ? cardW / screenW : 1
  }
}

/**
 * 阶梯偏移（层深 k ≥ 0，可连续）：几何级数，保证「露出越来越少」。
 * stair(0)=0、stair(1)=0.12·cardW、stair(2)=0.186·cardW、stair(3)=0.222·cardW
 */
export function deckStair(k, cardW) {
  const c = (DECK.STAIR_BASE_FRAC * cardW) / (1 - DECK.STAIR_DECAY)
  return c * (1 - Math.pow(DECK.STAIR_DECAY, Math.max(0, k)))
}

/** 牵连权重按整层深度取（连续插值，避免层深跨整数时跳变） */
export function carryWeight(k) {
  const d = Math.min(Math.max(k, 0), DECK.MAX_DEPTH)
  if (d <= 0) return CARRY_WEIGHTS[0]
  const lo = Math.floor(d)
  if (lo >= DECK.MAX_DEPTH) return CARRY_WEIGHTS[DECK.MAX_DEPTH]
  const t = d - lo
  return CARRY_WEIGHTS[lo] * (1 - t) + CARRY_WEIGHTS[lo + 1] * t
}

/**
 * 层过渡进度（定律一）：把焦点的【小数部分】映射成三件东西共用的进度。
 *   m = 焦点所在整数层
 *   x = 原始小数进度（0..1）
 *   u = x^TRANS_POW —— 顶卡退出斜坡与背景层推进【共用】的进度
 *
 * 关键：背景层的连续层深要用 aEff = a + (x − u) = (i − m − u) 计算，
 * 这样在 x=0 / x=1 两端都与原始 a 重合（层边界零跳变），中途则「后加载」——
 * 背景层不再抢在顶卡前面把位移+放大做完。
 */
export function deckPhase(focus) {
  const m = Math.floor(focus)
  const x = Math.min(Math.max(focus - m, 0), 1 - 1e-9)
  return { m, x, u: Math.pow(x, DECK.TRANS_POW) }
}

/** 顶卡左缘（与 deckPose 的负半区同源，供牵连计算复用） */
export function deckLeadX(u, m) {
  return m.frontX + m.exit * u
}

/**
 * 第 1 层「贴合顶卡」所需的最小牵连位移（定律二）。
 * = 顶卡左缘 − 第 1 层此刻的右缘（槽位左缘 + 卡宽）。≥ 0 才有意义。
 * u ≥ u_off 时顶卡已离开屏幕，need 继续变大但会被释放包络压回 0。
 */
export function deckCarryNeed(u, m) {
  const slot = m.frontX - deckStair(1 - u, m.cardW)
  const width = m.cardW * Math.pow(DECK.SCALE_DECAY, 1 - u)
  return Math.max(0, deckLeadX(u, m) - (slot + width))
}

/**
 * 牵连基准幅度（未乘层权重 / 未乘释放包络）：
 *   max(贴合所需的最小量 need, CARRY_FRAC · 顶卡位移) ——
 *   · 第一项保证定律二（顶卡出屏前两卡右缘/左缘始终贴合）；
 *   · 第二项就是「顶层卡片拉着底层卡片一起往右移动」：深度 k 的层被拖走
 *     CARRY_WEIGHTS[k] × 顶卡位移 —— 同一段滑动距离下，各层位移天然是 8:3:2:1，
 *     并且从过渡一开始就同步起势（不是前半程不动、后半程猛冲）。
 */
export function deckCarryAt(u, m) {
  /* 三条约束取交：
     ① CARRY_FRAC·exit·u —— rule⑦ 的「顶卡位移 × 3/8」，从过渡一开始就同步起势；
     ② min(·, 焦点卡右侧留白) —— 牵连不能把卡片推出右屏边（常数上限，保证单调）；
     ③ max(·, need) —— 定律二的下限（顶卡出屏前必须贴合）；
        最后再夹一次第 1 层的实时余量，保证右缘永不越过屏宽。 */
  const roomConst = Math.max(0, m.screenW - (m.frontX + m.cardW))
  const share = Math.min(DECK.CARRY_FRAC * m.exit * u, roomConst)
  const slot1 = m.frontX - deckStair(1 - u, m.cardW)
  const sc1 = Math.pow(DECK.SCALE_DECAY, 1 - u)
  const room = Math.max(0, m.screenW - (slot1 + m.cardW * sc1))
  return Math.min(Math.max(deckCarryNeed(u, m), share), room)
}

/** 某一层的牵连位移（已乘层权重）。层权重的顺序由 CARRY_WEIGHTS 保证递减。 */
export function deckCarry(u, k, m) {
  return deckCarryAt(u, m) * carryWeight(k)
}

/** 牵连释放包络：u ≤ CARRY_RELEASE 恒为 1（全程贴合），之后平滑归零（回槽位） */
export function deckCarryRelease(u) {
  const r = DECK.CARRY_RELEASE
  if (u <= r) return 1
  const t = Math.min(1, (u - r) / (1 - r))
  return 1 - t * t * (3 - 2 * t)
}

/**
 * 单张卡的位姿。
 * @param a     层深 a = i - focus（连续，可负）
 * @param m     deckMetrics(...)
 * @param xFrac 焦点的小数进度（0..1，来自 deckPhase(focus).x）—— 顶卡退出与背景推进共用
 */
export function deckPose(a, m, xFrac = 0) {
  const x = Math.min(Math.max(xFrac, 0), 1 - 1e-9)
  const u = Math.pow(x, DECK.TRANS_POW) // 层过渡进度（定律一）

  let restX
  let scale
  let depth
  if (a >= 0) {
    /* 背景层：先按「被顶卡拖着走」的路径（牵连），末段才收进槽位。
       aEff = a + (x − u)：两端与原始 a 重合（层边界不跳变），中途后加载（不抢跑）。 */
    const aEff = Math.min(Math.max(a + (x - u), 0), DECK.MAX_DEPTH)
    const k = Math.max(0, Math.round(a + x)) // 相对当前焦点层的整层深度
    const slotX = m.frontX - deckStair(aEff, m.cardW)
    const sc = Math.pow(DECK.SCALE_DECAY, aEff)
    restX = slotX + deckCarry(u, k, m) * deckCarryRelease(u)
    scale = sc
    depth = aEff
  } else {
    // 退出斜坡：比焦点更新的卡往右离开屏幕（幂律 → 起步跟手、末段加速）
    restX = m.frontX + m.exit * Math.pow(Math.min(1, -a), DECK.EXIT_POW)
    scale = 1
    depth = 0
  }

  return {
    a,
    depth,
    x: restX,
    /* 修正 B：所有层共用同一个垂直中心（cardCy），缩放造成的内缩上下对称 ——
       「所有卡片与顶部卡片上下居中对齐」。旧版 y = cardY + yStep·depth 是顶对齐 +
       向下偏移，背景层整体浮在上方，正是 Ricky 指出的问题。 */
    y: m.cardCy - (m.cardH * scale) / 2,
    scale,
    bright: 1 - DECK.BRIGHT_STEP * depth,
    z: 0
  }
}

/** 层级：只由列表索引决定（规则①），i 越小越靠上 */
export function deckZ(i) {
  return DECK.Z_BASE - i
}

/** 该层是否需要渲染 —— 规则⑤「同时最多四层」。
 *  只渲染层深 a ∈ (-1.02, 3] 的卡：0/1/2/3 正好是四个槽位，
 *  层深 > 3 的第 5 张必须剔除（否则它会在第 4 层左侧再露出第五道阶梯）。
 *  负半区保留一层，用于「正在滑出屏幕的那张」—— 它到 a = -1 恰好完全离屏，
 *  再远才剔除，保证离场全程有 DOM 可画。 */
export function deckVisible(a) {
  return a > -1.02 && a <= DECK.MAX_DEPTH
}

/** 越界阻尼：0..n-1 之外按指数压扁，手感接近 iOS 橡皮筋 */
export function deckClampFocus(raw, n) {
  const last = Math.max(0, n - 1)
  if (raw < 0) return Math.max(-0.6, raw * DECK.RUBBER)
  if (raw > last) return Math.min(last + 0.6, last + (raw - last) * DECK.RUBBER)
  return raw
}

/** 卡片（含最深层）的左边缘最小值 —— 规则③的静态保证（牵连只会往右推，不会破坏它） */
export function deckMinLeftEdge(m) {
  return m.frontX - deckStair(DECK.MAX_DEPTH, m.cardW)
}

/** 焦点层与第 k 层的露出宽度（用于「露出越来越少」断言） */
export function deckExposure(k, cardW) {
  return deckStair(k, cardW) - deckStair(k - 1, cardW)
}
