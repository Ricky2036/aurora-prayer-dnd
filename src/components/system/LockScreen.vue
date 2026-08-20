<script setup>
import { computed, ref } from 'vue'
import { useClock } from '../../composables/useClock'
import { useSpring } from '../../composables/useSpring'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { useSystemStore } from '../../stores/systemStore'
import { useNotificationsStore } from '../../stores/notificationsStore'
import NotificationIcon from '../ui/NotificationIcon.vue'
import { formatRelativeTime } from '../../utils/timeFormat'
import { clamp } from '../../utils/math'
import wallpaper from '../../assets/img/wallpaper-lock.jpg'
import albumArt from '../../assets/img/album-2.jpg'

/**
 * 锁屏（移植自 notificationscreen.tsx）：
 * 壁纸 + 日期 + 巨大时钟（滚动挤压）+ 音乐播放器卡片 + 通知队列阻尼堆叠
 * + 微缩通知胶囊（折叠态）+ 底部手电筒/相机快捷按钮。
 * 折叠态：时钟全高、播放器低位、微缩胶囊；点击胶囊 / 上滑交互区 → 展开。
 * 展开态：时钟挤压、播放器上移、通知队列可滚动（滚轮/触摸），滚到顶再下拉 → 收起。
 * 上滑解锁：非交互区上滑触发（与展开手势隔离）。
 */
import MusicPlayerCard from './MusicPlayerCard.vue'

const { timeShort, dateLong } = useClock()
const system = useSystemStore()
const notifications = useNotificationsStore()

const rootRef = ref(null)
const UNLOCK_SPAN = 460

/* ---------- notificationscreen.tsx 布局常量 ---------- */
const BASE_Y = 590
const PLAYER_HEIGHT = 164
const NOTIF_SPACING = 98
const PLAYER_NOTIF_GAP = 8
const PLAYER_START_Y = BASE_Y - PLAYER_HEIGHT - PLAYER_NOTIF_GAP // 418
const PLAYER_COLLAPSED_Y = 575
const DATE_TOP = 55
const DATE_HEIGHT = 28
const CLOCK_TOP = DATE_TOP + DATE_HEIGHT - 6 // 77
const TOP_GAP = 16
const CLOCK_INITIAL_HEIGHT = PLAYER_START_Y - CLOCK_TOP - TOP_GAP // 325
const CLOCK_MIN_HEIGHT = 140
const SAFE_GAP = TOP_GAP
const HIT_DISTANCE = Math.max(0, PLAYER_START_Y - (CLOCK_TOP + CLOCK_INITIAL_HEIGHT) - SAFE_GAP)
const EXPAND_SCROLL_Y = CLOCK_INITIAL_HEIGHT - CLOCK_MIN_HEIGHT // 185
const STRETCH_FACTOR = 0.15
const COLLAPSE_THRESHOLD = -26

/* 锁屏只展示最新 6 条（与 TSX 一致），通知中心展示全部 */
const lockNotifs = computed(() => notifications.list.slice(0, 6))
const MAX_SCROLL = computed(() => Math.max(0, (lockNotifs.value.length - 1) * NOTIF_SPACING))

/* ---------- 滚动状态 ---------- */
const scrollY = ref(0)
const isCollapsed = ref(true)
const isDragging = ref(false)
const isWheeling = ref(false)
const isSpringing = ref(false)
let touchStartY = 0
let dragDistance = 0
let wheelTimeout = null
let boundsLoopId = null

function startBoundsLoop() {
  if (boundsLoopId) return
  isSpringing.value = true
  const loop = () => {
    if (isDragging.value) {
      boundsLoopId = requestAnimationFrame(loop)
      return
    }
    const target = clamp(scrollY.value, 0, MAX_SCROLL.value)
    const diff = target - scrollY.value
    if (Math.abs(diff) > 0.5) {
      scrollY.value += diff * 0.15
      boundsLoopId = requestAnimationFrame(loop)
    } else {
      scrollY.value = target
      isSpringing.value = false
      boundsLoopId = null
    }
  }
  boundsLoopId = requestAnimationFrame(loop)
}

