<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useControlStore } from '../../stores/controlStore'
import { useSystemStore } from '../../stores/systemStore'
import { useSpring } from '../../composables/useSpring'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { screenRef } from '../../utils/screenRef'
import StatusBar from './StatusBar.vue'
import HomeIndicator from './HomeIndicator.vue'
import DynamicIsland from '../system/DynamicIsland.vue'
import LockScreen from '../system/LockScreen.vue'
import HomeScreen from '../system/HomeScreen.vue'
import AppWindow from '../system/AppWindow.vue'
import NotificationCenter from '../system/NotificationCenter.vue'
import ControlCenter from '../system/ControlCenter.vue'
import AppLibrary from '../system/AppLibrary.vue'
import { registerDriver } from '../../composables/driverRegistry'
import { runBackHandler } from '../../composables/backRegistry'
import wallpaper from '../../assets/img/wallpaper-lock.jpg'

/**
 * 屏幕容器（OS 合成器）：
 * 壁纸（锁屏/桌面统一使用 notificationscreen.tsx 同款）/ 桌面 / 应用窗口 / 通知中心 / 控制中心 / 锁屏 / 系统 chrome / 边缘手势热区。
 */
const control = useControlStore()
const system = useSystemStore()
const heroVisual = ref(null)

const rootEl = ref(null)
onMounted(() => {
  screenRef.el = rootEl.value
})

/** 亮度滤镜：控制中心亮度滑块真实压暗屏幕 */
const dimOpacity = computed(() => (1 - control.brightness) * 0.72)

const heroBackdropStrength = computed(() => Math.min(
  1,
  Math.max(0, heroVisual.value?.backdropStrength || 0)
))
const heroBackdropStyle = computed(() => {
  const strength = heroBackdropStrength.value
  return {
    backgroundColor: `rgba(0, 0, 0, ${strength * 0.08})`,
    backdropFilter: `blur(${strength * 12}px) saturate(${100 - strength * 8}%)`,
    WebkitBackdropFilter: `blur(${strength * 12}px) saturate(${100 - strength * 8}%)`
  }
})

function onHeroFrame(nextFrame) {
  heroVisual.value = nextFrame
}

/** 应用打开时桌面不响应手势 */
const homeInteractive = computed(() => system.baseLayer !== 'app')

/** 状态栏/Home 条配色：浅色背景应用内切换为深色（相机等深色应用除外） */
const DARK_BG_APPS = ['camera']
const chromeLight = computed(() => {
  if (system.baseLayer === 'app') return DARK_BG_APPS.includes(system.activeAppId)
  return true
})

/* ================= 叠层手势驱动（NC / CC） ================= */

const GESTURE_SPAN = 620

/**
 * 为一个叠层创建 spring + 进度同步 + closing 动画监听。
 * 手势进行中 progress 由 onProgress 直写（status=dragging）；
 * 松手后 spring 推进（status=settling/closing），到位后 settle。
 */
