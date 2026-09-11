<script setup>
import { computed, nextTick, provide, ref, watch } from 'vue'
import { getApp } from '../../config/apps'
import { appComponents } from '../apps/registry'
import PlaceholderApp from '../apps/PlaceholderApp.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useSystemStore } from '../../stores/systemStore'
import { useI18nStore } from '../../stores/i18nStore'
import { useSpring } from '../../composables/useSpring'

/**
 * 最近任务切换器（App Switcher / Recent）—— ColorOS/iOS 堆叠式。
 * 几何与动效参数均从参考录屏逐帧量出（2026-09-11）：
 *
 *   卡片      宽 = 屏宽 × 0.86，高 = 屏高 × 0.72，圆角 24，顶距 屏高 × 0.11
 *   前卡      全亮度 scale 1；后卡 亮度 × 0.75、scale 0.95
 *   左侧堆叠  每张左移 26px 逐层堆出；右侧队列 露出约一窄条（cardW × 0.97 间距）
 *   预览      按屏宽缩放到卡宽后【顶对齐裁底】（cover），绝不留黑边
 *   浏览      焦点值为小数的弹簧：拖拽跟手，松手按 起始页 ± 位移/快甩 吸附
 *   进入      HomeIndicator 停驻手势驱动 switcherProgress 0→1：
 *             前台应用从全屏连续缩放到卡片位（跟手缩放），背景模糊压暗淡入
 *
 * 预览实例通过 provide('appPreview') 与全局隔离（backRegistry 不注册返回处理器）。
 */

const system = useSystemStore()
const i18n = useI18nStore()
provide('appPreview', true)

const rootRef = ref(null)
const screenW = ref(0)
const screenH = ref(0)

/* ---- 几何常量（2026-09-11 二轮：按 Ricky 两段参考录屏 + 两张参考图逐帧量出） ----
 *   卡片      宽 = 高 = 屏幕 × 0.82（与屏幕同比例 → 预览零裁切，Ricky 要求避免过多裁切）
 *   顶距      屏高 × 0.11；前卡槽位 X = 3.5% + min(焦点,1) × 12.5%（列表首 = 靠左 3.5%，
 *             浏览第 2 张起 = 16%，与 image3/image2 参考图一致）
 *   左侧堆叠  每层左移 12.5% 屏宽（露出宽度参考 image2）；右侧队列 间距 0.98×卡宽
 *             （列表首时右邻露出 ≈16%，参考 image3）
 *   后卡      亮度 × 0.75（前卡全亮），尺寸不变 */
const cardW = computed(() => Math.round(screenW.value * 0.82))
const cardH = computed(() => Math.round(screenH.value * 0.82))
const cardY = computed(() => Math.round(screenH.value * 0.11))
const PILE_FRAC = 0.125           // 左侧堆叠每层位移（屏宽分数）
const QUEUE_RATIO = 0.98          // 右侧队列间距 = cardW × 0.98
const RADIUS = 24
const previewScale = computed(() => (screenW.value ? cardW.value / screenW.value : 1))

function measure() {
  const el = rootRef.value
  if (!el) return
  screenW.value = el.offsetWidth
  screenH.value = el.offsetHeight
}

/* ---- 焦点（小数，单位=张），spring 驱动 —— 丝滑的来源 ---- */
const { value: focus, animateTo: focusTo, snapTo: focusSnap } = useSpring(0, 'ios-gentle')
/* 进场进度弹簧：手势交接的 switcherProgress（~0.5）连续推到 1，
 * 前台应用从 hero 预览的跟手缩放无缝滑进卡位 */
const { value: openP, animateTo: openTo, snapTo: openSnap } = useSpring(1, 'ios-gentle')
watch(openP, (v) => system.setSwitcherProgress(v))
const apps = computed(() => system.recentApps)
const frontIndex = computed(() => {
  const i = apps.value.indexOf(system.activeAppId)
  return i < 0 ? 0 : i
})

const visible = computed(() => system.appSwitcherOpen || system.switcherProgress > 0)

/* 邻居进场：手势路径悬停 ~0.5s 后才进场（Ricky 参考视频 00:03 明确节奏）；
   直开路径（桌面）下一帧即进场。entranceDone 之后 stagger 清零，
   否则浏览/吸附时后面的卡会一直带 60ms 延迟（只在进场时要有序） */
const neighborsIn = ref(false)
const entranceDone = ref(false)
let dwellTimer = null
let settleTimer = null

watch(
  () => system.appSwitcherOpen,
  (open) => {
    clearTimeout(dwellTimer)
    clearTimeout(settleTimer)
    if (!open) { neighborsIn.value = false; entranceDone.value = false; return }
    nextTick(() => {
      measure()
      focusSnap(frontIndex.value)
      const markDone = (base) => {
        settleTimer = setTimeout(() => { entranceDone.value = true }, base + apps.value.length * 60 + 320)
      }
      if (!system.activeAppId) {
        // 桌面直开：无前台应用可缩放，进度直接到 1；
        // 卡片下一帧才进场（先停在下方 30% 处，靠 transition 逐张上浮，参考视频入场）
        system.setSwitcherProgress(1)
        openSnap(1)
        dwellTimer = setTimeout(() => { neighborsIn.value = true }, 60)
        markDone(60)
      } else if (system.switcherProgress < 1) {
        // 手势路径：跟手卡从交接进度（~0.5）连续滑进卡位，邻居悬停 0.5s 后进场
        openSnap(system.switcherProgress)
        openTo(1)
        dwellTimer = setTimeout(() => { neighborsIn.value = true }, 500)
        markDone(500)
      } else {
        openSnap(1)
        neighborsIn.value = true
        entranceDone.value = true
      }
    })
  },
  { immediate: true }
)

