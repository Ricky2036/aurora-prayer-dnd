<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { getApp } from '../../config/apps'
import { appComponents } from '../apps/registry'
import PlaceholderApp from '../apps/PlaceholderApp.vue'
import AppIcon from '../ui/AppIcon.vue'
import GlassCircleButton from '../ui/GlassCircleButton.vue'
import { useSystemStore } from '../../stores/systemStore'
import { useI18nStore } from '../../stores/i18nStore'
import { useSpring } from '../../composables/useSpring'
import { screenRef } from '../../utils/screenRef'
import {
  DECK,
  deckClampFocus,
  deckFan,
  deckMetrics,
  deckPose,
  deckZ,
  deckVisible
} from '../../utils/switcherDeck'

/**
 * 最近任务切换器（App Switcher / Recent）—— 固定层级堆叠（不是 Coverflow）。
 *
 * Ricky 2026-09-12 七条硬规则，几何全部落在 src/utils/switcherDeck.js（纯函数 + 单测）：
 *   ① 层级关系不变：z 只由列表索引 i 决定（z = 10000 - i），永不随焦点变 →
 *      「顶层的卡片一直到滑动到屏幕外都要在顶层」。旧版 z 跟着「距焦点远近」算，
 *      拖到一半时顶层卡会被下面的卡盖住（他原话：最顶部的卡片还能跑到下面去）。
 *   ② 下层卡片缩小后藏在上层卡片下方：transform-origin: 0 0（左边缘钉住）+ 按层 0.94^k 缩小。
 *   ③ 左侧边缘不出屏：最深层的左边缘 = 77.5 - 61.1 = 16.4px &gt; 0（单测守这条不变量）。
 *   ④ 底层阶梯式缩小、露出越来越少：stair(k) 几何级数 → 露出 33 / 18 / 10 px。
 *   ⑤ 同时最多四层：焦点层 + 3 层背景，第 5 张起不渲染。
 *   ⑥ 间距随滑动距离动态变化：拖动期叠加「扇开」位移，正弦包络（整层处归零 → 交接零跳变）。
 *   ⑦ 同样滑动距离 顶层:二:三:四 = 8:3:2:1：扇开权重 W = [1, 0.375, 0.25, 0.125]。
 *
 * 参考实现：SoxiaLiSA/StackSwipe（MIT，Kotlin）——固定 zIndex、几何级数露边、
 * 阻尼橡皮筋、投影吸附。它没有缩放堆叠与 8:3:2:1，那两块是本项目自研。
 *
 * ── 2026-09-12 第三轮：Ricky 提交参考视频后的四条修正（详见 switcherDeck.js 顶部）──
 *   A. 卡片整体下移 → 不再用固定 Y_FRAC，改为「图标行 + 卡片」整体垂直居中于
 *      [状态栏底(--safe-top), 删除按钮顶]（实测锚点：54 / 840，gap = 77）。
 *   B. 背景层不再上浮 → 删除 Y_STEP_FRAC，y = cardCy - cardH·scale/2，
 *      所有层共用同一垂直中心。
 *   C. 图标 18 → 24px、字号 14 → 16px，并纳入整体居中的 blockH。
 *   D. 横滑动效：ios-deck 由 ζ=1.0 临界阻尼改为 ζ=0.65（τ 仍 ≈110ms，带 6.7% 过冲）；
 *      扇开包络松手时交给弹簧衰减（不再硬置零 → 消除背景层硬跳变）；
 *      拖动灵敏度 0.60 → 0.85 卡宽/张（对齐参考实测 0.87）。
 *
 * 动效：
 *   进入    HomeIndicator 停驻手势驱动 switcherProgress 0→1，前台应用围绕【屏幕中心】
 *           连续缩到卡位（跟手，逐帧直写无 transition）；进度用原始位移换算，
 *           越过满量程继续无极变小但不淡出；松手弹簧回到固定终点。
 *   浏览    横滑：手往右拖 → focus 增大 → 全部卡片往右走；焦点卡走幂律斜坡退出屏幕
 *           （起步接近 1:1 跟手、末段加速），背景层走阶梯 + 扇开。松手弹簧吸附到整卡。
 *   交接    跟手卡落位后由同位姿的堆叠前卡接管（几何逐像素相等，无跳变）。
 *
 * 预览实例通过 provide('appPreview') 与全局隔离（backRegistry 不注册返回处理器）。
 */

