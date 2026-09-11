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

/* ---- 几何常量（2026-09-11 三轮，Ricky 纠正） ----
 *   卡片      宽 = 高 = 屏幕 × 0.64（与屏幕同比例，预览零裁切；
 *             不能太大——底部垃圾桶+计数必须完整露出，不重叠）
 *   顶距      屏高 × 0.09；卡片底缘 ≈ 73% 屏高，底栏在下方互不遮挡
 *   堆叠在【右侧】：前卡（焦点）最前最高 z 全亮，更早的卡向右后方逐层堆叠
 *   后卡      亮度 × 0.78 递减，尺寸不变 */
const cardW = computed(() => Math.round(screenW.value * 0.64))
const cardH = computed(() => Math.round(screenH.value * 0.64))
const cardY = computed(() => Math.round(screenH.value * 0.09))
const PILE_FRAC = 0.125           // 堆叠每层位移（屏宽分数）
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

/* 邻居进场（2026-09-11 三轮 Ricky 定）：
   - 手势路径：悬停 0.2s（store.switcherDwell 置位）就进场——不能等松手；
   - 桌面路径：下一帧即进场（卡片自下方 30% 上浮）。
   entranceDone 之后 stagger 清零，否则浏览/吸附时后面的卡会一直带 60ms 延迟。 */
const neighborsIn = ref(false)
const entranceDone = ref(false)
let dwellTimer = null
let settleTimer = null

function markEntrance() {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => { entranceDone.value = true }, apps.value.length * 60 + 320)
}

/* 悬停达成 → 邻居立即进场（手势进行中，松手前） */
watch(
  () => system.switcherDwell,
  (dwell) => {
    if (dwell && !neighborsIn.value) {
      neighborsIn.value = true
      markEntrance()
    }
  }
)

watch(
  () => system.appSwitcherOpen,
  (open) => {
    clearTimeout(dwellTimer)
    if (!open) { neighborsIn.value = false; entranceDone.value = false; return }
    nextTick(() => {
      measure()
      focusSnap(frontIndex.value)
      homePath.value = !system.activeAppId
      hasFollow.value = !!system.activeAppId && system.switcherProgress < 1
      if (homePath.value) {
        // 桌面直开：无前台应用可缩放，进度直接到 1；
        // 卡片下一帧才进场（先停在下方 30% 处，靠 transition 逐张上浮，参考视频入场）
        system.setSwitcherProgress(1)
        openSnap(1)
        dwellTimer = setTimeout(() => { neighborsIn.value = true; markEntrance() }, 60)
      } else if (system.switcherProgress < 1) {
        // 手势路径：跟手卡从当前进度连续推到 1；邻居由 switcherDwell 触发（悬停 0.2s）
        openSnap(system.switcherProgress)
        openTo(1)
        // 悬停可能已在松手前达成过（dwell 已进场）；否则 300ms 兜底（store 直开等无手势场景）
        if (system.switcherDwell && !neighborsIn.value) { neighborsIn.value = true; markEntrance() }
        dwellTimer = setTimeout(() => {
          if (!neighborsIn.value) { neighborsIn.value = true; markEntrance() }
        }, 300)
      } else {
        openSnap(1)
        if (!neighborsIn.value) { neighborsIn.value = true; markEntrance() }
        entranceDone.value = true
      }
    })
  },
  { immediate: true }
)

/* ---- 前卡槽位（2026-09-11 四轮，Ricky 纠正：当前卡在最右侧） ----
        焦点 0（列表首）→ 当前/最近卡左缘 31%（右缘 95%，最右侧）；
        焦点 ≥1（浏览）  → 前卡左缘 23.5%，左右各留 ~12.5% 露出（对称）。 */
const frontX = computed(() => screenW.value * (0.31 - Math.min(Math.max(focus.value, 0), 1) * 0.075))

/* ---- 卡片位姿：o = i - focus。
        o≥0（比焦点更早）：向左堆叠，每层左移 12.5% 屏宽、亮度递减；
        o<0（比焦点更新）：向右滑出，只留 ~12.5% 露出。
        尺寸不变，差异在亮度与 z。 ---- */
function pose(i) {
  const o = i - focus.value
  const ao = Math.abs(o)
  const x =
    o >= 0
      ? frontX.value - o * screenW.value * PILE_FRAC // 后卡向左堆叠
      : frontX.value - o * screenW.value * (0.64 - PILE_FRAC) // 新卡向右滑出留露出
  const scale = 1
  const bright = 1 - 0.22 * Math.min(ao, 1.5)
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
     邻居悬停 0.2s（switcherDwell）即进场，未进场时藏在槽位右侧 26% 屏宽处且透明。
   - 桌面路径：所有卡藏在下方 30% 屏高处且透明，下一帧逐张（i×60ms）上浮进场。
   hasFollow 在打开瞬间捕获（是否有跟手卡参与交接），不能靠 activeAppId 现场算——
   手势路径里 goHome 完成会把 activeAppId 清空，现场算会让前卡掉到邻居分支被误藏。 */
const homePath = ref(false)
const hasFollow = ref(false)
function stackStyle(i) {
  const p = pose(i)
  let x = p.x
  let y = cardY.value
  let opacity = 1
  let delay = '0ms'
  if (i === frontIndex.value && hasFollow.value) {
    opacity = settledOne.value ? 1 : 0
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

/* ---- 跟手缩放（2026-09-11 四轮，Ricky 纠正）：
        ① 锚点是【屏幕中心】——缩放围绕中心进行，不是左上角；
        ② 进度可过拉到 1.35：到最终大小后继续拖，卡片继续缩小并变透明，
           松手弹簧回到 1（最终大小）。
        进度 1 时恰好落到前卡槽位（与堆叠卡同位姿，无缝交接）。 ---- */
const settledOne = computed(
  () => openP.value >= 0.999 && system.switcherProgress >= 0.999 && system.switcherProgress <= 1.001
)
const followStyle = computed(() => {
  const p = system.switcherProgress
  if (p <= 0 || settledOne.value) return null
  const idx = frontIndex.value
  const slot = pose(idx)
  // 槽位中心（p=1 时卡位中心）；p=0 时屏幕中心，随 p 连续过渡
  const slotCx = slot.x + cardW.value / 2
  const slotCy = cardY.value + cardH.value / 2
  const cx = screenW.value / 2 + (slotCx - screenW.value / 2) * Math.min(1, p)
  const cy = screenH.value / 2 + (slotCy - screenH.value / 2) * Math.min(1, p)
  const s = 1 + (previewScale.value - 1) * p // p=1 → 0.64；过拉继续变小
  const over = Math.max(0, p - 1)
  const opacity = 1 - Math.min(1, over / 0.35) // 过拉变透明，1.35 时全透明
  return {
    width: screenW.value + 'px',
    height: screenH.value + 'px',
    transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${s})`,
    borderRadius: (RADIUS * Math.min(1, p)) / Math.max(s, 0.01) + 'px', // 缩放空间补偿，视觉恒为 24*p
    opacity,
    zIndex: 300
  }
})

/* 预览内容缩放：跟手卡的外层 transform 已经负责缩放，内容恒为 1；
   堆叠卡 = 卡宽/屏宽（与屏幕同比例缩放，零裁切） */
function contentScale(isFollow) {
  return isFollow ? 1 : previewScale.value
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