function move(deltaY) {
  let next = scrollY.value + deltaY
  if (next > MAX_SCROLL.value) {
    next = scrollY.value > MAX_SCROLL.value
      ? scrollY.value + deltaY * 0.12
      : MAX_SCROLL.value + (next - MAX_SCROLL.value) * 0.12
  }
  if (next < 0) {
    next = scrollY.value < 0 ? scrollY.value + deltaY * 0.12 : next * 0.12
  }
  let triggered = false
  if (!isCollapsed.value && next <= COLLAPSE_THRESHOLD) {
    isCollapsed.value = true
    scrollY.value = 0
    triggered = true
  } else if (isCollapsed.value && next >= 20) {
    isCollapsed.value = false
    scrollY.value = 0
    triggered = true
  } else {
    scrollY.value = next
  }
  return triggered
}

function handleWheel(e) {
  isWheeling.value = true
  const triggered = move(e.deltaY * 0.8)
  if (triggered) { isWheeling.value = false; return }
  
  if (scrollY.value > MAX_SCROLL.value || scrollY.value < 0) {
    startBoundsLoop()
  }

  if (wheelTimeout) clearTimeout(wheelTimeout)
  wheelTimeout = setTimeout(() => {
    isWheeling.value = false
  }, 150)
}

function handleTouchStart(e) {
  touchStartY = e.touches[0].clientY
  dragDistance = 0
  isDragging.value = true
}
function handleTouchMove(e) {
  if (!isDragging.value) return
  const currentY = e.touches[0].clientY
  dragDistance = Math.abs(currentY - touchStartY)
  const deltaY = (touchStartY - currentY) * 1.5
  const triggered = move(deltaY)
  if (triggered) { isDragging.value = false; touchStartY = 0 }
  else touchStartY = currentY
}
function handleTouchEnd() {
  isDragging.value = false
  if (scrollY.value > MAX_SCROLL.value || scrollY.value < 0) {
    startBoundsLoop()
  } else {
    scrollY.value = clamp(scrollY.value, 0, MAX_SCROLL.value)
  }
  touchStartY = 0
}

/* 点击播放器/通知/胶囊：折叠→展开；已展开且未滚远→滚到挤压位 */
function handleExpand() {
  if (dragDistance > 10) return
  if (isCollapsed.value) {
    isCollapsed.value = false
    scrollY.value = 0
  } else if (scrollY.value < EXPAND_SCROLL_Y) {
    scrollY.value = EXPAND_SCROLL_Y
  }
}

/* ---------- 解锁手势（非交互区上滑） ---------- */
const { value: progress, animateTo, snapTo } = useSpring(0, 'ios-gentle')
let unlocked = false

useSwipeGesture(rootRef, {
  axis: 'y',
  direction: -1,
  span: UNLOCK_SPAN,
  canStart(e) {
    // 交互区（播放器/通知/胶囊）的上滑留给展开与滚动逻辑
    if (e.target?.closest?.('.ls-interact')) return false
    return true
  },
  onStart() { snapTo(progress.value) },
  onProgress(p) {
    snapTo(p)
    system.setUnlockProgress(p)
  },
  onRelease(p, velocity) {
    const complete = p > 0.32 || velocity > 0.55
    animateTo(complete ? 1 : 0, {
      initialVelocity: velocity * 1.2,
      onDone() {
        if (complete) {
          unlocked = true
          system.setUnlockProgress(0)
          system.unlock()
        } else {
          system.setUnlockProgress(0)
        }
      }
    })
    return complete ? 1 : 0
  }
})

/* 展开态点击空白 → 收起 */
function onBackdropTap(e) {
  if (!isCollapsed.value && !e.target.closest('.ls-interact')) {
    isCollapsed.value = true
    scrollY.value = 0
  }
}