function useOverlayDriver(name, { axis = 'y', direction = 1, span = GESTURE_SPAN, canStartExtra = null } = {}) {
  const { value, animateTo, snapTo } = useSpring(0, 'ios-gentle')
  let lastDragEnd = 0 // 拖拽结束后抑制紧随的 click，防误关

  // spring 推进 → store（拖拽中不覆盖，拖拽由 onProgress 直写）
  watch(value, (v) => {
    if (system.overlays[name].status !== 'dragging') {
      system.updateSettleProgress(name, v)
    }
  })

  // 外部请求关闭（点空白/点热区/Home 条）→ 播收起动画
  watch(
    () => system.overlays[name].status,
    (status) => {
      if (status === 'closing') {
        animateTo(0, {
          onDone: () => system.settleOverlay(name, false)
        })
      }
    }
  )

  /** 手势配置（供 useSwipeGesture） */
  const gesture = {
    axis,
    direction,
    span,
    threshold: 5,
    canStart: () => {
      if (canStartExtra && !canStartExtra()) return false
      const self = system.overlays[name]
      if (self.status === 'open') return false // 已打开时不重新拖拽
      if (name === 'notificationCenter' || name === 'controlCenter') {
        const other = system.overlays[name === 'notificationCenter' ? 'controlCenter' : 'notificationCenter']
        return other.status === 'closed' || other.status === 'closing'
      }
      return true
    },
    onStart: () => snapTo(system.overlays[name].progress),
    onProgress: (p) => {
      system.setOverlayProgress(name, p)
      snapTo(p)
    },
    onRelease: (p, velocity) => {
      lastDragEnd = Date.now()
      const open = p > 0.3 || velocity > 0.45
      system.beginSettle(name, p)
      animateTo(open ? 1 : 0, {
        initialVelocity: velocity,
        onDone: () => system.settleOverlay(name, open)
      })
      return open ? 1 : 0
    }
  }

  /** 面板打开后的「反向滑关闭」手势（挂在叠层根元素上，如 NC 上滑收起） */
  const closeGesture = {
    axis,
    direction: -direction,
    span,
    threshold: 5,
    canStart: () => system.overlays[name].status === 'open',
    onStart: () => snapTo(system.overlays[name].progress),
    onProgress: (p) => {
      const next = 1 - p
      system.setOverlayProgress(name, next)
      snapTo(next)
    },
    onRelease: (p, velocity) => {
      lastDragEnd = Date.now()
      const close = p > 0.24 || velocity > 0.5
      const next = 1 - p
      system.beginSettle(name, next)
      animateTo(close ? 0 : 1, {
        initialVelocity: -velocity,
        onDone: () => system.settleOverlay(name, !close)
      })
      return close ? 1 : 0
    }
  }

  /** 点击热区降级：关⇄开（拖拽后 350ms 内的 click 忽略） */
  function toggle() {
    if (Date.now() - lastDragEnd < 350) return
    const status = system.overlays[name].status
    if (status === 'closed') {
      snapTo(0)
      system.beginSettle(name, 0)
      animateTo(1, { onDone: () => system.settleOverlay(name, true) })
    } else if (status === 'open') {
      system.requestCloseOverlay(name)
    }
  }

  return { gesture, closeGesture, toggle, snapTo, animateTo }
}

const ncStripRef = ref(null)
const ccStripRef = ref(null)
const ncDriver = useOverlayDriver('notificationCenter')
const ccDriver = useOverlayDriver('controlCenter')
registerDriver('notificationCenter', ncDriver)
registerDriver('controlCenter', ccDriver)

/* 应用抽屉驱动：桌面左滑越界打开（轴 x，span 偏小更跟手） */
const libDriver = useOverlayDriver('appLibrary', {
  axis: 'x',
  direction: -1,
  span: 340,
  canStartExtra: () => system.baseLayer === 'home'
})
registerDriver('appLibrary', libDriver)

useSwipeGesture(ncStripRef, ncDriver.gesture)
useSwipeGesture(ccStripRef, ccDriver.gesture)

/* ================= 全局侧滑返回（左缘右滑） ================= */

const sideEdgeRef = ref(null)
const SIDE_SPAN = 240

const { value: sideVal, animateTo: sideAnimate, snapTo: sideSnap } = useSpring(0, 'ios-snappy')
// 侧滑与底部上滑共用同一进度通道：AppWindow 缩放预览无需关心来源
watch(sideVal, (v) => system.setHomeGestureProgress(v))

useSwipeGesture(sideEdgeRef, {
  axis: 'x',
  direction: 1, // 右滑
  span: SIDE_SPAN,
  threshold: 6,
  canStart: () => system.baseLayer === 'app' || system.anyOverlayOpen(),
  onStart() {
    sideSnap(system.homeGestureProgress)
  },
  onProgress(p) {
    sideSnap(p)
  },
  onRelease(p, velocity) {
    const trigger = p > 0.22 || velocity > 0.45
    if (trigger) {
      // 叠层打开 → 右滑直接收起叠层
      if (system.anyOverlayOpen()) {
        system.setHomeGestureProgress(0)
        sideSnap(0)
        for (const key of ['appLibrary', 'notificationCenter', 'controlCenter']) {
          if (system.overlays[key].status !== 'closed') system.requestCloseOverlay(key)
        }
        return 1
      }
      // 应用内消费（如关闭信息对话页）：进度弹回，不回桌面
      if (runBackHandler()) {
        sideAnimate(0, { initialVelocity: velocity })
        return 0
      }
      // 保留当前进度，供 AppWindow 将预览帧作为关闭动画起点。
      system.goHome()
      return 1
    }
    sideAnimate(0, { initialVelocity: velocity })
    return 0
  }
})
</script>