const system = useSystemStore()
const i18n = useI18nStore()
provide('appPreview', true)

/* 卡片左上角标签的位置：true = 卡内左上角，false = 卡顶上方左侧（iOS 观感） */
const LABEL_INSIDE = false

const rootRef = ref(null)
const screenW = ref(0)
const screenH = ref(0)
/* 布局锚点（修正 A）：「图标行 + 卡片」整体垂直居中于 [状态栏底, 删除按钮顶]。
   两者都从 CSS 变量读，避免与 StatusBar / .switcher-dock 的样式脱钩。 */
const safeTop = ref(0)
const homeInset = ref(DECK.DEFAULT_HOME_INSET)

/**
 * 屏幕尺寸 —— 必须早于「跟手卡/堆叠卡」的首次渲染就绪。
 *
 * 历史 bug（2026-09-12 修复）：旧实现只在切换器自己的 pointerdown 或 openSwitcher
 * 之后才 measure()，而进入手势发生在 HomeIndicator 上（它不会把 pointerdown 冒泡给
 * 切换器），于是整段手势里 screenW = 0 →
 *   ① 跟手卡 width/height = 0 → 前台应用预览整段消失（不是「跟手缩小」）；
 *   ② 堆叠卡出生在 (0,0) 全亮，再靠 0.24s transition 滑到槽位（邻居卡从左飞入）。
 * 现改为：挂载即从 ScreenView 的 .screen 元素同步量（它先于本组件存在），
 * 并用 ResizeObserver 跟随，保证任何时刻几何都是对的。
 */
function measure() {
  const el = rootRef.value || screenRef.el
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  if (w && w !== screenW.value) screenW.value = w
  if (h && h !== screenH.value) screenH.value = h
  /* 锚点：状态栏高度（--safe-top）与底部安全区（--home-indicator-inset） */
  const cs = getComputedStyle(el)
  const st = parseFloat(cs.getPropertyValue('--safe-top'))
  if (Number.isFinite(st) && st > 0 && st !== safeTop.value) safeTop.value = st
  const hi = parseFloat(cs.getPropertyValue('--home-indicator-inset'))
  if (Number.isFinite(hi) && hi !== homeInset.value) homeInset.value = hi
}

let ro = null

/* ---- 几何：全部来自纯函数模块（可单测）---- */
const metrics = computed(() =>
  deckMetrics(screenW.value, screenH.value, {
    topInset: safeTop.value > 0 ? safeTop.value : undefined,
    homeInset: homeInset.value
  })
)
const cardW = computed(() => metrics.value.cardW)
const cardH = computed(() => metrics.value.cardH)
const RADIUS = computed(() => metrics.value.radius)
const previewScale = computed(() => metrics.value.previewScale)

/* ---- 内部 z 层级 ----
   .app-switcher 自带层叠上下文，内部只须自洽。
   堆叠卡 z = deckZ(i) = 10000 - i（固定，规则①）；chrome 永远压在最上。 */
const Z_FOLLOW = 12000 // 跟手缩放卡（进场中，压在堆叠卡上）
const Z_EXPAND = 13000 // 点卡片恢复的放大卡
const Z_CHROME = 14000 // 底部垃圾桶

/* ---- 焦点（小数，单位=张），spring 驱动 —— 丝滑的来源 ---- */
const { value: focus, animateTo: focusTo, snapTo: focusSnap } = useSpring(0, 'ios-gentle')
/* 进场进度弹簧：手势交接的 switcherProgress（~0.8）连续推到 1 */
const { value: openP, animateTo: openTo, snapTo: openSnap, stop: openStop } = useSpring(1, 'ios-gentle')
watch(openP, (v) => system.setSwitcherProgress(v))
const apps = computed(() => system.recentApps)
const frontIndex = computed(() => {
  const i = apps.value.indexOf(system.activeAppId)
  return i < 0 ? 0 : i
})

