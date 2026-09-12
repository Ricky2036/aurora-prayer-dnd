<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { getApp } from '../../config/apps'
import { appComponents } from '../apps/registry'
import PlaceholderApp from '../apps/PlaceholderApp.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useSystemStore } from '../../stores/systemStore'
import { useI18nStore } from '../../stores/i18nStore'
import { useSpring } from '../../composables/useSpring'
import { screenRef } from '../../utils/screenRef'

/**
 * 最近任务切换器（App Switcher / Recent）—— ColorOS/iOS 堆叠式。
 *
 * 几何（全部按屏幕分数，不写死 px）：
 *   卡片      宽 = 屏宽 × 0.64、高 = 屏高 × 0.64（与屏幕同比例 → 预览零裁切）
 *   顶距      屏高 × 0.09；圆角 = 屏宽 × 0.0667（360 屏上 = 24）
 *   前卡槽位  恒定【屏幕水平正中】（左右各留 18%）—— 上滑缩放落点即屏幕中心
 *   堆叠      以屏幕中心为基准对称排列：更早的卡向左、更新的卡向右，
 *             每层偏移 12.5% 屏宽、亮度 ×0.78 递减（尺寸不变）；
 *             z 层级严格按「距焦点远近」排（×1000 细粒度），最近的在最上
 *   横滑      焦点头跟手：手往右拖 → focus 增大 → 全部卡片一起往右走，
 *             更早的卡从左侧进场；手往左拖则反之（松手按位移/速度吸附到整卡）
 *
 * 动效：
 *   进入      HomeIndicator 停驻手势驱动 switcherProgress 0→1，前台应用围绕【屏幕中心】
 *             连续缩到卡位（跟手，无 transition 平滑，逐帧直写）；进度用原始位移换算，
 *             越过满量程后继续无极变小，但【绝不淡出】；松手弹簧回到固定终点
 *   交接      跟手卡落位后由同位姿的堆叠前卡接管（几何逐像素相等，无跳变）
 *   邻居卡    手势路径一开始就在槽位（藏在前卡后面，前卡缩小后自然露出）；
 *             桌面直开路径自下方 30% 上浮、逐张 60ms 错峰入场
 *
 * 预览实例通过 provide('appPreview') 与全局隔离（backRegistry 不注册返回处理器）。
 */

const system = useSystemStore()
const i18n = useI18nStore()
provide('appPreview', true)

const rootRef = ref(null)
const screenW = ref(0)
const screenH = ref(0)

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
}

let ro = null

/* ---- 几何常量 ---- */
const cardW = computed(() => Math.round(screenW.value * 0.64))
const cardH = computed(() => Math.round(screenH.value * 0.64))
const cardY = computed(() => Math.round(screenH.value * 0.09))
const PILE_FRAC = 0.125                              // 堆叠每层位移（屏宽分数）
const RADIUS = computed(() => Math.round(screenW.value * 0.0667)) // 按比例，不写死
const previewScale = computed(() => (screenW.value ? cardW.value / screenW.value : 1))

/* ---- 内部 z 层级 ----
   本组件（.app-switcher）自带层叠上下文，所以这里只须【内部自洽】，
   不必迁就外面的 z。堆叠卡的层级必须由「距焦点的远近」决定，且粒度要足够细。 */
const Z_STACK_BASE = 10000                            // 焦点卡（距焦点 0 张）
const Z_STACK_STEP = 1000                             // 每远离焦点 1 张降 1 档
const Z_FOLLOW = 12000                                // 跟手缩放卡（进场中，压在堆叠卡上）
const Z_EXPAND = 13000                                // 点卡片恢复的放大卡
const Z_CHROME = 14000                                // 标题 / 底部垃圾桶

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

/* 焦点弹簧动画期间关闭 CSS transition —— 否则逐帧推进的 spring 会被 0.24s 过渡
   二次低通，松手后的吸附变成「慢慢飘过去」，没有弹簧的干脆手感。 */