/* ---------- 派生样式 ---------- */
const layerStyle = computed(() => {
  const p = progress.value
  return {
    transform: `translateY(${-p * 240}px) scale(${1 - p * 0.04})`,
    opacity: 1 - p * 0.9,
    filter: `blur(${p * 6}px)`
  }
})
const containerStyle = computed(() => {
  const p = progress.value
  const fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4
  return { opacity: fade }
})

const effectiveScrollY = computed(() => Math.min(scrollY.value, MAX_SCROLL.value))
const overscroll = computed(() => {
  const raw = Math.max(0, scrollY.value - MAX_SCROLL.value)
  return 30 * Math.log1p(raw / 30)
})
const notifScrollY = computed(() => (scrollY.value < 0 ? 0 : effectiveScrollY.value))
const squeeze = computed(() => Math.max(0, scrollY.value > 0 ? scrollY.value - HIT_DISTANCE : 0))
const clockHeight = computed(() => Math.max(CLOCK_MIN_HEIGHT, CLOCK_INITIAL_HEIGHT - squeeze.value))
const clipTop = computed(() => CLOCK_TOP + clockHeight.value + SAFE_GAP)
const expandClip = computed(() => scrollY.value <= 0 || isCollapsed.value)
const playerStretch = computed(() => lockNotifs.value.length * overscroll.value * STRETCH_FACTOR)
const scrollOffset = computed(() => (scrollY.value < 0 ? scrollY.value : effectiveScrollY.value))
const currentPlayerY = computed(() =>
  isCollapsed.value ? PLAYER_COLLAPSED_Y : PLAYER_START_Y - scrollOffset.value - playerStretch.value
)
const animating = computed(() => (!isDragging.value && !isWheeling.value && !isSpringing.value) || isCollapsed.value)
const transitionStyle = computed(() =>
  animating.value
    ? 'transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.25s ease-out, clip-path 0.25s cubic-bezier(0.1, 0.9, 0.2, 1)'
    : 'none'
)
const clipStyle = computed(() => {
  const sideInset = expandClip.value ? -50 : 0
  return {
    clipPath: `inset(${clipTop.value}px ${sideInset}px -100px ${sideInset}px round 22px 22px 0px 0px)`,
    WebkitClipPath: `inset(${clipTop.value}px ${sideInset}px -100px ${sideInset}px round 22px 22px 0px 0px)`,
    transition: transitionStyle.value
  }
})
const clockStyle = computed(() => ({
  height: `${clockHeight.value}px`,
  transition: transitionStyle.value
}))
const pillStyle = computed(() => ({
  transform: `translateY(${isCollapsed.value ? 0 : 30}px) scale(${isCollapsed.value ? 1 : 0.85})`,
  opacity: isCollapsed.value ? 1 : 0,
  transition: 'transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.25s ease-out'
}))

function notifStyle(i) {
  const currentY = i * NOTIF_SPACING - notifScrollY.value
  const isStacked = currentY > 0
  const depth = currentY / NOTIF_SPACING
  const clampedDepth = Math.min(depth, 3)
  const distanceFromBottom = lockNotifs.value.length - 1 - i
  const stretchAmount = distanceFromBottom * overscroll.value * STRETCH_FACTOR
  let yPos, scale, opacity
  if (isCollapsed.value) {
    yPos = BASE_Y + 140
    scale = 0.7
    opacity = 0
  } else if (isStacked) {
    yPos = BASE_Y + clampedDepth * 9
    scale = Math.max(1 - clampedDepth * 0.05, 0.85)
    if (depth <= 1) opacity = 1 - depth * 0.15
    else if (depth <= 2) opacity = 0.85 - (depth - 1) * 0.35
    else if (depth <= 3) opacity = 0.5 - (depth - 2) * 0.5
    else opacity = 0
  } else {
    yPos = BASE_Y + currentY - stretchAmount
    scale = 1
    opacity = 1
  }
  return {
    transform: `translateY(${yPos}px) scale(${scale})`,
    opacity,
    zIndex: 100 - i,
    transition: transitionStyle.value,
    pointerEvents: opacity === 0 ? 'none' : 'auto'
  }
}
</script>