const visible = computed(() => system.appSwitcherOpen || system.switcherProgress > 0)

/* 拖动期的「扇开」包络（0..1）。松手与静止时归 0 —— 静态几何只由 focus 唯一决定。
   修正 D（2026-09-12 第三轮）：松手时【交给弹簧衰减】而不是硬置零。
   旧实现松手瞬间 dragFan = 0，同时 focusMoving → true 关掉 CSS transition，
   背景层会硬跳一下（「横滑动效非常不自然」的一个真实来源）。 */
const { value: dragFan, snapTo: fanSnap, animateTo: fanTo } = useSpring(0, 'ios-deck')

/* 焦点弹簧动画期间关闭 CSS transition —— 否则逐帧推进的 spring 会被 0.24s 过渡
   二次低通，松手后的吸附变成「慢慢飘过去」，没有弹簧的干脆手感。 */
const focusMoving = ref(false)
function focusToIndex(idx, opts = {}) {
  focusMoving.value = true
  focusTo(idx, { preset: 'ios-deck', ...opts, onDone: () => { focusMoving.value = false } })
}

/* 邻居进场编排：
   - 手势路径：开关打开瞬间即「已在槽位」（藏在前卡后面，前卡缩小自然露出），无滑入；
   - 桌面路径：下一帧起自下方上浮，逐张 60ms 错峰（参考视频入场）。 */
const neighborsIn = ref(false)
const entranceDone = ref(false)
const homePath = ref(false)
const hasFollow = ref(false)
let dwellTimer = null
let settleTimer = null

function markEntrance() {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => { entranceDone.value = true }, apps.value.length * 60 + 320)
}

watch(
  () => system.appSwitcherOpen,
  (open) => {
    clearTimeout(dwellTimer)
    clearTimeout(settleTimer)
    if (!open) {
      /* 关闭时必须【停掉进场弹簧 + 进度归零】。
         历史 bug（2026-09-12 修复）：resumeApp/dismissAll 只置 appSwitcherOpen=false，
         而 openP 已停在 1 且 watch(openP) 会把进度写回 1 → visible 恒为 true →
         遮罩（含 backdrop-filter 模糊）永久糊在屏幕上，切回应用后整屏发虚。 */
      openStop()
      system.setSwitcherProgress(0)
      system.switcherDwell = false
      neighborsIn.value = false
      entranceDone.value = false
      homePath.value = false
      hasFollow.value = false
      fanSnap(0)
      return
    }
    /* 同步编排（不放到 nextTick）：邻居卡要和开关置位在同一帧就带上目标样式，
       否则会先以 opacity 0 渲染一帧、再补 0.2s 淡入。measure() 走 .screen 兜底，
       不依赖本组件 dom 是否已挂载。 */
    measure()
    focusSnap(frontIndex.value)
    fanSnap(0)
    homePath.value = !system.activeAppId
    hasFollow.value = !!system.activeAppId && system.switcherProgress < 1
    if (homePath.value) {
      // 桌面直开：无前台应用可缩放 → 进度直接到 1；卡片下一帧自下方上浮入场
      system.setSwitcherProgress(1)
      openSnap(1)
      dwellTimer = setTimeout(() => { neighborsIn.value = true; markEntrance() }, 60)
      return
    }
    // 手势路径：进度从交接点连续推到 1（不论小于还是【大于】1 —— 手指越过满量程时
    // 交接进度会 >1，必须双向都能弹回固定终点，否则跟手卡永远压在堆叠卡上、切换器卡死）；
    // 邻居卡立即就位（不滑入、不淡入）
    openSnap(system.switcherProgress)
    openTo(1)
    neighborsIn.value = true
    entranceDone.value = true
  },
  { immediate: true }
)

