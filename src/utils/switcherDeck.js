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
 *      → 间距随【层过渡进度 u】连续变化：stair(aEff)，aEff = a + (x − u)。
 *        （第五轮删除了额外的「牵连包络」，见下方定律三。）
 *   ⑦ 「同样滑动距离顶层移动距离 8:3:2:1」
 *      → 位移递减由 stair 的几何级数天然给出：一层内各层位移 = stair(1) : stair(2)−stair(1) : …
 *        = 0.12 : 0.066 : 0.036 卡宽 ≈ 3.3 : 1.8 : 1（顶层 : 第二层 : 第三层）。
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
 *   结论：顶卡退出与背景层推进必须【同相位】—— 共用同一个层过渡进度 u = x^TRANS_POW。
 *   旧实现顶卡用 x^EXIT_POW（后加载）、背景层用原始 x（前加载）→ 背景层抢跑。统一后
 *   背景层同样「后加载」。实现上即 aEff = a + (x − u)：层边界两端与原始 a 重合，零跳变。
 *
 * ── 2026-09-12 第五轮（Ricky 指出第四轮的牵连包络【会往回走】）──
 *   原话：「最顶部的卡片消失后，继续右滑顶部卡片会非常反直觉的先回到中心位置，也就是
 *          往右滑的时候卡片在往左移动，导致动画断掉了。」
 *
 *   逐帧实测【改前】（慢拖 1.25 层，卡 1 左缘 x）：
 *     峰值 156.1 → 78.7  ← 一次回退 77.4px，且随后又出现 118.7→81.3 的二次回退。
 *   根因：第四轮为了让两卡「贴合」加了牵连量 carry(u)·release(u)，而 release 必须在
 *   u→1 时归零（层边界处第 1 层必须已经在槽位 frontX 上），于是在 u∈[0.95,1] 出现
 *   「牵连满量程→0」的塌缩 → 卡片向左猛退。
 *
 *   数学结论（为什么不能既要大牵连、又不要回退）：
 *     第 1 层的位移 = 槽位推进 + 牵连；槽位推进在一层内总共只有 stair(1) = 33px，
 *     而牵连从峰值 P 回落到 0 至少要「吃掉」P 的位移预算。要末端不回退，就必须
 *     P ≤ 槽位在该段的推进量；把释放摊到整层时最多也只剩 ~15px。所以【任何有峰值的
 *     牵连都必然带来一次回退】。→ 第五轮直接去掉牵连，背景层 = 纯槽位推进。
 *
 *   定律三【不得回退】（本轮新增，优先级高于「贴合」）：
 *     背景层的位置只由 u 单调推进 —— restX = frontX − stair(aEff)，
 *     其中 aEff = a + (x − u) 对每张卡都等价于 d − u（d = i − m 为整层深度），
 *     随 u: 0→1 严格单调递减 → restX 严格单调递增。缩放同为 0.94^aEff 单调递增。
 *     「边被拖着走 + 边放大」由【两者共用同一个 u】保证，不再需要额外包络。
 *
 *   代价（已与 Ricky 说明）：第 1 层的右移量 = stair(1)（必须落到居中槽位，所以有上界），
 *   且顶卡快出屏时会露出一段「顶卡与底卡之间」的空隙 —— 这是居中布局的几何必然：
 *   顶卡左缘到 430 时，居中底卡的右缘最多只能到 frontX + cardW = 352.5。
 *
 *   验证盲区（第四轮为什么没抓到）：当时的断言是「顶卡【还在屏内】时底卡单调右移」，
 *   而出屏点之后正好是 release 塌缩的区间 → 断言天然测不到。本轮新增断言覆盖
 *   【整段拖动，含顶卡出屏之后】。
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
  MAX_DEPTH: 3, // 同时最多 4 层
  Z_BASE: 10000, // z(i) = Z_BASE - i（固定，永不随焦点变）
  FOCUS_SPAN_FRAC: 0.85, // 拖动 0.85 × cardW ≈ 完成一次换卡（对齐参考视频实测 0.87）
  RUBBER: 0.35 // 越界阻尼系数
}

/**
 * 阶梯偏移（层深 k ≥ 0，可连续）：几何级数，保证「露出越来越少」。
 * stair(0)=0、stair(1)=0.12·cardW、stair(2)=0.186·cardW、stair(3)=0.222·cardW
 *
 * 它同时决定了【一层过渡里各层的右移量】：
 *   depth-1 卡位移 = stair(1) − stair(0) = stair(1)
 *   depth-2 卡位移 = stair(2) − stair(1)
 *   depth-3 卡位移 = stair(3) − stair(2)
 * 因为 aEff = d − u 从 d 走到 d−1，位置的净变化就是相邻两级 stair 之差。
 * 这条链是「位移递减」的唯一来源 —— 一旦再叠加会归零的包络，就会产生回退（定律三）。
 */
export function deckStair(k, cardW) {
  const c = (DECK.STAIR_BASE_FRAC * cardW) / (1 - DECK.STAIR_DECAY)
  return c * (1 - Math.pow(DECK.STAIR_DECAY, Math.max(0, k)))
}

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
 * 层过渡进度（定律一）：把焦点的【小数部分】映射成两件东西共用的进度。
 *   m = 焦点所在整数层
 *   x = 原始小数进度（0..1）
 *   u = x^TRANS_POW —— 顶卡退出斜坡与背景层推进【共用】的进度
 *
 * 背景层的连续层深用 aEff = a + (x − u) 计算。对每张卡，a = d − x（d = i − m 为整层深度），
 * 所以 aEff 恒等于 d − u：随 u: 0→1 严格单调递减 → 位置单调右移、缩放单调变大（定律三）。
 * 在 x=0 / x=1 两端 aEff 分别等于 d 与 d−1，与层边界的整数层深重合 → 零跳变。
 */
export function deckPhase(focus) {
  const m = Math.floor(focus)
  const x = Math.min(Math.max(focus - m, 0), 1 - 1e-9)
  return { m, x, u: Math.pow(x, DECK.TRANS_POW) }
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
    /* 背景层（定律三：纯槽位推进，不得回退）。
       aEff = a + (x − u) = d − u —— 随 u 单调递减，因此：
         · restX = frontX − stair(aEff) 单调递增（一路向右，绝不回退）；
         · scale = 0.94^aEff 单调递增（与位移【同时】发生，不是先位移后放大）。
       缩放与位移共用同一个 u，这就是「被顶卡拖着走 + 同时放大」的全部机制；
       旧版额外叠加的牵连包络必须在一层末尾归零，那正是「往右滑却往左走」的根因。 */
    const aEff = Math.min(Math.max(a + (x - u), 0), DECK.MAX_DEPTH)
    restX = m.frontX - deckStair(aEff, m.cardW)
    scale = Math.pow(DECK.SCALE_DECAY, aEff)
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
