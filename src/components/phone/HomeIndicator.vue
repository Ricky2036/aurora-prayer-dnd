<script setup>
import { computed, ref, watch } from 'vue'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { useSpring } from '../../composables/useSpring'
import { useSystemStore } from '../../stores/systemStore'

/**
 * 底部 Home Indicator 手势条：
 * - 点击 = 直接返回桌面 / 解锁 / 收起叠层（点击降级，照顾不会拖拽的评审人）
 * - 上滑 = 跟手缩放预览，松手按速度/进度判定返回或回弹
 * 场景优先级：应用抽屉打开 → 收起抽屉；NC/CC 打开 → 收起对应叠层；
 * 锁屏 → 解锁进桌面；应用内 → 回桌面。
 * 热区比视觉条大（透明延伸区），保证好触发；拖拽后 350ms 内抑制 click。
 */
const props = defineProps({
  dark: { type: Boolean, default: false }
})

const system = useSystemStore()
const rootRef = ref(null)
const GESTURE_SPAN = 260 // 更小的满量程 → 同样位移给出更大进度，更跟手

const { value: springVal, animateTo, snapTo } = useSpring(0, 'ios-snappy')
watch(springVal, (v) => system.setHomeGestureProgress(v))

/** 当前应该执行的「回退/前进」动作 */
function doAction() {
  // 切换器打开时：点击手势条 = 关闭切换器（回到之前所在层）
  if (system.appSwitcherOpen) {
    system.closeSwitcher()
    return
  }
  const o = system.overlays
  if (o.appLibrary.status !== 'closed') {
    system.requestCloseOverlay('appLibrary')
    return
  }
  if (o.notificationCenter.status !== 'closed') {
    system.requestCloseOverlay('notificationCenter')
    return
  }
  if (o.controlCenter.status !== 'closed') {
    system.requestCloseOverlay('controlCenter')
    return
  }
  if (system.baseLayer === 'lock') {
    system.unlock()
    return
  }
  if (system.baseLayer === 'app') {
    system.goHome()
  }
}

/* 悬停计时器：上滑超过 5% 后【手指停住】→ 激活切换器。
 *
 * 历史问题（Ricky 2026-09-12）：旧实现每次 pointermove 都 clearTimeout 重计 0.2s，
 * 而真实触摸屏上手指永远有 1~2px 微抖 → 计时器几乎永远凑不满 0.2s →
 * 「停留很久也进不了 Recent」，激活手感极差。
 * 两处修正：
 *   ① 4px 容差：位移变化 <4px 视为「停住」，【不重置】计时，让时间继续累积；
 *   ② 时长 200ms → 120ms（iOS 观感：稍作停顿即进入）。
 *
 * 拖动全程把进度写给 switcherProgress（跟手缩放连续，滑得越远缩得越小），
 * hero 预览在这条路径不启动（避免双重渲染）。 */
const DWELL_MS = 120
const DWELL_SLOP = 4 // 手指微抖容差（px）
let dwellArm = null
let dwellAnchor = 0

function clearDwellArm() {
  if (dwellArm) { clearTimeout(dwellArm); dwellArm = null }
  dwellAnchor = 0
}