/* ---- 位姿：a = i - focus ----
   0 = 焦点层（屏幕正中），1/2/3 = 更早的背景层（向左阶梯 + 缩小 + 变暗），
   负数 = 比焦点更新的卡（向右退出屏幕）。详见 switcherDeck.js。 */
function poseOf(i) {
  return deckPose(i - focus.value, metrics.value, dragFan.value)
}
/** 静止槽位（忽略扇开）—— 跟手卡交接、展开动画都按它算，保证像素级同位姿 */
function slotPose(i) {
  return deckPose(i - focus.value, metrics.value, 0)
}

/* 需要渲染的卡片：离焦点太远的直接剔除（规则⑤ 最多四层）。
   正在移除 / 正在展开的必须保留，否则动画会闪断。 */
const renderedCards = computed(() =>
  apps.value
    .map((id, i) => ({ id, i }))
    .filter(({ id, i }) => id === dismissing.value || id === expanding.value || deckVisible(i - focus.value))
)

/* 标签只跟「离焦点最近的那张」走，避免两张卡同时出现标签 */
const labelIndex = computed(() => {
  const last = Math.max(0, apps.value.length - 1)
  return Math.max(0, Math.min(last, Math.round(focus.value)))
})

/* 堆叠渲染态：统一的「藏 → 进场」编排，CSS transition 负责丝滑。 */
function stackStyle(i) {
  const p = deckPose(i - focus.value, metrics.value, dragFan.value)
  let y = p.y
  let opacity = 1
  let delay = '0ms'
  if (i === frontIndex.value && hasFollow.value) {
    // 跟手卡顶替中：堆叠前卡先隐藏，落位后再接管（同位姿，无跳变）
    opacity = settledOne.value ? 1 : 0
  } else if (!neighborsIn.value) {
    // 仅桌面路径会走到这里：先藏在下方 30% 处，邻居进场后按序上浮
    opacity = 0
    if (homePath.value) y += screenH.value * 0.3
    delay = entranceDone.value ? '0ms' : `${i * 60}ms`
  }
  return {
    width: cardW.value + 'px',
    height: cardH.value + 'px',
    transform: `translate3d(${p.x}px, ${y}px, 0) scale(${p.scale})`,
    filter: `brightness(${p.bright})`,
    zIndex: deckZ(i),
    borderRadius: RADIUS.value + 'px',
    opacity,
    transitionDelay: delay
  }
}

/** 卡片左上角标签（图标 + 名称）的位置 —— 见 LABEL_INSIDE 开关。
 *  卡外上方时 top = -(图标行高 + 间隙)，这两个值与 deckMetrics 的 LABEL_ROW_H/LABEL_GAP
 *  同源（修正 C：图标 18 → 24px，行高与间隙一起纳入「整体居中」的 blockH 计算）。 */
function labelStyle() {
  return LABEL_INSIDE
    ? { top: '10px', left: '12px' }
    : { top: -(DECK.LABEL_ROW_H + DECK.LABEL_GAP) + 'px', left: '0px' }
}

/* 交接判定：进场进度到位（跟手卡与前卡槽位几何重合）后交给堆叠前卡 */
const settledOne = computed(
  () => openP.value >= 0.999 && system.switcherProgress >= 0.999 && system.switcherProgress <= 1.001
)

/* ---- 跟手缩放（Ricky 2026-09-12 纠正）----
   ① 锚点 = 落点 = 【屏幕中心】：卡片原地缩小，全程不左右漂；
   ② 缩放严格跟随手指的上滑位移做【无极】变化 —— 上滑越远缩得越小，
      越过满量程（260px）之后继续按指数曲线变小；
   ③ 【绝不淡出】：卡片缩小但不允许「缩到不见」，并留一个可见下限兜底；
   ④ 松手后由弹簧回到固定终点（前卡槽位、最终大小）。 */