/* ---- 前卡槽位：焦点 0 → 屏宽 3.5%（列表首，右邻露出 16%）；
        焦点 ≥1 → 屏宽 16%（两侧堆叠/队列对称露出，参考两张参考图） ---- */
const frontX = computed(() => screenW.value * (0.035 + Math.min(Math.max(focus.value, 0), 1) * PILE_FRAC))

/* ---- 卡片位姿：o = i - focus，前卡居中、左堆右排 ---- */
function pose(i) {
  const o = i - focus.value
  const ao = Math.abs(o)
  let x
  if (o >= 0) {
    // 前卡 + 右侧队列
    x = frontX.value + o * cardW.value * QUEUE_RATIO
  } else {
    // 左侧堆叠
    x = frontX.value + o * screenW.value * PILE_FRAC
  }
  const scale = 1 // 尺寸不缩（参考里前后卡同大，差异在亮度）
  const bright = 1 - 0.25 * Math.min(ao, 1)
  return { x, scale, bright, z: 100 - Math.round(ao * 10), o }
}

function cardStyle(i) {
  const p = pose(i)
  return {
    width: cardW.value + 'px',
    height: cardH.value + 'px',
    transform: `translate3d(${p.x}px, ${cardY.value}px, 0) scale(${p.scale})`,
    filter: `brightness(${p.bright})`,
    zIndex: p.z,
    borderRadius: RADIUS + 'px'
  }
}

/* 堆叠渲染态：统一的「藏 → 进场」编排，CSS transition 负责丝滑。
   - 手势路径（应用内）：前卡在进度 <1 时透明（跟手卡同位姿顶替）；
     邻居悬停 0.5s 前藏在槽位右侧 26% 屏宽处且透明，到点后逐张（i×60ms）滑入。
   - 桌面路径：所有卡藏在下方 30% 屏高处且透明，下一帧逐张（i×60ms）上浮进场
     （参考视频：背景模糊压暗 + 卡片自下方有序入场）。 */
const homePath = computed(() => !system.activeAppId)
function stackStyle(i) {
  const p = pose(i)
  let x = p.x
  let y = cardY.value
  let opacity = 1
  let delay = '0ms'
  if (i === frontIndex.value && !homePath.value) {
    opacity = system.switcherProgress >= 0.999 ? 1 : 0
  } else if (!neighborsIn.value) {
    opacity = 0
    if (homePath.value) y += screenH.value * 0.3
    else x += screenW.value * 0.26
  } else {
    delay = entranceDone.value ? '0ms' : `${i * 60}ms`
  }
  return {
    width: cardW.value + 'px',
    height: cardH.value + 'px',
    transform: `translate3d(${x}px, ${y}px, 0) scale(${p.scale})`,
    filter: `brightness(${p.bright})`,
    zIndex: p.z,
    borderRadius: RADIUS + 'px',
    opacity,
    transitionDelay: delay
  }
}

/* ---- 跟手缩放：switcherProgress 0→1 时，前台应用卡从全屏连续收缩到卡位 ---- */
const followStyle = computed(() => {
  const p = system.switcherProgress
  if (p <= 0 || p >= 1) return null
  const idx = frontIndex.value
  const slot = pose(idx)
  const x = slot.x * p
  const y = cardY.value * p
  const w = screenW.value + (cardW.value - screenW.value) * p
  const h = screenH.value + (cardH.value - screenH.value) * p
  return {
    width: w + 'px',
    height: h + 'px',
    transform: `translate3d(${x}px, ${y}px, 0) scale(${1 - (1 - slot.scale) * p})`,
    borderRadius: RADIUS * p + 'px',
    zIndex: 300
  }
})

/* 预览内容缩放：全屏时 scale=1（跟手卡），到卡位后 = 卡宽/屏宽（顶对齐裁底） */
function contentScale(isFollow) {
  if (isFollow) {
    const p = system.switcherProgress
    return (screenW.value + (cardW.value - screenW.value) * p) / screenW.value
  }
  return previewScale.value
}

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
    focusTo(idx, { initialVelocity: travel * 1.6 })
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
    focusTo(idx)
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
    borderRadius: RADIUS + 'px'
  }
}

/* 点卡片恢复：先从卡位弹到全屏，再正式切到 AppWindow（无缝衔接） */
const expanding = ref(null)
function resumeWithExpand(appId) {
  expanding.value = appId
  setTimeout(() => {
    system.resumeApp(appId)
    expanding.value = null
  }, 240)
}

function expandingStyle(i) {
  return {
    width: screenW.value + 'px',
    height: screenH.value + 'px',
    transform: 'translate3d(0px, 0px, 0) scale(1)',
    borderRadius: '0px',
    filter: 'brightness(1)',
    zIndex: 400
  }
}

/* 底部垃圾桶：清空最近任务回桌面 */
function clearAll() {
  system.dismissAll()
}
</script>

<template>
  <div
    v-if="visible"
    ref="rootRef"
    class="app-switcher"
    :class="{ 'is-dragging': !!drag, 'is-dismissing': !!dismissing || !!expanding }"
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
      :style="{ opacity: Math.min(1, system.switcherProgress * 1.5) }"
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
      :style="{ opacity: Math.min(1, system.switcherProgress * 1.5) }"
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
/* 非拖拽态开过渡（重排/移除/恢复动画），拖拽时关闭避免和手势打架 */
.app-switcher:not(.is-dragging) .switcher-card {
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