const focusMoving = ref(false)
function focusToIndex(idx, opts = {}) {
  focusMoving.value = true
  focusTo(idx, { ...opts, onDone: () => { focusMoving.value = false } })
}

/* 邻居进场编排：
   - 手势路径：开关打开瞬间即「已在槽位」（藏在前卡后面，前卡缩小自然露出），无滑入；
   - 桌面路径：下一帧起自下方上浮，逐张 60ms 错峰（参考视频入场）。
   homePath / hasFollow 必须与本组同时声明在 watcher 之前 —— 下面的 watcher
   带 immediate，setup 阶段就会同步访问它们。 */
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
      return
    }
    /* 同步编排（不放到 nextTick）：邻居卡要和开关置位在同一帧就带上目标样式，
       否则会先以 opacity 0 渲染一帧、再补 0.2s 淡入。measure() 走 .screen 兜底，
       不依赖本组件 dom 是否已挂载。 */
    measure()
    focusSnap(frontIndex.value)
    homePath.value = !system.activeAppId
    hasFollow.value = !!system.activeAppId && system.switcherProgress < 1
    if (homePath.value) {
      // 桌面直开：无前台应用可缩放 → 进度直接到 1；卡片下一帧自下方上浮入场
      system.setSwitcherProgress(1)
      openSnap(1)
      dwellTimer = setTimeout(() => { neighborsIn.value = true; markEntrance() }, 60)
      return
    }
    // 手势路径：进度从交接点连续推到 1（不论当前是小于还是【大于】1 —— 手指越过
    // 满量程时交接进度会 >1，必须双向都能弹回固定终点，否则弹簧停在 >1 处，
    // 跟手卡永远压在堆叠卡上、切换器卡死）；邻居卡立即就位（不滑入、不淡入）
    openSnap(system.switcherProgress)
    openTo(1)
    neighborsIn.value = true
    entranceDone.value = true
  },
  { immediate: true }
)

/* ---- 前卡槽位：恒定【屏幕水平中心】 ----
   Ricky 2026-09-12：上滑缩放要落在屏幕中心，不是偏左/偏右。
   这一条同时决定了跟手卡的缩放锚点与落点 —— 两者都等于屏幕中心，
   所以缩小的全过程卡片「原地缩」，不会一边缩一边往一侧漂。 */
const frontX = computed(() => (screenW.value - cardW.value) / 2)

/* ---- 卡片位姿：o = i - focus ----
   全部以屏幕中心为基准做【对称】堆叠：每层偏移 12.5% 屏宽。
   o ≥ 0（更早的卡）在左，o < 0（更新的卡）在右，
   前卡（o = 0）永远在屏幕正中，左右露出的宽度一致。

   z 层级 = 距焦点越近越靠上（×1000 细粒度）。

   ⚠️ 历史 bug（2026-09-12 修复）：旧公式 `100 - Math.round(ao * 10)` 粒度太粗，
   在「两张相邻卡等距」的交叉点附近（ao 相差 < 0.05）会算出【完全相同的 z】，
   浏览器只能用 DOM 顺序兜底 → 索引更大的那张（更早的卡）永远赢 →
   拖到一半时「正在进场的卡」被「正在出场的卡」盖住，肉眼看到中心卡突然沉到下面
   （Ricky 原话：最顶部的卡片还能跑到下面去，整个层级关系都是错的）。
   实测：去程 6 帧、回程 8 帧出现「屏幕中心最上层 ≠ 离中心最近的卡」。
   放大到 ×1000 后等距窗口只剩 0.05px 卡片位移，肉眼不可见。 */
function pose(i) {
  const o = i - focus.value
  const ao = Math.abs(o)
  const x = frontX.value - o * screenW.value * PILE_FRAC
  const bright = 1 - 0.22 * Math.min(ao, 1.5)
  return { x, scale: 1, bright, z: Z_STACK_BASE - Math.round(ao * Z_STACK_STEP), o }
}

