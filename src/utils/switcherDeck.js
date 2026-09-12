/**
 * Recent 堆叠几何 —— 纯函数（无 Vue / 无 DOM），AppSwitcher 与单测共用。
 *
 * Ricky 2026-09-12 定的七条硬规则：
 *   ① 「层级关系不变，顶层的卡片一直到滑动到屏幕外都要在顶层」
 *      → z 只由【列表索引 i】决定：z(i) = Z_BASE - i，永远不随焦点变化。
 *   ② 「下层卡片缩小后藏在上层卡片下方」
 *      → 背景层向左阶梯铺开 + 按层等比缩小。
 *   ③ 「左侧边缘不超出屏幕左侧边框」
 *      → 最深层的左边缘 = frontX - stair(3) > 0（430 屏上 8.4px，再叠硬 clamp 兜底）。
 *   ④ 「底层卡片成阶梯式缩小，露出越来越少」
 *      → 几何级数：stair(k) = base·(1-decay^k)/(1-decay)。
 *   ⑤ 「同时最多展示四层」→ MAX_DEPTH = 3（焦点层 + 3 层背景）。
 *   ⑥ 「根据滑动的距离动态调整顶卡与第二三四层的[间距]」
 *      → 拖动期叠加一个「扇开」位移，幅度随拖动距离的包络走（两端归零）。
 *   ⑦ 「同样滑动距离顶层移动距离 8:3:2:1」
 *      → 扇开权重 W = [1, 0.375, 0.25, 0.125]（= 8:3:2:1）按层递减。
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
  FAN_FRAC: 0.20, // 扇开幅度 = cardW × 0.20
  MAX_DEPTH: 3, // 同时最多 4 层
  Z_BASE: 10000, // z(i) = Z_BASE - i（固定，永不随焦点变）
  FOCUS_SPAN_FRAC: 0.85, // 拖动 0.85 × cardW ≈ 完成一次换卡（对齐参考视频实测 0.87）
  RUBBER: 0.35 // 越界阻尼系数
}

/** 拖动期「扇开」权重 —— 8 : 3 : 2 : 1 */
export const FAN_WEIGHTS = [1, 0.375, 0.25, 0.125]

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
  const topInset =
    opts.topInset ?? Math.round(screenH * DECK.TOP_INSET_FRAC)

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
    fan: cardW * DECK.FAN_FRAC,
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

/** 扇开权重按层深插值（连续，避免层深跨整数时跳变） */
export function fanWeight(a) {
  const k = Math.min(Math.max(a, 0), DECK.MAX_DEPTH)
  if (k <= 0) return FAN_WEIGHTS[0]
  const lo = Math.floor(k)
  if (lo >= DECK.MAX_DEPTH) return FAN_WEIGHTS[DECK.MAX_DEPTH]
  const t = k - lo
  return FAN_WEIGHTS[lo] * (1 - t) + FAN_WEIGHTS[lo + 1] * t
}

/**
 * 拖动期的扇开包络（0..1，非负）。
 *
 * 语义 = 「把相邻层之间的距离拉开」。阶梯函数 stair 是非线性的，任何一次层间过渡
 * 都会让背景层的相邻间距掉到基准以下；扇开负责补回来。
 *
 * 方向：扇开只朝「往更早的卡」那一侧（dx > 0）。反方向（dx < 0）上层深越大位移越靠左，
 * 扇开若跟着反向就会与阶梯同向叠加，两层直接压成一张。
 *
 * @returns 0..1 的包络值（sin 半波），整层处归零 → 交接零跳变
 */
export function deckFan(dx, span) {
  if (!span || dx <= 0) return 0
  const t = Math.abs(dx) / span
  const frac = t - Math.floor(t) // 每跨一层都有一次「扇开→收拢」
  return Math.sin(Math.PI * frac)
}

/**
 * 单张卡的位姿。
 * @param a 层深 a = i - focus（连续，可负）
 * @param m deckMetrics(...)
 * @param fanN 扇开包络值（0..1，来自 deckFan）
 */
export function deckPose(a, m, fanN = 0) {
  const depth = Math.min(Math.max(a, 0), DECK.MAX_DEPTH)
  // 退出斜坡：比焦点更新的卡往右离开屏幕（幂律 → 起步跟手、末段加速）
  const restX =
    a >= 0
      ? m.frontX - deckStair(a, m.cardW)
      : m.frontX + m.exit * Math.pow(Math.min(1, -a), DECK.EXIT_POW)
  // 扇开只作用于背景层：退出中的卡由斜坡单独负责，叠加会破坏「起步 1:1 跟手」
  const fanX = a >= 0 ? fanN * m.fan * fanWeight(a) : 0
  const scale = Math.pow(DECK.SCALE_DECAY, depth)
  return {
    a,
    depth,
    x: restX + fanX,
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

/** 卡片（含最深层）的左边缘最小值 —— 规则③的静态保证 */
export function deckMinLeftEdge(m) {
  return m.frontX - deckStair(DECK.MAX_DEPTH, m.cardW)
}

/** 焦点层与第 k 层的露出宽度（用于「露出越来越少」断言） */
export function deckExposure(k, cardW) {
  return deckStair(k, cardW) - deckStair(k - 1, cardW)
}