<template>
  <div ref="rootRef" class="lock-screen" :style="containerStyle" @click="onBackdropTap">
    <!-- 壁纸 -->
    <div class="ls-wallpaper" :style="{ backgroundImage: `url(${wallpaper})` }"></div>
    <!-- 解锁进度驱动的整体容器 -->
    <div class="ls-inner" :style="layerStyle">
      <!-- 日期 -->
      <div class="ls-date">{{ dateLong }}</div>

      <!-- 巨大时钟（高度随滚动挤压） -->
      <div class="ls-clock" :style="clockStyle">
        <svg viewBox="0 0 280 84" preserveAspectRatio="none" style="overflow: visible;">
          <text x="140" y="82" text-anchor="middle" fill="white" font-weight="900" font-size="95" letter-spacing="-2">{{ timeShort }}</text>
        </svg>
      </div>

      <!-- 裁剪容器：播放器 + 通知队列 -->
      <div
        class="ls-clip ls-interact"
        :style="clipStyle"
        @wheel.prevent="handleWheel"
        @touchstart.passive="handleTouchStart"
        @touchmove.passive="handleTouchMove"
        @touchend.passive="handleTouchEnd"
        @touchcancel.passive="handleTouchEnd"
      >
        <!-- 音乐播放器卡片 -->
        <MusicPlayerCard :style="{ transform: `translateY(${currentPlayerY}px)`, transition: transitionStyle, zIndex: 200 }" @click="handleExpand" />

        <!-- 通知队列 -->
        <div
          v-for="(n, i) in lockNotifs"
          :key="n.id"
          class="ls-notif"
          :style="notifStyle(i)"
          @click="handleExpand"
        >
          <NotificationIcon :type="n.iconType" :size="38" />
          <div class="ls-notif-body">
            <div class="ls-notif-head">
              <span class="ls-notif-title">{{ n.title }}</span>
              <span class="ls-notif-time">{{ formatRelativeTime(n.time) }}</span>
            </div>
            <p class="ls-notif-desc">{{ n.body }}</p>
          </div>
        </div>
      </div>

      <!-- 微缩通知胶囊（折叠态） -->
      <div v-if="lockNotifs.length" class="ls-pill ls-interact" :style="pillStyle" @click="handleExpand">
        <div class="lp-mini">
          <NotificationIcon :type="lockNotifs[0].iconType" :size="22" />
          <NotificationIcon :type="lockNotifs[1]?.iconType || 'default'" :size="22" />
          <NotificationIcon :type="lockNotifs[2]?.iconType || 'default'" :size="22" />
        </div>
        <span class="lp-count">{{ lockNotifs.length }} 条通知</span>
      </div>

      <!-- 底部快捷按钮 -->
      <div class="ls-shortcuts">
        <button class="ls-shortcut">
          <svg width="11" height="22" viewBox="0 0 13 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.9521 4.21973C12.9521 4.94134 12.9534 5.38321 12.8994 5.78125L12.873 5.9502C12.8112 6.29076 12.7142 6.62432 12.583 6.94434L12.5244 7.08008C12.3399 7.49444 12.0799 7.8732 11.6152 8.55469L10.6641 9.94922C10.4818 10.2166 10.3834 10.3631 10.3174 10.4824L10.2598 10.5967C10.2134 10.7009 10.1764 10.8093 10.1494 10.9199L10.126 11.0313C10.0968 11.1922 10.0957 11.3625 10.0957 11.7949V21.5234C10.0957 22.3253 10.0997 22.8347 9.97949 23.251L9.9541 23.333C9.70427 24.069 9.14624 24.6571 8.43066 24.9473L8.28613 25.002C7.85429 25.1485 7.33185 25.1426 6.47656 25.1426C5.6747 25.1426 5.16534 25.1475 4.74902 25.0273L4.66699 25.002C3.93102 24.7521 3.34291 24.1941 3.05273 23.4785L2.99805 23.333C2.85161 22.9012 2.85742 22.3787 2.85742 21.5234V11.7949C2.85742 11.4708 2.85644 11.294 2.84375 11.1582L2.82617 11.0313C2.80579 10.9191 2.77633 10.8087 2.73633 10.7022L2.69238 10.5967C2.62588 10.4474 2.53148 10.3062 2.28809 9.94922L1.33691 8.55469C0.930372 7.95843 0.680631 7.59372 0.500977 7.23438L0.427735 7.08008C0.28705 6.76403 0.18029 6.43383 0.108399 6.09571L0.0800785 5.9502C-0.000878744 5.50394 3.97248e-07 5.04458 3.97248e-07 4.21973V4.19043H12.9521V4.21973ZM6.47656 11.4287C5.84543 11.4287 5.33308 11.9402 5.33301 12.5713V15.6191C5.33306 16.2503 5.84541 16.7617 6.47656 16.7617C7.10755 16.7615 7.61909 16.2502 7.61914 15.6191V12.5713C7.61906 11.9403 7.10753 11.4289 6.47656 11.4287ZM10.1328 4.06301e-06C10.5531 4.06301e-06 10.8919 -0.000816891 11.165 0.0214884C11.4426 0.0441692 11.6865 0.0930966 11.9121 0.208012C12.2705 0.39063 12.5625 0.681672 12.7451 1.04004L12.7852 1.125C12.8717 1.32664 12.9108 1.54417 12.9307 1.78711C12.9502 2.02654 12.9509 2.31612 12.9512 2.667H0.00097696C0.00120547 2.31612 0.00192381 2.02654 0.0214848 1.78711C0.0441676 1.50954 0.0930992 1.26562 0.208008 1.04004C0.390585 0.681863 0.68186 0.39059 1.04004 0.208012C1.26562 0.0931034 1.50953 0.0441715 1.78711 0.0214884C2.06032 -0.000832108 2.39893 4.05951e-06 2.81934 4.06301e-06H10.1328Z" fill="white"/>
          </svg>
        </button>
        <button class="ls-shortcut">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.9922 2.65625C14.1016 2.67187 14.2031 2.67969 14.2969 2.67969C14.4062 2.67969 14.5156 2.69531 14.625 2.72656C14.7344 2.75781 14.8359 2.79688 14.9297 2.84375C15.0391 2.875 15.1484 2.92188 15.2578 2.98438C15.3359 3.04687 15.4141 3.10938 15.4922 3.17188C15.5703 3.23437 15.6484 3.30469 15.7266 3.38281L16.9688 4.625C17.0938 4.75 17.1719 4.82812 17.2031 4.85938C17.25 4.89063 17.2812 4.91406 17.2969 4.92969C17.3125 4.94531 17.3281 4.96094 17.3438 4.97656C17.375 4.97656 17.4062 4.97656 17.4375 4.97656C17.4531 4.99219 17.4844 5 17.5312 5C17.5781 5 17.6953 5 17.8828 5H18.2578C18.5859 5 18.8828 5 19.1484 5C19.4141 5 19.6562 5.00781 19.875 5.02344C20.0938 5.05469 20.3047 5.09375 20.5078 5.14062C20.7109 5.17188 20.9062 5.24219 21.0938 5.35156C21.4062 5.49219 21.6797 5.6875 21.9141 5.9375C22.1484 6.17188 22.3359 6.4375 22.4766 6.73438C22.5859 6.92188 22.6641 7.11719 22.7109 7.32031C22.7578 7.52344 22.7891 7.74219 22.8047 7.97656C22.8203 8.17969 22.8281 8.41406 22.8281 8.67969C22.8281 8.94531 22.8281 9.24219 22.8281 9.57031V16.7656C22.8281 17.0938 22.8281 17.3906 22.8281 17.6562C22.8281 17.9219 22.8203 18.1562 22.8047 18.3594C22.7891 18.5781 22.7578 18.7969 22.7109 19.0156C22.6641 19.2188 22.5859 19.4141 22.4766 19.6016C22.3359 19.8984 22.1484 20.1641 21.9141 20.3984C21.6797 20.6328 21.4062 20.8281 21.0938 20.9844C20.9062 21.0781 20.7109 21.1484 20.5078 21.1953C20.3047 21.2422 20.0938 21.2734 19.875 21.2891C19.6562 21.3203 19.4141 21.3359 19.1484 21.3359C18.8828 21.3359 18.5859 21.3359 18.2578 21.3359H5.74219C5.41406 21.3359 5.11719 21.3359 4.85156 21.3359C4.58594 21.3359 4.34375 21.3203 4.125 21.2891C3.90625 21.2734 3.69531 21.2422 3.49219 21.1953C3.28906 21.1484 3.09375 21.0781 2.90625 20.9844C2.59375 20.8281 2.32031 20.6328 2.08594 20.3984C1.85156 20.1641 1.66406 19.8984 1.52344 19.6016C1.41406 19.4141 1.33594 19.2188 1.28906 19.0156C1.24219 18.7969 1.21094 18.5781 1.19531 18.3594C1.17969 18.1562 1.17188 17.9219 1.17188 17.6562C1.17188 17.3906 1.17188 17.0938 1.17188 16.7656V9.57031C1.17188 9.24219 1.17188 8.94531 1.17188 8.67969C1.17188 8.41406 1.17969 8.17969 1.19531 7.97656C1.21094 7.74219 1.24219 7.52344 1.28906 7.32031C1.33594 7.11719 1.40625 6.92188 1.5 6.73438C1.65625 6.4375 1.85156 6.17188 2.08594 5.9375C2.32031 5.6875 2.59375 5.49219 2.90625 5.35156C3.09375 5.24219 3.28906 5.17188 3.49219 5.14062C3.69531 5.09375 3.90625 5.05469 4.125 5.02344C4.34375 5.00781 4.58594 5 4.85156 5C5.11719 5 5.41406 5 5.74219 5H6.11719C6.30469 5 6.42188 5 6.46875 5C6.51562 5 6.54688 4.99219 6.5625 4.97656C6.59375 4.97656 6.61719 4.97656 6.63281 4.97656C6.66406 4.96094 6.6875 4.94531 6.70312 4.92969C6.71875 4.91406 6.74219 4.89063 6.77344 4.85938C6.82031 4.82812 6.90625 4.75 7.03125 4.625L8.27344 3.38281C8.35156 3.30469 8.42969 3.23437 8.50781 3.17188C8.58594 3.10938 8.66406 3.04687 8.74219 2.98438C8.85156 2.92188 8.95312 2.875 9.04688 2.84375C9.15625 2.79688 9.26562 2.75781 9.375 2.72656C9.48438 2.69531 9.58594 2.67969 9.67969 2.67969C9.78906 2.67969 9.89844 2.67187 10.0078 2.65625H13.9922ZM12 8.42188C11.3438 8.42188 10.7266 8.54688 10.1484 8.79688C9.57031 9.04688 9.0625 9.39062 8.625 9.82812C8.20312 10.25 7.86719 10.75 7.61719 11.3281C7.36719 11.8906 7.24219 12.5 7.24219 13.1562C7.24219 13.8125 7.36719 14.4297 7.61719 15.0078C7.86719 15.5859 8.20312 16.0938 8.625 16.5312C9.0625 16.9531 9.57031 17.2891 10.1484 17.5391C10.7266 17.7891 11.3438 17.9141 12 17.9141C12.6562 17.9141 13.2734 17.7891 13.8516 17.5391C14.4297 17.2891 14.9297 16.9531 15.3516 16.5312C15.7891 16.0938 16.1328 15.5859 16.3828 15.0078C16.6328 14.4297 16.7578 13.8125 16.7578 13.1562C16.7578 12.5 16.6328 11.8906 16.3828 11.3281C16.1328 10.75 15.7891 10.25 15.3516 9.82812C14.9297 9.39062 14.4297 9.04688 13.8516 8.79688C13.2734 8.54688 12.6562 8.42188 12 8.42188ZM12 9.92188C12.8906 9.92188 13.6562 10.2422 14.2969 10.8828C14.9375 11.5078 15.2578 12.2656 15.2578 13.1562C15.2578 14.0625 14.9375 14.8359 14.2969 15.4766C13.6562 16.1016 12.8906 16.4141 12 16.4141C11.1094 16.4141 10.3438 16.1016 9.70312 15.4766C9.0625 14.8359 8.74219 14.0625 8.74219 13.1562C8.74219 12.2656 9.0625 11.5078 9.70312 10.8828C10.3438 10.2422 11.1094 9.92188 12 9.92188ZM18.8438 7.50781C18.5156 7.50781 18.2344 7.625 18 7.85938C17.7812 8.07812 17.6719 8.34375 17.6719 8.65625C17.6719 8.98438 17.7812 9.26562 18 9.5C18.2344 9.71875 18.5156 9.82812 18.8438 9.82812C19.1562 9.82812 19.4219 9.71875 19.6406 9.5C19.875 9.26562 19.9922 8.98438 19.9922 8.65625C19.9922 8.34375 19.875 8.07812 19.6406 7.85938C19.4219 7.625 19.1562 7.50781 18.8438 7.50781Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lock-screen {
  position: absolute;
  inset: 0;
  z-index: var(--z-lock-screen);
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  background: #000;
}
.lock-screen:active { cursor: grabbing; }