/* 堆叠渲染态：统一的「藏 → 进场」编排，CSS transition 负责丝滑。 */
function stackStyle(i) {
  const p = pose(i)
  let y = cardY.value
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
    zIndex: p.z,
    borderRadius: RADIUS.value + 'px',
    opacity,
    transitionDelay: delay
  }
}

/* 交接判定：进场进度到位（跟手卡与前卡槽位几何重合）后交给堆叠前卡 */
const settledOne = computed(
  () => openP.value >= 0.999 && system.switcherProgress >= 0.999 && system.switcherProgress <= 1.001
)

/* ---- 跟手缩放（Ricky 2026-09-12 纠正）----
   ① 锚点 = 落点 = 【屏幕中心】：卡片原地缩小，全程不左右漂；
   ② 缩放严格跟随手指的上滑位移做【无极】变化 —— 上滑越远缩得越小，
      越过满量程（260px）之后继续按指数曲线变小；
   ③ 【绝不淡出】：卡片缩小但不允许「缩到不见」（去掉旧版过拉变透明的逻辑），
      并留一个可见下限兜底；
   ④ 松手后由弹簧回到固定终点（前卡槽位、最终大小）。 */
const MIN_FOLLOW_SCALE = 0.3
const followStyle = computed(() => {
  const p = system.switcherProgress
  if (p <= 0 || settledOne.value) return null
  const idx = frontIndex.value
  const slot = pose(idx)
  const slotCx = slot.x + cardW.value / 2
  const slotCy = cardY.value + cardH.value / 2
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

/* ---- 顶部标题 / 底部垃圾桶：进度后段才淡入，避免开场就「啪」地满亮 ---- */
const chromeOpacity = computed(
  () => Math.min(1, Math.max(0, (system.switcherProgress - 0.5) / 0.5))
)

/* ---- 前卡标题（图标 + 名称，跟焦点走） ---- */
const labelApp = computed(() => {
  const idx = Math.max(0, Math.min(apps.value.length - 1, Math.round(focus.value)))
  return apps.value[idx]
})
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

function onPointerDown(e) {
  if (dismissing.value) return
  measure()
  drag.value = {
    startX: e.clientX,
    startY: e.clientY,
    startFocus: focus.value,
    startT: performance.now(),
    mode: 'pending',
    travel: 0
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
  if (d.mode === 'h') {
    /* 跟手方向（Ricky 2026-09-12 纠正）：
       堆叠布局是「更早的卡在左、更新的卡在右」，手势要让【手往右拖，卡片也往右走】。
       卡片位姿 x = frontX + o × 步距（o = i - focus），所以要 x 增大就必须让 focus 增大，
       因此焦点跟手是 startFocus + dx（旧代码写成 - dx → 手往右拖卡片却往左走）。 */
    d.travel = dx / cardW.value
    let next = d.startFocus + dx / cardW.value
    if (next < 0) next *= 0.35                       // 越过最新端（右侧到头）：橡皮筋
    if (next > apps.value.length - 1) next = apps.value.length - 1 + (next - (apps.value.length - 1)) * 0.35
    focusSnap(next)
  }
}

function onPointerUp(e) {
  const d = drag.value
  if (!d) return
  drag.value = null
  const dy = e.clientY - d.startY
  const fastFlick = performance.now() - d.startT < 300 && Math.abs(e.clientX - d.startX) > 50

  if (d.mode === 'h') {
    const base = Math.round(d.startFocus)
    const travel = d.travel || 0
    let idx = base
    if (travel > 0.3 || (travel > 0.08 && fastFlick)) idx = base + 1
    else if (travel < -0.3 || (travel < -0.08 && fastFlick)) idx = base - 1
    idx = Math.max(0, Math.min(apps.value.length - 1, idx))
    focusToIndex(idx, { initialVelocity: travel * 1.6 })
    return
  }
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
  const p = pose(i)
  return {
    width: cardW.value + 'px',
    height: cardH.value + 'px',
    transform: `translate3d(${p.x}px, ${cardY.value - screenH.value * 1.1}px, 0) scale(${p.scale})`,
    opacity: 0,
    zIndex: p.z,
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
  const slot = pose(idx < 0 ? i : idx)
  const cx = expandTo.value ? screenW.value / 2 : slot.x + cardW.value / 2
  const cy = expandTo.value ? screenH.value / 2 : cardY.value + cardH.value / 2
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

    <!-- 前卡标题：图标 + 名称（跟焦点应用走，进度到位后显示） -->
    <div
      v-if="system.appSwitcherOpen && labelApp"
      class="switcher-title"
      :style="{ opacity: chromeOpacity, zIndex: Z_CHROME }"
    >
      <AppIcon :app="appOf(labelApp)" :size="22" :show-label="false" />
      <span>{{ nameOf(labelApp) }}</span>
    </div>

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
           前卡在进场进度 <1 时由跟手卡顶替（同位姿无缝交接），其余卡片按进度淡入 -->
      <template v-if="system.appSwitcherOpen">
        <div
          v-for="(id, i) in apps"
          :key="id"
          class="switcher-card"
          :data-app-id="id"
          :style="id === dismissing ? dismissingStyle(i) : id === expanding ? expandingStyle(i) : stackStyle(i)"
        >
          <div class="switcher-card-body">
            <div
              class="switcher-card-content"
              :style="{
                width: screenW + 'px',
                height: screenH + 'px',
                transform: `scale(${id === expanding ? 1 : previewScale})`,
                transformOrigin: '0 0'
              }"
            >
              <component :is="compOf(id)" :app="appOf(id)" />
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 底部：垃圾桶 + 进行中数量（进度到位后显示） -->
    <div
      v-if="system.appSwitcherOpen"
      class="switcher-dock"
      :style="{ opacity: chromeOpacity, zIndex: Z_CHROME }"
    >
      <button class="switcher-trash" @click.stop="clearAll" aria-label="清空全部">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
        </svg>
      </button>
      <span class="switcher-count">{{ apps.length }} 个应用正在进行 ›</span>
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

.switcher-title {
  position: absolute;
  top: calc(var(--safe-top, 20px) + 26px);
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: rgba(255, 255, 255, 0.95);
  font: 500 14px/1 var(--font-stack);
  pointer-events: none;             /* z-index 由模板绑 Z_CHROME 给 */
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}

.switcher-track {
  position: absolute;
  inset: 0;
}

.switcher-card {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: center center;
  will-change: transform, filter;
}
/* 非拖拽 / 非焦点弹簧推进时开过渡（重排、移除、恢复、桌面入场）。
   - .is-follow 的 transform 由手势/进场弹簧逐帧直写，挂 transition 会被二次低通，
     表现为「跟手滞后、松手后慢慢飘」→ 必须排除；
   - .is-focus-moving 是松手后的吸附弹簧，同理必须排除。 */
.app-switcher:not(.is-dragging):not(.is-focus-moving) .switcher-card:not(.is-follow) {
  transition:
    transform 0.24s cubic-bezier(0.25, 1, 0.4, 1),
    opacity 0.2s ease,
    filter 0.24s ease;
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
  gap: 10px;                      /* z-index 由模板绑 Z_CHROME 给（压在所有卡片之上） */
}
.switcher-trash {
  width: 44px;
  height: 44px;
  border-radius: 22px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}
.switcher-trash:active {
  transform: scale(0.88);
  background: rgba(255, 255, 255, 0.22);
}
.switcher-count {
  color: rgba(255, 255, 255, 0.75);
  font: 400 12px/1 var(--font-stack);
  pointer-events: none;
}
</style>
