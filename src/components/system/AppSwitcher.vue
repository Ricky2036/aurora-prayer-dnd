<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { getApp } from '../../config/apps'
import { appComponents } from '../apps/registry'
import PlaceholderApp from '../apps/PlaceholderApp.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useSystemStore } from '../../stores/systemStore'
import { useI18nStore } from '../../stores/i18nStore'
import { useSpring } from '../../composables/useSpring'

/**
 * iOS 风格最近任务切换器（App Switcher / Recent）：
 * - 卡片堆叠横向排列：实渲染应用界面（缩放到卡片尺寸），不是静态截图；
 * - 横滑浏览：跟手 + 弹簧吸附到最近卡片（快滑可跨多张）；
 * - 上滑卡片：移除该应用（FLIP 重排 + 弹簧回弹）；
 * - 点卡片：恢复应用；点空白/下滑/上滑手势原路返回：关闭切换器；
 * - 预览实例通过 provide('appPreview') 隔离：不注册返回处理器、不参与 hero 锚点。
 */

const system = useSystemStore()
const i18n = useI18nStore()

/* 预览实例隔离标记：backRegistry 看到它就不注册处理器 */
provide('appPreview', true)

const rootRef = ref(null)
const screenW = ref(0)
const screenH = ref(0)

/* 卡片尺寸：宽约 62% 屏宽、高约 72% 屏高（iOS 观感），相邻卡片露出边缘 */
const cardW = computed(() => Math.round(screenW.value * 0.62))
const cardH = computed(() => Math.round(screenH.value * 0.72))
const gap = computed(() => cardW.value + Math.round(screenW.value * 0.045))
const cardScale = computed(() => (screenW.value ? cardW.value / screenW.value : 1))

/* 滚动位移：单位 px，spring 驱动，target = index * gap */
const { value: scroll, animateTo, snapTo, velocity } = useSpring(0, 'ios-gentle')

const apps = computed(() => system.recentApps)
const activeIndex = computed(() => {
  const i = apps.value.indexOf(system.activeAppId)
  return i < 0 ? 0 : i
})
const maxScroll = computed(() => Math.max(0, (apps.value.length - 1) * gap.value))

function measure() {
  const el = rootRef.value?.parentElement
  if (!el) return
  screenW.value = el.offsetWidth
  screenH.value = el.offsetHeight
}

/* 打开时：滚到当前应用卡片；关闭时复位。
   注意必须在 nextTick 里 measure：根 div 是 v-if 渲染的，
   open 刚置 true 时 rootRef 还是 null，同步 measure 会量到 0 ——
   这会导致卡片宽度/gap 全为 0（踩过的坑）。 */
watch(
  () => system.appSwitcherOpen,
  (open) => {
    if (!open) return
    nextTick(() => {
      measure()
      const target = Math.min(activeIndex.value * gap.value, maxScroll.value)
      // 进场：从稍偏右的位置弹到目标，带一点速度感
      snapTo(target + gap.value * 0.25)
      animateTo(target, { initialVelocity: -1.2 })
    })
  },
  { immediate: true }
)

/* 卡片横向位置：translate3d 单属性，spring 数值变化时全部卡片一起平移 */
function cardStyle(i) {
  const x = i * gap.value - scroll.value + (screenW.value - cardW.value) / 2
  return {
    width: cardW.value + 'px',
    height: cardH.value + 'px',
    transform: `translate3d(${x}px, ${(screenH.value - cardH.value) / 2 + 18}px, 0)`
  }
}

/* ================= 手势：横滑浏览 / 上滑移除 / 下滑关闭 ================= */

const drag = ref(null) // { startX, startY, startScroll, mode: 'pending'|'h'|'v', dismissY }
const dismissing = ref(null) // 正在移除动画中的 appId
let rafPending = false

