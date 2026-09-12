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
 *   前卡槽位  焦点 0（当前）左缘 31%；浏览时 23.5%（左右各留 12.5% 对称露出）
 *   堆叠      更早的卡向【左】逐层偏移 12.5% 屏宽、亮度 ×0.78 递减（尺寸不变）
 *   更新的卡  向【右】滑出，只留 12.5% 屏宽露出（与左侧对称）
 *
 * 动效：
 *   进入      HomeIndicator 停驻手势驱动 switcherProgress 0→1，前台应用围绕【屏幕中心】
 *             连续缩到卡位（跟手，无 transition 平滑，逐帧直写）；进度可过拉到 1.35
 *             继续缩小变透明，松手弹簧回 1
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
    // 手势路径：进度从交接点连续推到 1；邻居卡立即就位（不滑入、不淡入）
    openSnap(system.switcherProgress)
    if (system.switcherProgress < 1) openTo(1)
    neighborsIn.value = true
    entranceDone.value = true
  },
  { immediate: true }
)

/* ---- 前卡槽位：焦点 0 → 左缘 31%（当前卡最右）；浏览时 → 23.5%（左右对称） ---- */
const frontX = computed(() => screenW.value * (0.31 - Math.min(Math.max(focus.value, 0), 1) * 0.075))

/* ---- 卡片位姿：o = i - focus ----
   o ≥ 0（比焦点更早）：向左堆叠，每层左移 12.5% 屏宽、亮度递减；
   o < 0（比焦点更新）：向右滑出，o = -1 时只留 12.5% 屏宽露出（与左侧对称），
                        更外层的继续右移出屏。 */
const outX = computed(() => screenW.value * (1 - PILE_FRAC))
function pose(i) {
  const o = i - focus.value
  const ao = Math.abs(o)
  let x
  if (o >= 0) {
    x = frontX.value - o * screenW.value * PILE_FRAC
  } else {
    x = frontX.value + (-o) * (outX.value - frontX.value) + Math.max(0, -o - 1) * screenW.value * 0.9
  }
  const bright = 1 - 0.22 * Math.min(ao, 1.5)
  return { x, scale: 1, bright, z: 100 - Math.round(ao * 10), o }
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

/* ---- 跟手缩放 ----
   ① 锚点是【屏幕中心】：缩放围绕中心进行，不是左上角；
   ② 进度可过拉到 1.35：到最终大小后继续拖，卡片继续缩小并变透明，松手弹簧回 1；
   ③ 进度 1 时恰好落到前卡槽位（与堆叠卡同位姿，无缝交接）。 */
const settledOne = computed(
  () => openP.value >= 0.999 && system.switcherProgress >= 0.999 && system.switcherProgress <= 1.001
)
const followStyle = computed(() => {
  const p = system.switcherProgress
  if (p <= 0 || settledOne.value) return null
  const idx = frontIndex.value
  const slot = pose(idx)
  const slotCx = slot.x + cardW.value / 2
  const slotCy = cardY.value + cardH.value / 2
  const cx = screenW.value / 2 + (slotCx - screenW.value / 2) * Math.min(1, p)
  const cy = screenH.value / 2 + (slotCy - screenH.value / 2) * Math.min(1, p)
  const s = 1 + (previewScale.value - 1) * p // p=1 → 0.64；过拉继续变小
  const over = Math.max(0, p - 1)
  const opacity = 1 - Math.min(1, over / 0.35)
  return {
    width: screenW.value + 'px',
    height: screenH.value + 'px',
    transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${s})`,
    borderRadius: (RADIUS.value * Math.min(1, p)) / Math.max(s, 0.01) + 'px',
    opacity,
    zIndex: 300
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
    d.travel = -dx / cardW.value
    // 跟手：焦点直接跟手指，两端橡皮筋 0.35
    let next = d.startFocus - dx / cardW.value
    if (next < 0) next *= 0.35
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
    zIndex: 400,
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
      :style="{ opacity: chromeOpacity }"
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
      :style="{ opacity: chromeOpacity }"
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
  z-index: 500;
  pointer-events: none;
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
  gap: 10px;
  z-index: 500;
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