const MIN_FOLLOW_SCALE = 0.3
const followStyle = computed(() => {
  const p = system.switcherProgress
  if (p <= 0 || settledOne.value) return null
  const idx = frontIndex.value
  const slot = slotPose(idx)
  const slotCx = slot.x + cardW.value / 2
  const slotCy = slot.y + cardH.value / 2
  // p ≤ 1：屏幕中心 → 卡位中心（两者水平上同为屏幕中心，只有纵向在移动）
  const cx = screenW.value / 2 + (slotCx - screenW.value / 2) * Math.min(1, p)
  const cy = screenH.value / 2 + (slotCy - screenH.value / 2) * Math.min(1, p)
  const s =
    p <= 1
      ? 1 + (previewScale.value - 1) * p
      : Math.max(MIN_FOLLOW_SCALE, previewScale.value * Math.pow(0.55, p - 1))
  return {
    width: screenW.value + 'px',
    height: screenH.value + 'px',
    transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${s})`,
    borderRadius: (RADIUS.value * Math.min(1, p)) / Math.max(s, 0.01) + 'px',
    opacity: 1,
    zIndex: Z_FOLLOW
  }
})

/* 预览内容缩放：跟手/展开卡的外层 transform 已负责缩放，内容恒为 1；
   堆叠卡 = 卡宽/屏宽（与屏幕同比例缩放，零裁切） */
function contentScale(isFollow) {
  return isFollow ? 1 : previewScale.value
}

/* ---- 底部垃圾桶：进度后段才淡入，避免开场就「啪」地满亮 ---- */
const chromeOpacity = computed(
  () => Math.min(1, Math.max(0, (system.switcherProgress - 0.5) / 0.5))
)

function compOf(id) {
  return appComponents[id] || PlaceholderApp
}
function appOf(id) {
  return getApp(id)
}
function nameOf(id) {
  return i18n.appName(id) || getApp(id)?.name || id
}

/* ================= 手势 ================= */

const drag = ref(null)
const dismissing = ref(null)

/* 速度追踪（环形缓冲 100ms）—— 松手投影用。
   关键：读取时先按【当前时间】剔除过期样本 —— 手指停住 100ms 以上就没有动量了，
   必须返回 0（否则「拖到一半停住再松手」会带着停顿前的旧速度继续翻页）。 */
const vt = []
function vtPush(x, t) {
  vt.push({ x, t })
  while (vt.length > 1 && t - vt[0].t > 100) vt.shift()
}
function vtVelocity(now = performance.now()) {
  while (vt.length > 1 && now - vt[0].t > 100) vt.shift()
  if (vt.length < 2) return 0
  const a = vt[0]
  const b = vt[vt.length - 1]
  const dt = b.t - a.t
  return dt > 0 ? (b.x - a.x) / dt : 0 // px/ms，向右为正
}

function onPointerDown(e) {
  if (dismissing.value) return
  measure()
  vt.length = 0
  vtPush(e.clientX, performance.now())
  drag.value = {
    startX: e.clientX,
    startY: e.clientY,
    startFocus: focus.value,
    startT: performance.now(),
    mode: 'pending',
    dx: 0,
    vPx: 0
  }
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onPointerMove(e) {
  const d = drag.value
  if (!d) return
  const dx = e.clientX - d.startX
  const dy = e.clientY - d.startY
  if (d.mode === 'pending') {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    d.mode = Math.abs(dy) > Math.abs(dx) * 1.4 ? (dy < 0 ? 'v' : 'down') : 'h'
  }
  if (d.mode !== 'h') return
  /* 跟手方向（Ricky 2026-09-12 纠正）：
     堆叠布局是「更早的卡在左、更新的卡在右」，手势要让【手往右拖，卡片也往右走】。
     位姿 x 随 focus 单调增，所以焦点跟手是 startFocus + dx/span（旧代码写成 - dx
     → 手往右拖卡片却往左走）。 */
  d.dx = dx
  vtPush(e.clientX, performance.now())
  d.vPx = vtVelocity()
  fanSnap(deckFan(dx, metrics.value.span))
  focusSnap(deckClampFocus(d.startFocus + dx / metrics.value.span, apps.value.length))
}

function onPointerUp(e) {
  const d = drag.value
  if (!d) return
  drag.value = null
  const dy = e.clientY - d.startY
  // 松手这一刻也采一个速度样本（并剔除 >100ms 的旧样本）→ 停住再松手 = 0 动量
  const tNow = performance.now()
  vtPush(e.clientX, tNow)
  const vFocus = (vtVelocity(tNow) * 1000) / metrics.value.span // 层/秒

  if (d.mode === 'h') {
    /* 松手吸附（参考 StackSwipe：projected = pos + vIndex × 提前量 → 四舍五入）：
       位移过半才翻页；速度只用来「补足」尚未过半的位移 —— 快甩即使只走了 1/3 张也翻页，
       而已经走满一整张的快滑不会额外多翻一张（否则 span=0.85 卡宽的快滑会一次跳两层）。
       提前量偏置钳制在 ±0.4 层，避免高速把判定推得离谱。 */
    const cur = focus.value
    const base = Math.floor(cur)
    const frac = cur - base
    const bias = Math.max(-0.4, Math.min(0.4, vFocus * 0.1))
    const idx0 = base + (frac > 0.5 - bias ? 1 : 0)
    const idx = Math.max(0, Math.min(apps.value.length - 1, idx0))
    /* 扇开交给弹簧归零（与 focus 弹簧同参数、同起点 → 同步收尾，无硬跳变） */
    fanTo(0)
    focusToIndex(idx, { initialVelocity: Math.max(-6, Math.min(6, vFocus)) })
    return
  }
  fanTo(0)
  if (d.mode === 'v') {
    const cardId = hitCardId(e)
    if (cardId && dy < -110) dismissWithAnimation(cardId)
    return
  }
  if (d.mode === 'down' && dy > 80) {
    system.closeSwitcher()
    return
  }
  // 点按：点卡片恢复，点空白关闭
  if (Math.abs(e.clientX - d.startX) < 8 && Math.abs(e.clientY - d.startY) < 8) {
    /* 底部工具条（垃圾桶/计数）自己处理点击，不能被「点空白关闭」抢走。
       历史 bug（2026-09-12 修复）：pointerdown 在根上做了 setPointerCapture，
       浏览器会把 click 也重定向到捕获元素（根），于是按钮上的 @click 永远收不到，
       垃圾桶那一击还会被误判成「点空白」→ closeSwitcher()，清空最近任务一直无效。
       这里改为在 tap 分支用 elementFromPoint（不受捕获影响）直接判定命中。 */
    const hitEl = document.elementFromPoint(e.clientX, e.clientY)
    const dockHit = hitEl?.closest?.('.switcher-dock')
    if (dockHit) {
      if (hitEl.closest('.switcher-trash')) clearAll()
      return
    }
    const cardId = hitCardId(e)
    if (cardId) resumeWithExpand(cardId)
    else system.closeSwitcher()
  }
}

function hitCardId(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const card = el?.closest?.('.switcher-card')
  return card?.dataset?.appId || null
}

/* 上滑移除：飞出 + 其余卡片弹簧重排 */
function dismissWithAnimation(appId) {
  dismissing.value = appId
  setTimeout(() => {
    system.dismissApp(appId)
    dismissing.value = null
    const idx = Math.max(0, Math.min(apps.value.length - 1, Math.round(focus.value)))
    focusToIndex(idx)
  }, 240)
}

function dismissingStyle(i) {
  const p = deckPose(i - focus.value, metrics.value, 0)
  return {
    width: cardW.value + 'px',
    height: cardH.value + 'px',
    transform: `translate3d(${p.x}px, ${p.y - screenH.value * 1.1}px, 0) scale(${p.scale})`,
    opacity: 0,
    zIndex: deckZ(i),
    borderRadius: RADIUS.value + 'px'
  }
}

/* 点卡片恢复：卡位 →（围绕中心 scale 放大）→ 全屏，再正式切到 AppWindow（无缝衔接）。
   历史 bug（2026-09-12 修复）：旧实现直接改 width/height 到全屏 + transform 归位，
   宽高没有过渡 → 卡片会「瞬间变大再滑过去」。改为与跟手卡同一套「中心锚点 scale」几何。 */
const expanding = ref(null)
const expandTo = ref(false)
function resumeWithExpand(appId) {
  expanding.value = appId
  expandTo.value = false
  // 先渲染「起始态」，两帧后再切目标态，浏览器才会跑过渡
  requestAnimationFrame(() => requestAnimationFrame(() => { expandTo.value = true }))
  setTimeout(() => {
    system.resumeApp(appId)
    expanding.value = null
    expandTo.value = false
  }, 300)
}

function expandingStyle(i) {
  const idx = apps.value.indexOf(expanding.value)
  const slot = slotPose(idx < 0 ? i : idx)
  const cx = expandTo.value ? screenW.value / 2 : slot.x + cardW.value / 2
  const cy = expandTo.value ? screenH.value / 2 : slot.y + cardH.value / 2
  const s = expandTo.value ? 1 : previewScale.value
  return {
    width: screenW.value + 'px',
    height: screenH.value + 'px',
    transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${s})`,
    borderRadius: expandTo.value ? '0px' : RADIUS.value / Math.max(s, 0.01) + 'px',
    filter: 'brightness(1)',
    zIndex: Z_EXPAND,
    opacity: 1
  }
}