function onPointerDown(e) {
  if (dismissing.value) return
  drag.value = {
    startX: e.clientX,
    startY: e.clientY,
    startScroll: scroll.value,
    startT: performance.now(),
    mode: 'pending',
    dismissY: 0,
    travelX: 0,
    fastFlick: false
  }
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onPointerMove(e) {
  const d = drag.value
  if (!d) return
  const dx = e.clientX - d.startX
  const dy = e.clientY - d.startY

  if (d.mode === 'pending') {
    // 方向判定：横向为主 → 浏览；竖直向上 → 移除；竖直向下 → 关闭
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    if (Math.abs(dy) > Math.abs(dx) * 1.4) {
      d.mode = dy < 0 ? 'v' : 'down'
    } else {
      d.mode = 'h'
    }
  }

  if (d.mode === 'h') {
    // 跟手横滑，带橡皮筋（两端过拉衰减 0.4）
    let next = d.startScroll - dx
    if (next < 0) next *= 0.4
    if (next > maxScroll.value) next = maxScroll.value + (next - maxScroll.value) * 0.4
    snapTo(next)
    // 松手吸附用的「惯性页数」：记录累计横向位移（卡/单位），
    // 比逐帧瞬时速度稳定 —— 快速甩动时位移/时间双大，慢拖时双小
    d.travelX = -dx / gap.value
  } else if (d.mode === 'v') {
    // 上滑移除：卡片跟手上移（超出后衰减），水平方向小跟
    d.dismissY = Math.min(0, dy + Math.max(0, Math.abs(dx) - 20) * 0)
  }
}

function onPointerUp(e) {
  const d = drag.value
  if (!d) return
  drag.value = null
  const dy = e.clientY - d.startY
  // 快甩判定：300ms 内位移超过 60px
  d.fastFlick = performance.now() - d.startT < 300 && Math.abs(e.clientX - d.startX) > 60

  if (d.mode === 'h') {
    // 吸附基准 = 拖拽开始时所在页（不是松手时位置 —— 否则 round() 和
    // 惯性偏移会把一次快甩算成跨两页，踩过的坑）。
    // 位移超 1/3 卡或快速甩 → 相对起始页 ±1，否则弹回。
    const baseIdx = Math.round(d.startScroll / gap.value)
    const travel = d.travelX || 0
    let idx = baseIdx
    if (travel > 0.33 || (travel > 0.08 && d.fastFlick)) idx = baseIdx + 1
    else if (travel < -0.33 || (travel < -0.08 && d.fastFlick)) idx = baseIdx - 1
    idx = Math.max(0, Math.min(apps.value.length - 1, idx))
    animateTo(idx * gap.value, { initialVelocity: travel * 2 })
    return
  }
  if (d.mode === 'v') {
    const cardId = frontCardId(e)
    // 上滑超过 120px 或快速甩 → 移除
    if (cardId && (dy < -120 || d.dismissY < -120)) {
      dismissWithAnimation(cardId)
    }
    return
  }
  if (d.mode === 'down' && dy > 80) {
    system.closeSwitcher()
    return
  }
  // 短促点击（位移极小）：点卡片恢复，点空白关闭
  const dxAbs = Math.abs(e.clientX - d.startX)
  const dyAbs = Math.abs(e.clientY - d.startY)
  if (dxAbs < 8 && dyAbs < 8) {
    const cardId = frontCardId(e)
    if (cardId) system.resumeApp(cardId)
    else system.closeSwitcher()
  }
}

/** 指针命中的是哪张卡片（找最近的 .switcher-card） */
function frontCardId(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const card = el?.closest?.('.switcher-card')
  return card?.dataset?.appId || null
}

/** 上滑移除动画：先标记 dismissing 播离开动画，结束后从列表移除 */
function dismissWithAnimation(appId) {
  dismissing.value = appId
  setTimeout(() => {
    system.dismissApp(appId)
    dismissing.value = null
    // 重排后吸附到最近的合法卡片
    const idx = Math.max(0, Math.min(apps.value.length - 1, Math.round(scroll.value / gap.value)))
    animateTo(idx * gap.value)
  }, 260)
}

function dismissingStyle(i) {
  const x = i * gap.value - scroll.value + (screenW.value - cardW.value) / 2
  return {
    width: cardW.value + 'px',
    height: cardH.value + 'px',
    transform: `translate3d(${x}px, ${(screenH.value - cardH.value) / 2 + 18 - screenH.value * 1.2}px, 0)`,
    opacity: 0
  }
}

/* 预览组件解析 */
function compOf(id) {
  return appComponents[id] || PlaceholderApp
}
function appOf(id) {
  return getApp(id)
}
function nameOf(id) {
  return i18n.appName(id) || getApp(id)?.name || id
}

/* 键盘 ESC 关闭（调试友好） */
function onKey(e) {
  if (e.key === 'Escape') system.closeSwitcher()
}
onMounted(() => {
  measure()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    v-if="system.appSwitcherOpen"
    ref="rootRef"
    class="app-switcher"
    :class="{ 'is-dragging': !!drag, 'is-dismissing': !!dismissing }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <!-- 背景压暗（点击空白关闭） -->
    <div class="switcher-dim"></div>

    <!-- 卡片堆叠轨道 -->
    <div class="switcher-track">
      <div
        v-for="(id, i) in apps"
        :key="id"
        class="switcher-card"
        :data-app-id="id"
        :style="id === dismissing ? dismissingStyle(i) : cardStyle(i)"
      >
        <!-- 卡片标题：图标 + 应用名（iOS 在卡片上方） -->
        <div class="switcher-card-label">
          <AppIcon :app="appOf(id)" :size="20" :show-label="false" />
          <span>{{ nameOf(id) }}</span>
        </div>
        <!-- 实渲染预览：内部按真实屏宽渲染，再整体缩放，禁交互 -->
        <div class="switcher-card-body">
          <div
            class="switcher-card-content"
            :style="{
              width: screenW + 'px',
              height: screenH + 'px',
              transform: `scale(${cardScale})`
            }"
          >
            <component :is="compOf(id)" :app="appOf(id)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-switcher {
  position: absolute;
  inset: 0;
  z-index: 95; /* 高于应用窗口与状态栏，低于 Home 手势条（96），保证底部手势可用 */
  touch-action: none;
  user-select: none;
  overflow: hidden;
}

.switcher-dim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  animation: switcher-dim-in 0.22s ease-out;
}
@keyframes switcher-dim-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.switcher-track {
  position: absolute;
  inset: 0;
}

.switcher-card {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 22px;
  overflow: visible; /* label 在卡片上方外侧 */
  transition: none;
  will-change: transform;
}
/* 非拖拽态才开 transform 过渡（重排动画），拖拽时关闭避免和手势打架 */
.app-switcher:not(.is-dragging) .switcher-card {
  transition: transform 0.26s cubic-bezier(0.25, 1, 0.4, 1), opacity 0.22s ease;
}

.switcher-card-label {
  position: absolute;
  top: -30px;
  left: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.92);
  font: 500 12px/1 var(--font-stack);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}
.switcher-card-label span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.switcher-card-body {
  position: absolute;
  inset: 0;
  border-radius: 22px;
  overflow: hidden;
  background: #000;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38);
}

.switcher-card-content {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  pointer-events: none; /* 预览只看不摸 */
  background: var(--bg-grouped, #f2f2f7);
}
</style>