.ls-wallpaper {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}
/* 轻微暗化让白色文字更清晰 */
.ls-wallpaper::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.18) 100%);
}

.ls-inner {
  position: absolute;
  inset: 0;
  will-change: transform, opacity, filter;
}

/* 日期 */
.ls-date {
  position: absolute;
  top: 55px;
  left: 0;
  right: 0;
  text-align: center;
  font: 500 22px/28px var(--font-stack);
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.5px;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

/* 巨大时钟 */
.ls-clock {
  position: absolute;
  top: 77px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  opacity: 0.95;
  will-change: height;
  pointer-events: none;
}
.ls-clock svg {
  width: 85%;
  height: 100%;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.2));
  font-family: -apple-system, "SF Pro Rounded", "Arial Rounded MT Bold", "Helvetica Neue", sans-serif;
}

/* 裁剪容器 */
.ls-clip {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  bottom: 0;
  pointer-events: none;
  will-change: clip-path;
}
.ls-clip > * { pointer-events: auto; }

/* removed ls-player css */

/* ---- 通知卡片 ---- */
.ls-notif {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 90px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
  border-radius: 22px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  will-change: transform, opacity;
  transform-origin: bottom center;
}
.ls-notif:active { transform: scale(0.98); }
.ls-notif-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.ls-notif-head { display: flex; align-items: baseline; margin-bottom: 2px; }
.ls-notif-title {
  color: #1c1c1e;
  font: 700 15px/1.2 var(--font-stack);
  letter-spacing: 0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ls-notif-time {
  margin-left: 10px;
  color: rgba(0, 0, 0, 0.45);
  font: 500 11px/1.2 var(--font-stack);
  flex: none;
}
.ls-notif-desc {
  color: #48484a;
  font: 400 13.5px/1.3 var(--font-stack);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  padding-right: 8px;
}

/* ---- 微缩通知胶囊 ---- */
.ls-pill {
  position: absolute;
  bottom: 46px;
  left: 0;
  right: 0;
  height: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  will-change: transform, opacity;
}
.lp-mini { display: flex; align-items: center; gap: 6px; }
.lp-count {
  color: rgba(255, 255, 255, 0.85);
  font: 500 13px/1 var(--font-stack);
  letter-spacing: 0.3px;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
}

/* ---- 底部快捷按钮 ---- */
.ls-shortcuts {
  position: absolute;
  bottom: 42px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 44px;
  pointer-events: none;
}
.ls-shortcut {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  pointer-events: auto;
  transition: background 0.2s ease, transform 0.12s ease;
}
.ls-shortcut:active { background: rgba(255, 255, 255, 0.8); color: #000; }
</style>