/* 卡片样式分派 —— 锚点几何（跟手/展开）居中缩放，堆叠几何以左上角为原点 */
function cardStyle(id, i) {
  if (id === dismissing.value) return dismissingStyle(i)
  if (id === expanding.value) return expandingStyle(i)
  return stackStyle(i)
}

/* 底部垃圾桶：清空最近任务回桌面 */
function clearAll() {
  system.dismissAll()
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && screenRef.el) {
    ro = new ResizeObserver(measure)
    ro.observe(screenRef.el)
  }
})
watch(rootRef, (el) => { if (el) measure() })
onBeforeUnmount(() => {
  if (ro) { ro.disconnect(); ro = null }
  clearTimeout(dwellTimer)
  clearTimeout(settleTimer)
})
</script>

<template>
  <div
    v-if="visible"
    ref="rootRef"
    class="app-switcher"
    :class="{ 'is-dragging': !!drag, 'is-focus-moving': focusMoving, 'is-dismissing': !!dismissing || !!expanding }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <!-- 背景模糊压暗：跟手势进度淡入 -->
    <div class="switcher-dim" :style="{ opacity: Math.min(1, system.switcherProgress) }"></div>

    <div class="switcher-track">
      <!-- 跟手缩放卡：手势进行中（progress<1）只有它，把全屏应用连续缩到卡位 -->
      <div
        v-if="followStyle && system.activeAppId"
        class="switcher-card is-follow"
        :style="followStyle"
      >
        <div class="switcher-card-body">
          <div
            class="switcher-card-content"
            :style="{
              width: screenW + 'px',
              height: screenH + 'px',
              transform: `scale(${contentScale(true)})`,
              transformOrigin: '0 0'
            }"
          >
            <component :is="compOf(system.activeAppId)" :app="appOf(system.activeAppId)" />
          </div>
        </div>
      </div>

      <!-- 堆叠卡片组：切换器打开后渲染。
           前卡在进场进度 <1 时由跟手卡顶替（同位姿无缝交接），其余卡片按进度淡入。
           层级由 deckZ(i) = 10000 - i 决定 —— 顶卡一直到最后飞出屏幕都在最上层。 -->
      <template v-if="system.appSwitcherOpen">
        <div
          v-for="c in renderedCards"
          :key="c.id"
          class="switcher-card is-deck"
          :data-app-id="c.id"
          :data-index="c.i"
          :data-depth="+(c.i - focus).toFixed(3)"
          :style="cardStyle(c.id, c.i)"
        >
          <!-- 卡片左上角：应用图标 + 名称（只跟离焦点最近的那张走） -->
          <div v-if="c.i === labelIndex && !dismissing" class="switcher-card-label" :style="labelStyle()">
            <AppIcon :app="appOf(c.id)" :size="24" :show-label="false" />
            <span>{{ nameOf(c.id) }}</span>
          </div>
          <div class="switcher-card-body">
            <div
              class="switcher-card-content"
              :style="{
                width: screenW + 'px',
                height: screenH + 'px',
                transform: `scale(${c.id === expanding ? 1 : previewScale})`,
                transformOrigin: '0 0'
              }"
            >
              <component :is="compOf(c.id)" :app="appOf(c.id)" />
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 底部：清空后台（与通知中心同款磨砂圆钮；进度到位后淡入） -->
    <div
      v-if="system.appSwitcherOpen"
      class="switcher-dock"
      :style="{ opacity: chromeOpacity, zIndex: Z_CHROME }"
    >
      <GlassCircleButton
        class="switcher-trash"
        :label="i18n.t('clearAllNotifs')"
        @click.stop="clearAll"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
        </svg>
      </GlassCircleButton>
    </div>
  </div>