const gesture = useSwipeGesture(rootRef, {
  axis: 'y',
  direction: -1,
  span: GESTURE_SPAN,
  threshold: 5,
  canStart: () =>
    system.baseLayer === 'app' ||
    system.baseLayer === 'lock' ||
    system.appSwitcherOpen ||
    system.anyOverlayOpen() ||
    // 桌面上也允许：有最近任务时，上滑停驻 = 打开切换器（iOS 同样支持）
    (system.baseLayer === 'home' && system.recentApps.length > 0),
  onStart() {
    snapTo(system.homeGestureProgress)
    clearDwellArm()
    // 每次手势开始都重置悬停标记：上一次手势（尤其是从切换器恢复应用那条路径）
    // 可能把它留成 true，否则这一次轻微上滑会被误判为「已悬停」而直接打开切换器。
    system.switcherDwell = false
  },
  onProgress(p, d) {
    const switcherCandidate =
      system.recentApps.length > 0 &&
      system.baseLayer !== 'lock' &&
      !system.anyOverlayOpen() &&
      !system.appSwitcherOpen // 切换器已打开时不再驱动跟手进度（否则会在堆叠上再叠跟手卡）
    if (switcherCandidate) {
      /* 跟手缩放：进度直接用【原始位移】除以满量程，而不是 useSwipeGesture 传来的
         已截断到 0..1 的 p —— 这样越过满量程（GESTURE_SPAN）之后手指继续上滑，
         卡片还会继续无极变小（Ricky 2026-09-12：上滑越远缩得越小，但不许缩到不见）。
         d 本身带橡皮筋（越界后增速放缓），所以不会失控。 */
      const raw = typeof d === 'number' ? d : p * GESTURE_SPAN
      system.setSwitcherProgress(Math.max(0, raw / GESTURE_SPAN))
      /* 「停住」判定：只有位移变化超过 4px 才重新计时（微抖不算动），
         否则保持计时继续累积 —— 这是「停留一小会儿就能进 Recent」的关键。 */
      if (p >= 0.05 && !system.switcherDwell) {
        if (dwellArm === null || Math.abs(raw - dwellAnchor) > DWELL_SLOP) {
          clearDwellArm()
          dwellAnchor = raw
          dwellArm = setTimeout(() => {
            dwellArm = null
            system.switcherDwell = true
          }, DWELL_MS)
        }
      } else if (p < 0.05) {
        // 上滑量不足 → 撤销待激活状态，避免浅滑也被判成停驻
        clearDwellArm()
      }
    } else {
      snapTo(p) // 无最近任务：保持原 hero 预览
    }
  },
  onRelease(p, velocity) {
    clearDwellArm()
    /* 激活条件（Ricky 2026-09-12 放宽）：
     *   上滑 >5% 且停住 ≥120ms（switcherDwell 已由计时器置位）→ 打开切换器。
     *   速度门槛 0.4 → 0.8（≈208px/s）：带一点点余速的「上滑—停一下」也应当激活，
     *   但真正的快甩（无停顿，dwell 计时器根本来不及触发）依旧走回桌面，与 iOS 一致。 */
    const canDwellOpen =
      system.switcherDwell &&
      Math.abs(velocity) <= 0.8 &&
      system.recentApps.length > 0 &&
      !system.anyOverlayOpen() &&
      system.baseLayer !== 'lock'

    if (canDwellOpen) {
      system.openSwitcher()
      return 0
    }

    // 未激活：跟手进度归零，走原逻辑（回桌面 / 回弹）
    system.setSwitcherProgress(0)

    if (system.baseLayer === 'home') {
      animateTo(0, { initialVelocity: velocity })
      return 0
    }

    const goHome = p > 0.16 || velocity > 0.4
    if (goHome) {
      // AppWindow 必须先捕获当前跟手矩形；动画接管后再清空进度。
      doAction()
    } else {
      animateTo(0, { initialVelocity: velocity })
    }
    return goHome ? 1 : 0
  }
})

/* 深色（浅色背景上，如白色设置页）与浅色（深色背景，如桌面壁纸）两个态都降到约 30%：
   Ricky 2026-09-09 —— 原本 0.85 / 0.88 太实，深色在白色界面上是一条纯黑，
   浅色在深色壁纸上又过白，统一压到 30% 更贴合系统观感。 */
const bg = computed(() => (props.dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'))

function onTap() {
  // 拖拽松手后浏览器会补发 click，350ms 内忽略防误回桌面
  if (Date.now() - gesture.lastDragEndAt() < 350) return
  doAction()
}
</script>

<template>
  <div ref="rootRef" class="home-indicator" @click="onTap">
    <div class="bar" :style="{ background: bg }"></div>
  </div>
</template>

<style scoped>
.home-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  /* 热区高于视觉条：向上透明延伸，提升可触发性 */
  height: var(--home-indicator-zone);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 9px;
  z-index: var(--z-home-indicator);
  cursor: pointer;
  touch-action: none;
}
.bar {
  width: 134px;
  height: 5px;
  border-radius: 2.5px;
  transition: transform 0.15s ease;
  pointer-events: none;
}
.home-indicator:active .bar { transform: scaleX(0.92); }
</style>