<template>
  <div ref="rootEl" class="screen-view">
    <!-- 桌面/锁屏统一壁纸（notificationscreen.tsx 同款，本地化） -->
    <div class="wallpaper" :style="{ backgroundImage: `url(${wallpaper})` }"></div>

    <!-- 桌面（lock 层时也常驻，支撑解锁入场动效） -->
    <div class="home-layer" :style="{ pointerEvents: homeInteractive ? 'auto' : 'none' }">
      <HomeScreen @open-library="libDriver.toggle()" />
    </div>

    <!-- 只在 Hero 过渡期间存在：不变换桌面布局，因此不会污染实时锚点。 -->
    <div
      v-show="heroBackdropStrength > 0"
      class="hero-desktop-backdrop"
      :class="{ 'is-active': heroBackdropStrength > 0 }"
      :style="heroBackdropStyle"
    ></div>

    <!-- 打开中的应用窗口 -->
    <AppWindow
      v-if="system.activeAppId"
      :key="system.activeAppId"
      :app-id="system.activeAppId"
      @hero-frame="onHeroFrame"
    />

    <!-- 锁屏（lock 基础层时挂载） -->
    <LockScreen v-if="system.baseLayer === 'lock'" />

    <!-- 系统叠层 -->
    <NotificationCenter />
    <ControlCenter />
    <AppLibrary />

    <!-- 顶部边缘手势热区：左/中 = 通知中心，右 1/4 = 控制中心 -->
    <div ref="ncStripRef" class="edge-zone edge-nc" @click="ncDriver.toggle"></div>
    <div ref="ccStripRef" class="edge-zone edge-cc" @click="ccDriver.toggle"></div>

    <!-- 左侧边缘手势热区：应用内右滑返回（上级页或桌面） -->
    <div ref="sideEdgeRef" class="side-edge"></div>

    <!-- 亮度滤镜（永远最上，不拦截事件） -->
    <div class="brightness-filter" :style="{ opacity: dimOpacity }"></div>

    <!-- 灭屏黑幕（控制台模拟关屏，阻断一切交互） -->
    <div v-if="!system.screenOn" class="screen-off"></div>

    <DynamicIsland v-if="!system.anyOverlayOpen() && system.baseLayer !== 'lock'" />
    <StatusBar v-if="!system.anyOverlayOpen()" :light="chromeLight" />
    <HomeIndicator v-if="!system.anyOverlayOpen()" :dark="!chromeLight" />
  </div>
</template>

<style scoped>
.screen-view {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: var(--screen-radius);
}

.home-layer {
  position: absolute;
  inset: 0;
  z-index: var(--z-home);
}

.hero-desktop-backdrop {
  position: absolute;
  inset: 0;
  z-index: var(--z-hero-backdrop);
  pointer-events: none;
}
.hero-desktop-backdrop.is-active {
  will-change: backdrop-filter, background-color;
}
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .hero-desktop-backdrop {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
}

/* 壁纸铺满屏幕（桌面与锁屏同款图片壁纸） */
.wallpaper {
  position: absolute;
  inset: 0;
  z-index: 1;
  background-size: cover;
  background-position: center;
  /* 轻微暗化，让桌面图标/文字更清晰 */
}
.wallpaper::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.12);
}

.edge-zone {
  position: absolute;
  top: 0;
  height: 64px; /* 覆盖状态栏全区，提升下拉可触发性 */
  z-index: var(--z-edge-zone);
  touch-action: none;
}
.edge-nc {
  left: 0;
  right: 26%;
}
.edge-cc {
  right: 0;
  width: 26%;
}

/* 左侧边缘返回热区：窄条全高，不遮挡内容交互 */
.side-edge {
  position: absolute;
  left: 0;
  top: 64px;
  bottom: 80px;
  width: 22px;
  z-index: var(--z-side-edge);
  touch-action: none;
}

.brightness-filter {
  position: absolute;
  inset: 0;
  background: #000;
  pointer-events: none;
  z-index: var(--z-brightness-filter);
  transition: opacity 0.12s linear;
}

/* 灭屏黑幕：盖住整块屏幕（含状态栏/Home 条），阻断所有指针事件 */
.screen-off {
  position: absolute;
  inset: 0;
  background: #000;
  z-index: 120;
  cursor: default;
}
</style>