</template>

<style scoped>
.app-switcher {
  position: absolute;
  inset: 0;
  z-index: 95; /* 低于 Home 手势条（96），保证底部手势可用 */
  touch-action: none;
  user-select: none;
  overflow: hidden;
}

.switcher-dim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(26px) saturate(140%);
  -webkit-backdrop-filter: blur(26px) saturate(140%);
}

.switcher-track {
  position: absolute;
  inset: 0;
}

.switcher-card {
  position: absolute;
  left: 0;
  top: 0;
  /* 锚点几何（跟手缩放 / 点卡恢复）：围绕中心缩放 */
  transform-origin: center center;
  will-change: transform, filter;
}
/* 堆叠几何：以【左上角】为原点缩放 —— 左边缘被钉住，下层才会「露出越来越少的左侧阶梯」
   （若用 center，缩放会把左边缘往右推，阶梯会被吃掉，最深层还会漂出屏）。
   垂直方向的「居中」由 deckPose 的 y = cardCy - cardH·scale/2 显式补偿（修正 B）：
   原点在左上角不再意味着顶对齐，所有层的垂直中心恒等于 cardCy。 */
.switcher-card.is-deck {
  transform-origin: 0 0;
}
/* 非拖拽 / 非焦点弹簧推进时开过渡（重排、移除、恢复、桌面入场）。
   - .is-follow 的 transform 由手势/进场弹簧逐帧直写，挂 transition 会被二次低通，
     表现为「跟手滞后、松手后慢慢飘」→ 必须排除；
   - .is-focus-moving 是松手后的吸附弹簧，同理必须排除。
   - 曲线 0.32s / cubic-bezier(0.32, 1.16, 0.6, 1)：与 ios-deck 弹簧（τ≈110ms、
     过冲 6.7%）的收尾观感一致，末段带一点回弹余韵，不再是死板的 ease-out。 */
.app-switcher:not(.is-dragging):not(.is-focus-moving) .switcher-card:not(.is-follow) {
  transition:
    transform 0.32s cubic-bezier(0.32, 1.16, 0.6, 1),
    opacity 0.22s ease,
    filter 0.28s ease;
}

.switcher-card-label {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 24px; /* = DECK.LABEL_ROW_H（改这里要同步 switcherDeck.js） */
  color: rgba(255, 255, 255, 0.95);
  font: 500 16px/1 var(--font-stack);
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
}

.switcher-card-body {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  background: #0a0a0c;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.42);
}

.switcher-card-content {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none; /* 预览只看不摸 */
  background: var(--bg-grouped, #f2f2f7);
}

.switcher-dock {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(var(--home-indicator-inset, 14px) + 26px);
  display: flex;
  flex-direction: column;
  align-items: center;
  /* z-index 由模板绑 Z_CHROME 给（压在所有卡片之上） */
}
</style>
