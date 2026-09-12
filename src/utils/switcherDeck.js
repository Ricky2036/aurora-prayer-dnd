/**
 * Recent 堆叠几何 —— 纯函数（无 Vue / 无 DOM），AppSwitcher 与单测共用。
 *
 * Ricky 2026-09-12 定的七条硬规则（原话见下）：
 *   ① 「层级关系不变，顶层的卡片一直到滑动到屏幕外都要在顶层」
 *      → z 只由【列表索引 i】决定：z(i) = Z_BASE - i，永远不随焦点变化。
 *   ② 「下层卡片缩小后藏在上层卡片下方」
 *      → 背景层向左阶梯铺开 + 按层等比缩小（transform-origin: 0 0，左边缘钉住）。
 *   ③ 「左侧边缘不超出屏幕左侧边框」
 *      → 最深层的左边缘 = frontX - stair(3) &gt; 0（430 屏上 16.4px，再叠硬 clamp 兜底）。
 *   ④ 「底层卡片成阶梯式缩小，露出越来越少」
 *      → 几何级数：stair(k) = base·(1-decay^k)/(1-decay)，露出 33 / 18 / 10 px。
 *   ⑤ 「同时最多展示四层」→ MAX_DEPTH = 3（焦点层 + 3 层背景）。
 *   ⑥ 「根据滑动的距离动态调整顶卡与第二三四层的[间距]」
 *      → 拖动期叠加一个「扇开」位移，幅度随拖动距离的正弦包络走（两端归零）。
 *   ⑦ 「同样滑动距离顶层移动距离 8:3:2:1」
 *      → 扇开权重 W = [1, 0.375, 0.25, 0.125]（= 8:3:2:1）按层递减。
 *
 * 坐标约定：
 *   a = i - focus         连续「层深」，0 = 焦点层（屏幕正中），正数 = 更早的层（往左）
 *   负数 = 比焦点更新的卡（往右退出屏幕）
 *   所有位移都以卡片【左上角】为基准（transform-origin: 0 0）。
 */

/** 几何常量（全部按屏幕分数，不写死 px） */
export const DECK = {
  CARD_W_FRAC: 0.64, // 卡宽 = 屏宽 × 0.64（与屏幕同比例 → 预览零裁切）
  CARD_H_FRAC: 0.64,
  Y_FRAC: 0.09, // 卡顶距
  RADIUS_FRAC: 0.0667,
  STAIR_BASE_FRAC: 0.12, // stair(1) = 0.12 × cardW
  STAIR_DECAY: 0.55, // 阶梯衰减 → 露出 1 : 0.55 : 0.30
  SCALE_DECAY: 0.94, // scale(k) = 0.94^k
  Y_STEP_FRAC: 0.0064, // 每层往下 6px（932 屏），形成斜向阶梯
  BRIGHT_STEP: 0.16, // 每层亮度 -16%
  EXIT_FRAC: 0.88, // 退出斜坡满量程 = 屏宽 × 0.88（保证左边缘越过右屏边）
  EXIT_POW: 1.6, // &gt;1 → 起步接近 1:1 跟手，末段加速离场
  FAN_FRAC: 0.24, // 扇开幅度 = cardW × 0.24（在「8:3:2:1」实测最接近的取值）
  MAX_DEPTH: 3, // 同时最多 4 层
  Z_BASE: 10000, // z(i) = Z_BASE - i（固定，永不随焦点变）
  FOCUS_SPAN_FRAC: 0.6, // 拖动 0.60 × cardW ≈ 一整层
  RUBBER: 0.35 // 越界阻尼系数
}

/** 拖动期「扇开」权重 —— 8 : 3 : 2 : 1 */
export const FAN_WEIGHTS = [1, 0.375, 0.25, 0.125]

/** 屏幕尺寸 → 几何度量 */
export function deckMetrics(screenW, screenH) {
  const cardW = Math.round(screenW * DECK.CARD_W_FRAC)
  const cardH = Math.round(screenH * DECK.CARD_H_FRAC)
  const cardY = Math.round(screenH * DECK.Y_FRAC)
  return {
    screenW,
    screenH,
    cardW,
    cardH,
    cardY,
    frontX: (screenW - cardW) / 2, // 焦点层左边缘（= 水平居中）
    radius: Math.round(screenW * DECK.RADIUS_FRAC),
    yStep: Math.max(2, Math.round(screenH * DECK.Y_STEP_FRAC)),
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
 * 都会让背景层的相邻间距掉到 33/18 以下（半层处约 24.5/13.4）；扇开负责补回来。
 *
 * 方向问题（视觉复核发现的坑）：扇开必须【只朝「往更早的卡」那一侧（dx &gt; 0）】。
 * 反方向（往更新的卡，dx &lt; 0）上层深越大位移越靠左，扇开若跟着反向就会与阶梯
 * 同向叠加 —— 实测半层处 camera 与 phone 双双停在 x=13，两层直接压成一张。
 * 反向过渡的主视觉是「更新的卡从右侧幂律飞入」（位移 ~254px），背景层只要保持
 * 单调的纯阶梯（间距 24.5 / 13.4，永不重叠）即可，不需要扇开。
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
 * @param fanN 扇开包络值（-1..1，来自 deckFan）
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
  return {
    a,
    depth,
    x: restX + fanX,
    y: m.cardY + m.yStep * depth,
    scale: Math.pow(DECK.SCALE_DECAY, depth),
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
