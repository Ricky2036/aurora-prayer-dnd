<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useClock } from '../../composables/useClock'
import { useSpring } from '../../composables/useSpring'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { useSystemStore } from '../../stores/systemStore'
import { useNotificationsStore } from '../../stores/notificationsStore'
import { useI18nStore } from '../../stores/i18nStore'
import { useRecorderStore } from '../../stores/recorderStore'
import { useClockStore } from '../../stores/clockStore'
import { usePrayerStore } from '../../stores/prayerStore'
import { useControlStore } from '../../stores/controlStore'
import { useActiveActivities } from '../../composables/useActiveActivities'
import { CLOCK_ICONS } from '../apps/clock/clockIcons'
import { GLYPHS } from '../../assets/icons/glyphs'
import NotificationIcon from '../ui/NotificationIcon.vue'
import { formatRelativeTime } from '../../utils/timeFormat'
import { getNotificationStackLayout } from '../../utils/notificationStack'
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
import LIcon from '../ui/LIcon.vue'
import IslandCloseModal from '../ui/IslandCloseModal.vue'

const { timeShort, dateLong } = useClock()
const system = useSystemStore()
const notifications = useNotificationsStore()
const i18n = useI18nStore()
const recorder = useRecorderStore()
const clock = useClockStore()
const prayer = usePrayerStore()
const control = useControlStore()
const { activeActivities } = useActiveActivities()

if (typeof window !== 'undefined') {
  window.__system = system
  window.__control = control
}

const rootRef = ref(null)
const unlockRef = ref(null)
const listRef = ref(null)
const UNLOCK_SPAN = 460

/* ---------- 响应式屏幕高度与自适应布局常量 ---------- */
const screenHeight = ref(844)

function updateScreenHeight() {
  if (rootRef.value) {
    const h = rootRef.value.clientHeight
    if (h > 200) {
      screenHeight.value = h
    }
  }
}

let resizeObserver = null
onMounted(() => {
  updateScreenHeight()
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateScreenHeight()
    })
    resizeObserver.observe(rootRef.value)
  }
  window.addEventListener('resize', updateScreenHeight)
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  window.removeEventListener('resize', updateScreenHeight)
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
})

const BASE_Y = computed(() => screenHeight.value - 254)
const PLAYER_HEIGHT = 164
const NOTIF_SPACING = 98
const PLAYER_NOTIF_GAP = 8
const PLAYER_START_Y = computed(() => BASE_Y.value - PLAYER_HEIGHT - PLAYER_NOTIF_GAP)
const ACTIVITY_CARD_HEIGHT = 84
const ACTIVITY_GAP = 10
const DATE_TOP = 55
const DATE_HEIGHT = 28
const CLOCK_TOP = DATE_TOP + DATE_HEIGHT - 6 // 77
const TOP_GAP = 16
const CLOCK_MAX_HEIGHT = 220
const CLOCK_MIN_HEIGHT = 110
const SAFE_GAP = TOP_GAP
const LOCK_STACK_BOTTOM_INSET = 140
const LOCK_STACK_MAX_VISUAL_OFFSET = 36
const LOCK_CARD_HEIGHT = 90
const LOCK_CARD_BASE_ALPHA = 0.7
const LOCK_STACK_FRONT_ALPHA = 0.98
const LOCK_STACK_BACK_ALPHA = 0.54
const LOCK_STACK_DEPTH_ALPHA = 0.4
const LOCK_STACK_ALPHA_OVERLAP = 48
const NATIVE_EXPAND_OFFSET = 20
const activityBottomY = computed(() => control.mediaActive ? PLAYER_START_Y.value : BASE_Y.value)
const standaloneActivityCapacity = computed(() => {
  const available = activityBottomY.value - (CLOCK_TOP + CLOCK_MIN_HEIGHT + SAFE_GAP + 4)
  return Math.max(0, Math.floor((available + ACTIVITY_GAP) / (ACTIVITY_CARD_HEIGHT + ACTIVITY_GAP)))
})
const standaloneActivities = computed(() => activeActivities.value.slice(0, standaloneActivityCapacity.value))
const overflowActivities = computed(() => activeActivities.value.slice(standaloneActivityCapacity.value))
const totalActivitiesHeight = computed(() => {
  const count = standaloneActivities.value.length
  return count > 0 ? count * (ACTIVITY_CARD_HEIGHT + ACTIVITY_GAP) : 0
})

// 播放器在折叠态的 Y 坐标
const PLAYER_COLLAPSED_Y = computed(() => {
  return screenHeight.value - PLAYER_HEIGHT - 105
})

// 活动卡片队列在折叠态的起始 Y 坐标：位于播放器卡片正上方；若活动较多则自 clipTop 下方自然排布
function getActivityCollapsedY(index) {
  const totalH = totalActivitiesHeight.value
  const bottomY = control.mediaActive ? PLAYER_COLLAPSED_Y.value : BASE_Y.value
  const idealStart = bottomY - totalH
  const minStart = clipTop.value + 4
  const startY = Math.max(minStart, idealStart)
  return startY + index * (ACTIVITY_CARD_HEIGHT + ACTIVITY_GAP)
}

// 活动卡片队列在展开态的起始 Y 坐标：紧贴在音乐播放器上方，随通知队列平滑滚动
function getActivityStartY(index) {
  const totalH = totalActivitiesHeight.value
  const baseY = Math.max(clipTop.value + 4, activityBottomY.value - totalH) + index * (ACTIVITY_CARD_HEIGHT + ACTIVITY_GAP)
  return isCollapsed.value ? getActivityCollapsedY(index) : baseY - scrollOffset.value
}

// 有独立展示活动时，顶部可用空间需考虑其总高度；溢出活动进入通知堆叠。
const TOP_WIDGET_START_Y = computed(() => {
  return standaloneActivities.value.length > 0
    ? activityBottomY.value - totalActivitiesHeight.value
    : activityBottomY.value
})
const CLOCK_INITIAL_HEIGHT = computed(() => CLOCK_MAX_HEIGHT)
const HIT_DISTANCE = computed(() => Math.max(0, TOP_WIDGET_START_Y.value - (CLOCK_TOP + CLOCK_INITIAL_HEIGHT.value) - SAFE_GAP))
const EXPAND_SCROLL_Y = computed(() => CLOCK_INITIAL_HEIGHT.value - CLOCK_MIN_HEIGHT)

/* 锁屏队列最多容纳 6 项；空间不足的灵动岛活动优先进入队列。 */
const lockNotifs = computed(() => notifications.list.slice(0, 6))
/* 溢出活动与普通通知共用同一队列和堆叠动画。 */
const lockItems = computed(() => {
  const activities = overflowActivities.value.map(activity => ({
    id: activity.id,
    isActivity: true,
    activity
  }))
  const notificationItems = lockNotifs.value.map(n => ({ id: n.id, isActivity: false, raw: n }))
  return [...activities, ...notificationItems].slice(0, 6)
})
/* 「N 条通知」的 N 与量词语序各语言不同，交给 i18n 拼 */
const notifCountLabel = computed(() => i18n.t('notifCount')(lockItems.value.length))
const MAX_SCROLL = computed(() => Math.max(0, (lockItems.value.length - 1) * NOTIF_SPACING))
const scrollSpacerStyle = computed(() => ({ height: `${NATIVE_EXPAND_OFFSET + MAX_SCROLL.value}px` }))

/* ---------- 原生滚动状态：与通知中心一样由浏览器处理触摸惯性 ---------- */
const scrollY = ref(0)
const isCollapsed = ref(true)
const isScrolling = ref(false)
let scrollIdleTimer = null
let lastNativeScrollY = 0

function handleListScroll(e) {
  const nativeY = e.currentTarget.scrollTop
  scrollY.value = Math.max(0, nativeY - NATIVE_EXPAND_OFFSET)
  if (nativeY >= 1) {
    isCollapsed.value = false
  } else if (lastNativeScrollY >= 1) {
    isCollapsed.value = true
  }
  lastNativeScrollY = nativeY
  isScrolling.value = true
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
  scrollIdleTimer = setTimeout(() => {
    isScrolling.value = false
    scrollIdleTimer = null
  }, 90)
}

/* ---------- 卡片横向滑动（左滑露操作按钮） ---------- */
const swipeOffsets = ref({}) // itemId -> number (0 ~ -156)
let isSwipingCard = false
let swipeGestureDecided = false
let activeCardId = null
let cardPointerStartX = 0
let cardPointerStartY = 0
let cardInitialOffset = 0
let cardPointerId = null
let cardPointerTarget = null

function resetOtherCards(exceptId = null) {
  const newOffsets = {}
  for (const [k, v] of Object.entries(swipeOffsets.value)) {
    if (k === exceptId && v !== 0) {
      newOffsets[k] = v
    }
  }
  swipeOffsets.value = newOffsets
}

function onCardPointerDown(e, id) {
  // 普通通知在折叠态禁止横滑，但活跃灵动岛卡片始终默认展开展示，允许随时左滑操作
  const isAct = activeActivities.value.some(a => a.id === id) || id === '__recorder__'
  if (isCollapsed.value && !isAct) return
  activeCardId = id
  cardPointerStartX = e.clientX
  cardPointerStartY = e.clientY
  cardInitialOffset = swipeOffsets.value[id] || 0
  swipeGestureDecided = false
  isSwipingCard = false
  cardPointerId = e.pointerId
  cardPointerTarget = e.currentTarget
}

function onCardPointerMove(e, id) {
  const isAct = activeActivities.value.some(a => a.id === id) || id === '__recorder__'
  if (activeCardId !== id || (isCollapsed.value && !isAct)) return
  const dx = e.clientX - cardPointerStartX
  const dy = e.clientY - cardPointerStartY

  if (!swipeGestureDecided) {
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      swipeGestureDecided = true
      if (Math.abs(dx) > Math.abs(dy)) {
        isSwipingCard = true
        try {
          cardPointerTarget?.setPointerCapture(cardPointerId)
        } catch (_) {}
      } else {
        isSwipingCard = false
      }
    }
  }

  if (isSwipingCard) {
    // 限制左滑在 -260 ~ 0 之间（带少许阻尼）
    let nextOffset = cardInitialOffset + dx
    if (nextOffset > 0) nextOffset = nextOffset * 0.2
    if (nextOffset < -260) nextOffset = -260 + (nextOffset + 260) * 0.2
    swipeOffsets.value = {
      ...swipeOffsets.value,
      [id]: nextOffset
    }
  }
}

let justSwipedId = null
const swipedTransitionId = ref(null)

function onCardPointerUp(e, id) {
  if (activeCardId !== id) return
  if (isSwipingCard) {
    justSwipedId = id
    swipedTransitionId.value = id
    setTimeout(() => {
      if (justSwipedId === id) justSwipedId = null
    }, 250)
    setTimeout(() => {
      if (swipedTransitionId.value === id) swipedTransitionId.value = null
    }, 280)

    const currentOffset = swipeOffsets.value[id] || 0
    if (currentOffset <= -170) {
      // 超过 50%~60% 阈值，直接飞出并删除该卡片
      swipedTransitionId.value = id
      swipeOffsets.value = {
        ...swipeOffsets.value,
        [id]: -420
      }
      setTimeout(() => {
        const item = lockItems.value.find(n => n.id === id) || activeActivities.value.find(a => a.id === id) || { id }
        onDeleteCard(item)
      }, 200)
    } else if (currentOffset < -45) {
      // 阈值：向左超过 45px 则吸附到 -118px（显示设置与删除图标），否则收回
      resetOtherCards(id)
      swipeOffsets.value = {
        ...swipeOffsets.value,
        [id]: -118
      }
    } else {
      const next = { ...swipeOffsets.value }
      delete next[id]
      swipeOffsets.value = next
    }
  }
  try {
    cardPointerTarget?.releasePointerCapture(cardPointerId)
  } catch (_) {}
  activeCardId = null
  isSwipingCard = false
  swipeGestureDecided = false
  cardPointerTarget = null
  cardPointerId = null
}

/** 滑动操作按钮弹性物理与位移动画计算（不缩放图标，通过动态拉伸设置与删除按钮间距体现弹性） */
function getActionBtnStyle(id, type) {
  const offset = swipeOffsets.value[id] || 0
  if (offset >= 0) {
    return {
      opacity: 0,
      transform: 'translateX(0)',
      pointerEvents: 'none'
    }
  }
  const dist = Math.abs(offset)
  const isSettings = type === 'settings'
  const opacity = Math.min(1, dist / 35).toFixed(2)
  // 当滑动超过 118px 时，拉伸按钮间距
  const extraDist = Math.max(0, dist - 118)
  const extraGap = extraDist * 0.45
  const shiftX = isSettings ? extraGap : (extraGap * 0.12)
  const isCurrentlySwiping = isSwipingCard && activeCardId === id
  return {
    opacity,
    transform: `translateX(${-shiftX}px)`,
    transition: isCurrentlySwiping ? 'none' : 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.25s ease'
  }
}

const isIslandModalVisible = ref(false)
const pendingIslandAct = ref(null)

function onRequestDeleteActivity(act) {
  pendingIslandAct.value = act
  isIslandModalVisible.value = true
}

function stopActivityInstance(act) {
  if (!act) return
  if (act.type === 'alarm' || act.id === 'alarm') {
    clock.dismissAlarm()
  } else if (act.isRecorder || act.type === 'recorder' || act.id === '__recorder__' || act.id === 'recorder') {
    recorder.stopRecording()
  } else if (act.type === 'timer' || act.id === 'timer') {
    clock.cancelTimer()
  } else if (act.type === 'stopwatch' || act.id === 'stopwatch') {
    clock.resetStopwatch()
  } else if (act.type === 'prayer' || act.id === 'prayer') {
    prayer.closeIsland()
  }
}

function handleCloseOnce() {
  if (!pendingIslandAct.value) return
  const act = pendingIslandAct.value
  stopActivityInstance(act)
  const next = { ...swipeOffsets.value }
  delete next[act.id]
  swipeOffsets.value = next
  isIslandModalVisible.value = false
  pendingIslandAct.value = null
}

function handleClosePermanent() {
  if (!pendingIslandAct.value) return
  const act = pendingIslandAct.value
  stopActivityInstance(act)
  notifications.setIslandEnabled(act.type, false)
  const next = { ...swipeOffsets.value }
  delete next[act.id]
  swipeOffsets.value = next
  isIslandModalVisible.value = false
  pendingIslandAct.value = null
}

function handleCancelIslandModal() {
  isIslandModalVisible.value = false
  pendingIslandAct.value = null
}

function onDeleteCard(item) {
  if (item.type === 'alarm' || item.id === 'alarm') {
    clock.dismissAlarm()
  } else if (item.isRecorder || item.id === '__recorder__' || item.id === 'recorder') {
    recorder.stopRecording()
  } else if (item.id === 'timer') {
    clock.cancelTimer()
  } else if (item.id === 'stopwatch') {
    clock.resetStopwatch()
  } else if (item.id === 'prayer') {
    prayer.closeIsland()
  } else {
    notifications.remove(item.id)
  }
  const next = { ...swipeOffsets.value }
  delete next[item.id]
  swipeOffsets.value = next
}

function onJumpSettings() {
  notifications.setTargetView('notifications', 'dynamicBar')
  system.unlock()
  system.openApp('settings')
  swipeOffsets.value = {}
}

function handleActivityCardClick(act) {
  if (isSwipingCard) return
  if (justSwipedId === act.id) {
    justSwipedId = null
    return
  }
  if (swipeOffsets.value[act.id]) {
    const next = { ...swipeOffsets.value }
    delete next[act.id]
    swipeOffsets.value = next
    return
  }
  if (act.type === 'alarm') {
    clock.setActiveTab('alarm')
    system.unlock()
    system.openApp('clock')
  } else if (act.type === 'recorder') {
    system.unlock()
    system.openApp('voicememos')
  } else if (act.type === 'timer') {
    clock.setActiveTab('timer')
    system.unlock()
    system.openApp('clock')
  } else if (act.type === 'stopwatch') {
    clock.setActiveTab('stopwatch')
    system.unlock()
    system.openApp('clock')
  } else if (act.type === 'prayer') {
    clock.setActiveTab('muslim')
    system.unlock()
    system.openApp('clock')
  }
}

function handleCardClick(item) {
  if (isSwipingCard) return
  if (justSwipedId === item.id) {
    justSwipedId = null
    return
  }
  // 如果处于划开状态，点击卡片主体则先收回
  if (swipeOffsets.value[item.id]) {
    const next = { ...swipeOffsets.value }
    delete next[item.id]
    swipeOffsets.value = next
    return
  }
  if (item.isActivity) {
    handleActivityCardClick(item.activity)
    return
  }
  handleExpand()
}

/* 点击播放器/通知/胶囊：折叠→展开；已展开且未滚远→滚到挤压位 */
function handleExpand() {
  if (isCollapsed.value) {
    isCollapsed.value = false
    scrollY.value = 0
    listRef.value?.scrollTo({ top: NATIVE_EXPAND_OFFSET, behavior: 'smooth' })
  } else if (scrollY.value < EXPAND_SCROLL_Y.value) {
    listRef.value?.scrollTo({
      top: NATIVE_EXPAND_OFFSET + EXPAND_SCROLL_Y.value,
      behavior: 'smooth'
    })
  }
}

/* ---------- 解锁手势（非交互区上滑） ---------- */
const { value: progress, animateTo, snapTo } = useSpring(0, 'ios-gentle')
let unlocked = false

useSwipeGesture(unlockRef, {
  axis: 'y',
  direction: -1,
  span: UNLOCK_SPAN,
  canStart(e) {
    if (isIslandModalVisible.value) return false
    // 交互区（播放器/通知/胶囊）的上滑留给展开与滚动逻辑
    if (e.target?.closest?.('.ls-interact, .island-modal-backdrop')) return false
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

/* 点击空白处 → 收起已滑开卡片 &（展开态时）收起锁屏展开列表 */
function onBackdropTap(e) {
  if (isIslandModalVisible.value) return
  // 点击卡片本体、按钮或交互区域内部时不收起滑开状态
  if (e.target.closest('.ls-card-front, .ls-swipe-actions, .ls-action-btn, .ls-shortcut, .ls-pill, .island-modal-backdrop')) {
    return
  }
  if (Object.keys(swipeOffsets.value).length > 0) {
    swipeOffsets.value = {}
  }
  if (!isCollapsed.value && !e.target.closest('.ls-interact')) {
    isCollapsed.value = true
    scrollY.value = 0
    listRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
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

const squeeze = computed(() => Math.max(0, scrollY.value > 0 ? scrollY.value - HIT_DISTANCE.value : 0))
const clockHeight = computed(() => Math.max(CLOCK_MIN_HEIGHT, CLOCK_INITIAL_HEIGHT.value - squeeze.value))
const clipTop = computed(() => CLOCK_TOP + clockHeight.value + SAFE_GAP)
const scrollOffset = computed(() => scrollY.value)
const expandedPlayerBaseY = computed(() => Math.max(
  PLAYER_START_Y.value,
  clipTop.value + 4 + totalActivitiesHeight.value
))
const expandedNotificationBaseY = computed(() => {
  if (control.mediaActive) {
    return Math.max(
      BASE_Y.value,
      expandedPlayerBaseY.value + PLAYER_HEIGHT + PLAYER_NOTIF_GAP
    )
  }
  if (standaloneActivities.value.length > 0) {
    return Math.max(BASE_Y.value, clipTop.value + 4 + totalActivitiesHeight.value)
  }
  return BASE_Y.value
})
const currentPlayerY = computed(() => {
  if (isCollapsed.value) {
    if (standaloneActivities.value.length > 0) {
      const activitiesBottom = getActivityCollapsedY(0) + totalActivitiesHeight.value
      return Math.max(PLAYER_COLLAPSED_Y.value, activitiesBottom)
    }
    return PLAYER_COLLAPSED_Y.value
  }
  return expandedPlayerBaseY.value - scrollOffset.value
})
function activityCardStyle(index) {
  const y = getActivityStartY(index)
  return {
    transform: `translate3d(0, ${y}px, 0)`,
    transition: transitionStyle.value,
    zIndex: 190 - index
  }
}
const animating = computed(() => (!isScrolling.value && !isSwipingCard) || isCollapsed.value)
const transitionStyle = computed(() =>
  animating.value
    ? 'transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.25s ease-out, clip-path 0.25s cubic-bezier(0.1, 0.9, 0.2, 1)'
    : 'none'
)
const clipStyle = computed(() => {
  const sideInset = isCollapsed.value ? -50 : 0
  return {
    clipPath: `inset(${clipTop.value}px ${sideInset}px -100px ${sideInset}px round 22px 22px 0px 0px)`,
    WebkitClipPath: `inset(${clipTop.value}px ${sideInset}px -100px ${sideInset}px round 22px 22px 0px 0px)`,
    transition: transitionStyle.value,
    pointerEvents: isCollapsed.value ? 'none' : 'auto'
  }
})
const clockStyle = computed(() => ({
  height: `${clockHeight.value}px`,
  transition: transitionStyle.value
}))
const pillStyle = computed(() => ({
  transform: `translateY(${isCollapsed.value ? 0 : 30}px) scale(${isCollapsed.value ? 1 : 0.85})`,
  opacity: isCollapsed.value ? 1 : 0,
  transition: 'transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.25s ease-out',
  pointerEvents: isCollapsed.value ? 'auto' : 'none'
}))

function getLockNotificationGeometry(i) {
  const naturalY = expandedNotificationBaseY.value + i * NOTIF_SPACING - scrollY.value
  const layout = getNotificationStackLayout({
    cardBottom: naturalY + LOCK_CARD_HEIGHT,
    viewportHeight: screenHeight.value,
    bottomInset: LOCK_STACK_BOTTOM_INSET,
    maxVisualOffset: LOCK_STACK_MAX_VISUAL_OFFSET
  })
  const visualY = naturalY + layout.translateY
  const bottomThreshold = screenHeight.value - LOCK_STACK_BOTTOM_INSET
  const stackDepthProgress = Math.min(
    1,
    Math.max(0, (naturalY + LOCK_CARD_HEIGHT - bottomThreshold) / LOCK_STACK_ALPHA_OVERLAP)
  )
  return {
    naturalY,
    visualY,
    visualBottom: visualY + LOCK_CARD_HEIGHT * layout.scale,
    stackDepthProgress,
    layout
  }
}

function getLockCardOverlap(front, back) {
  if (!front || !back) return 0
  const overlap = Math.max(0, front.visualBottom - back.visualY)
  return Math.min(1, overlap / LOCK_STACK_ALPHA_OVERLAP)
}

function notifStyle(i) {
  const geometry = getLockNotificationGeometry(i)
  const next = i < lockItems.value.length - 1 ? getLockNotificationGeometry(i + 1) : null
  const coveringProgress = getLockCardOverlap(geometry, next)
  const backgroundAlpha = Math.min(
    LOCK_STACK_FRONT_ALPHA,
    Math.max(
      LOCK_STACK_BACK_ALPHA,
      LOCK_CARD_BASE_ALPHA
        + (LOCK_STACK_FRONT_ALPHA - LOCK_CARD_BASE_ALPHA) * coveringProgress
        - LOCK_STACK_DEPTH_ALPHA * geometry.stackDepthProgress
    )
  )
  const { naturalY, layout } = geometry
  let yPos, scale, opacity
  if (isCollapsed.value) {
    yPos = BASE_Y.value + 140
    scale = 0.8
    opacity = 0
  } else if (!layout.stacked) {
    yPos = naturalY
    scale = 1
    opacity = 1
  } else {
    yPos = naturalY + layout.translateY
    scale = layout.scale
    opacity = layout.opacity
  }
  return {
    transform: `translate3d(0, ${yPos}px, 0) scale(${scale})`,
    opacity,
    zIndex: 100 - i,
    transition: transitionStyle.value,
    pointerEvents: opacity === 0 || !layout.interactive ? 'none' : 'auto',
    '--ls-card-bg-alpha': backgroundAlpha.toFixed(3)
  }
}
</script>

<template>
  <div ref="rootRef" class="lock-screen" :style="containerStyle" @click="onBackdropTap">
    <!-- 壁纸 -->
    <div class="ls-wallpaper" :style="{ backgroundImage: `url(${wallpaper})` }"></div>
    <div ref="unlockRef" class="ls-unlock-surface"></div>
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
        ref="listRef"
        class="ls-clip ls-interact"
        tabindex="0"
        :style="clipStyle"
        @scroll.passive="handleListScroll"
      >
        <div class="ls-scroll-stage">
        <!-- 活跃活动卡片队列：同步所有活跃灵动岛（不设数量上限，有几个显示几个，展开与折叠均呈现） -->
        <template v-for="(act, actIdx) in standaloneActivities" :key="act.id">
          <div
            class="ls-card-wrapper ls-activity-standalone"
            :style="activityCardStyle(actIdx)"
          >
            <!-- 底层滑动操作按钮 -->
            <div class="ls-swipe-actions" :class="{ 'is-active': (swipeOffsets[act.id] || 0) < -2 }">
              <button
                class="ls-action-btn ls-btn-settings"
                :style="getActionBtnStyle(act.id, 'settings')"
                @click.stop="onJumpSettings"
                :title="i18n.t('islandSettings')"
              >
                <LIcon name="headerSettings" :size="20" />
              </button>
              <button
                class="ls-action-btn ls-btn-delete"
                :style="getActionBtnStyle(act.id, 'delete')"
                @click.stop="onRequestDeleteActivity(act)"
                :title="i18n.t('delete')"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>

            <!-- 表层卡片主体（横滑） -->
            <div
              class="ls-card-front ls-activity-card"
              :class="[
                `is-${act.type}`,
                {
                  'is-swiping': isSwipingCard && activeCardId === act.id,
                  'has-swipe-transition': !isSwipingCard && swipedTransitionId === act.id
                }
              ]"
              :style="{ transform: `translateX(${swipeOffsets[act.id] || 0}px)` }"
              @pointerdown="onCardPointerDown($event, act.id)"
              @pointermove="onCardPointerMove($event, act.id)"
              @pointerup="onCardPointerUp($event, act.id)"
              @pointercancel="onCardPointerUp($event, act.id)"
              @click="handleActivityCardClick(act)"
            >
              <!-- 闹钟类型 -->
              <template v-if="act.type === 'alarm'">
                <div class="ls-act-icon-wrap icon-alarm" :class="{ 'is-ringing': clock.isAlarmRinging }">
                  <svg width="30" height="30" viewBox="0 0 34 34" fill="none">
                    <path d="M5.5 11C4 13.5 4 17.5 5.5 20" stroke="#FF9F0A" stroke-width="2.2" stroke-linecap="round" />
                    <path d="M28.5 11C30 13.5 30 17.5 28.5 20" stroke="#FF9F0A" stroke-width="2.2" stroke-linecap="round" />
                    <circle cx="17" cy="17" r="10" fill="#FF9F0A" />
                    <path d="M17 11.5V17H12.5" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="17" cy="17" r="1.3" fill="#000000" />
                  </svg>
                </div>
                <div class="ls-rc-info">
                  <div class="ls-rc-time">{{ act.title }}</div>
                  <div class="ls-rc-sub">{{ act.subtitle }}</div>
                </div>
                <div class="ls-act-ctrls">
                  <button
                    class="ls-act-ctrl-btn btn-snooze"
                    @click.stop="clock.snoozeAlarm()"
                    :title="clock.isAlarmSnoozing ? '重新延时' : '稍后提醒'"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="10.5" cy="13.5" r="5.8" fill="#ffffff" />
                      <path d="M10.5 10.5V13.5H13" stroke="#333336" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M9.5 5.5H11.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />
                      <path d="M10.5 5.5V7.5" stroke="#ffffff" stroke-width="1.5" />
                      <text x="14.8" y="7.5" fill="#ffffff" font-size="6" font-weight="700" font-family="-apple-system, sans-serif">z</text>
                      <text x="18.2" y="6" fill="#ffffff" font-size="7.5" font-weight="700" font-family="-apple-system, sans-serif">Z</text>
                    </svg>
                  </button>
                  <button class="ls-act-ctrl-btn btn-cancel" @click.stop="clock.dismissAlarm()" title="关闭">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.close" fill="#fff" /></svg>
                  </button>
                </div>
              </template>

              <!-- 录音类型 -->
              <template v-else-if="act.type === 'recorder'">
                <div class="ls-rc-icon-wrap">
                  <div class="ls-rc-audio-bars">
                    <span class="bar bar-1"></span>
                    <span class="bar bar-2"></span>
                    <span class="bar bar-3"></span>
                    <span class="bar bar-main"></span>
                    <span class="bar bar-5"></span>
                    <span class="bar bar-6"></span>
                    <span class="bar bar-7"></span>
                  </div>
                </div>
                <div class="ls-rc-info">
                  <div class="ls-rc-time">{{ act.title }}</div>
                  <div class="ls-rc-sub">{{ act.subtitle }}</div>
                </div>
                <button class="ls-rc-stop-btn" @click.stop="recorder.stopRecording" title="停止录音">
                  <div class="ls-rc-stop-square"></div>
                </button>
              </template>

              <!-- 定时器类型 -->
              <template v-else-if="act.type === 'timer'">
                <div class="ls-act-icon-wrap icon-timer">
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path :d="CLOCK_ICONS.timer" fill="#ff9500" />
                  </svg>
                </div>
                <div class="ls-rc-info">
                  <div class="ls-rc-time">{{ act.title }}</div>
                  <div class="ls-rc-sub">{{ act.subtitle }}</div>
                </div>
                <div class="ls-act-ctrls">
                  <button class="ls-act-ctrl-btn btn-cancel" @click.stop="clock.cancelTimer()" title="取消">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.close" fill="#fff" /></svg>
                  </button>
                  <button
                    class="ls-act-ctrl-btn btn-action"
                    @click.stop="clock.timer.status === 'running' ? clock.pauseTimer() : clock.resumeTimer()"
                    title="暂停/开始"
                  >
                    <svg v-if="clock.timer.status === 'running'" width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.pause" fill="#fff" /></svg>
                    <svg v-else width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.play" fill="#fff" /></svg>
                  </button>
                </div>
              </template>

              <!-- 秒表类型 -->
              <template v-else-if="act.type === 'stopwatch'">
                <div class="ls-act-icon-wrap icon-stopwatch">
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path :d="CLOCK_ICONS.stopwatch" fill="#ff9500" />
                  </svg>
                </div>
                <div class="ls-rc-info">
                  <div class="ls-rc-time">{{ act.title }}</div>
                  <div class="ls-rc-sub">{{ act.subtitle }}</div>
                </div>
                <div class="ls-act-ctrls">
                  <button
                    v-if="clock.stopwatch.status === 'running'"
                    class="ls-act-ctrl-btn btn-cancel"
                    @click.stop="clock.recordLap()"
                    title="计次"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.lap" fill="#fff" /></svg>
                  </button>
                  <button
                    v-else
                    class="ls-act-ctrl-btn btn-cancel"
                    @click.stop="clock.resetStopwatch()"
                    title="重置"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.close" fill="#fff" /></svg>
                  </button>
                  <button
                    class="ls-act-ctrl-btn btn-action"
                    @click.stop="clock.stopwatch.status === 'running' ? clock.pauseStopwatch() : clock.startStopwatch()"
                    title="暂停/开始"
                  >
                    <svg v-if="clock.stopwatch.status === 'running'" width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.pause" fill="#fff" /></svg>
                    <svg v-else width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.play" fill="#fff" /></svg>
                  </button>
                </div>
              </template>

              <!-- 礼拜模式类型 -->
              <template v-else-if="act.type === 'prayer'">
                <div class="ls-act-icon-wrap icon-prayer">
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path :d="GLYPHS.moon" fill="#00C853" />
                  </svg>
                </div>
                <div class="ls-rc-info">
                  <div class="ls-rc-time">{{ act.title }}</div>
                  <div class="ls-rc-sub">{{ act.subtitle }}</div>
                </div>
                <div class="ls-act-ctrls">
                  <button class="ls-act-ctrl-btn btn-cancel" @click.stop="prayer.closeIsland()" title="关闭">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.close" fill="#fff" /></svg>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </template>

        <!-- 音乐播放器卡片 -->
        <MusicPlayerCard
          v-if="control.mediaActive"
          :style="{ transform: `translateY(${currentPlayerY}px)`, transition: transitionStyle, zIndex: 200 }"
          @click="handleExpand"
        />

        <!-- 通知队列（卡片支持横滑呼出灵动岛设置与删除按钮） -->
        <div
          v-for="(item, i) in lockItems"
          :key="item.id"
          class="ls-card-wrapper"
          :style="notifStyle(i)"
        >
          <!-- 底层滑动操作按钮 -->
          <div class="ls-swipe-actions" :class="{ 'is-active': (swipeOffsets[item.id] || 0) < -2 }">
            <button
              class="ls-action-btn ls-btn-settings"
              :style="getActionBtnStyle(item.id, 'settings')"
              @click.stop="onJumpSettings"
              :title="i18n.t('islandSettings')"
            >
              <LIcon name="headerSettings" :size="20" />
            </button>
            <button
              class="ls-action-btn ls-btn-delete"
              :style="getActionBtnStyle(item.id, 'delete')"
              @click.stop="item.isActivity ? onRequestDeleteActivity(item.activity) : onDeleteCard(item)"
              :title="i18n.t('delete')"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          </div>

          <!-- 表层卡片主体（横滑） -->
          <div
            class="ls-card-front"
            :class="[
              item.isActivity ? ['ls-activity-card', `is-${item.activity.type}`] : null,
              {
                'is-swiping': isSwipingCard && activeCardId === item.id,
                'has-swipe-transition': !isSwipingCard && swipedTransitionId === item.id
              }
            ]"
            :style="{ transform: `translateX(${swipeOffsets[item.id] || 0}px)` }"
            @pointerdown="onCardPointerDown($event, item.id)"
            @pointermove="onCardPointerMove($event, item.id)"
            @pointerup="onCardPointerUp($event, item.id)"
            @pointercancel="onCardPointerUp($event, item.id)"
            @click="handleCardClick(item)"
          >
            <template v-if="item.isActivity">
              <div v-if="item.activity.type === 'alarm'" class="ls-act-icon-wrap icon-alarm" :class="{ 'is-ringing': clock.isAlarmRinging }">
                <svg width="26" height="26" viewBox="0 0 34 34" fill="none">
                  <path d="M5.5 11C4 13.5 4 17.5 5.5 20" stroke="#FF9F0A" stroke-width="2.2" stroke-linecap="round" />
                  <path d="M28.5 11C30 13.5 30 17.5 28.5 20" stroke="#FF9F0A" stroke-width="2.2" stroke-linecap="round" />
                  <circle cx="17" cy="17" r="10" fill="#FF9F0A" />
                  <path d="M17 11.5V17H12.5" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                  <circle cx="17" cy="17" r="1.3" fill="#000000" />
                </svg>
              </div>
              <div v-else-if="item.activity.type === 'recorder'" class="ls-rc-icon-wrap">
                <div class="ls-rc-audio-bars">
                  <span class="bar bar-1"></span><span class="bar bar-2"></span><span class="bar bar-3"></span>
                  <span class="bar bar-main"></span><span class="bar bar-5"></span><span class="bar bar-6"></span><span class="bar bar-7"></span>
                </div>
              </div>
              <div v-else class="ls-act-icon-wrap" :class="`icon-${item.activity.type}`">
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path
                    :d="item.activity.type === 'timer' ? CLOCK_ICONS.timer : item.activity.type === 'stopwatch' ? CLOCK_ICONS.stopwatch : GLYPHS.moon"
                    :fill="item.activity.type === 'prayer' ? '#00C853' : '#ff9500'"
                  />
                </svg>
              </div>
              <div class="ls-rc-info">
                <div class="ls-overflow-activity-title">{{ item.activity.title }}</div>
                <div class="ls-rc-sub">{{ item.activity.subtitle }}</div>
              </div>
            </template>
            <template v-else>
              <NotificationIcon :type="item.raw.iconType" :size="38" />
              <div class="ls-notif-body">
                <div class="ls-notif-head">
                  <span class="ls-notif-title">{{ i18n.notifTitle(item.raw.appId) }}</span>
                  <span class="ls-notif-time">{{ formatRelativeTime(item.raw.time, i18n.t) }}</span>
                </div>
                <p class="ls-notif-desc">{{ i18n.notifBody(item.raw.appId) }}</p>
              </div>
            </template>
          </div>
        </div>
        </div>
        <div class="ls-scroll-spacer" :style="scrollSpacerStyle"></div>
      </div>

      <!-- 微缩通知胶囊（折叠态） -->
      <div v-if="lockItems.length" class="ls-pill ls-interact" :style="pillStyle" @click="handleExpand">
        <div class="lp-mini">
          <template v-for="(item, idx) in lockItems.slice(0, 3)" :key="item.id">
            <div v-if="item.isActivity" class="lp-mini-rec">
              <span class="rec-dot"></span>
            </div>
            <NotificationIcon v-else :type="item.raw.iconType" :size="22" />
          </template>
        </div>
        <span class="lp-count">{{ notifCountLabel }}</span>
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

    <!-- 灵动岛关闭确认弹窗 -->
    <IslandCloseModal
      :visible="isIslandModalVisible"
      :act="pendingIslandAct"
      @close-once="handleCloseOnce"
      @close-permanent="handleClosePermanent"
      @cancel="handleCancelIslandModal"
    />
  </div>
</template>

<style scoped>
.lock-screen {
  position: absolute;
  inset: 0;
  z-index: var(--z-lock-screen);
  overflow: hidden;
  touch-action: auto;
  cursor: grab;
  background: #000;
}
.lock-screen:active { cursor: grabbing; }

.ls-unlock-surface {
  position: absolute;
  inset: 0;
  z-index: 0;
}

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
  z-index: 1;
  will-change: transform, opacity, filter;
  pointer-events: none;
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
  align-items: flex-start;
  opacity: 0.95;
  will-change: height;
  pointer-events: none;
}
.ls-clock svg {
  width: 85%;
  height: 100%;
  flex: none;
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
  overflow-y: auto;
  overflow-x: clip;
  overscroll-behavior-y: contain;
  scrollbar-width: none;
  touch-action: pan-y;
  pointer-events: auto;
  will-change: clip-path;
}
.ls-clip::-webkit-scrollbar { display: none; }
.ls-scroll-stage {
  position: sticky;
  top: 0;
  height: 100%;
  pointer-events: none;
}
.ls-scroll-stage > * { pointer-events: auto; }
.ls-scroll-spacer {
  width: 1px;
  pointer-events: none;
}

/* removed ls-player css */

/* ---- 通知 / 录音卡片包装器与滑动层 ---- */
.ls-card-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 90px;
  border-radius: 22px;
  overflow: hidden;
  will-change: transform, opacity;
  transform-origin: top center;
}

/* 底层操作按钮区域（默认隐藏，滑动展开时显现） */
.ls-swipe-actions {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 120px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  z-index: 1;
  padding-right: 12px;
  gap: 10px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.ls-swipe-actions.is-active {
  opacity: 1;
  pointer-events: auto;
  z-index: 1;
}

.ls-action-btn {
  border: 0.5px solid rgba(255, 255, 255, 0.45);
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  max-width: 44px;
  max-height: 44px;
  border-radius: 50%;
  flex: none;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  padding: 0;
  box-sizing: border-box;
  will-change: transform, opacity;
}
.ls-action-btn:active {
  transform: scale(0.92);
  background: rgba(255, 255, 255, 0.48);
}
.ls-action-btn svg,
.ls-action-btn :deep(svg) {
  display: block;
  flex: none;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  min-width: 20px;
  min-height: 20px;
}

.ls-btn-settings {
  color: #ffffff;
}
.ls-btn-delete {
  color: #ffffff;
}
.ls-btn-delete:active {
  color: #ff3b30;
}

/* 表层滑块卡片 */
.ls-card-front {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, var(--ls-card-bg-alpha, 0.7));
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
  z-index: 2;
  user-select: none;
  touch-action: pan-y;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.18s linear;
}
.ls-card-front.is-swiping,
.ls-activity-card.is-swiping {
  transition: none !important;
}
.ls-card-front.has-swipe-transition,
.ls-activity-card.has-swipe-transition {
  transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
}
.ls-card-front:active {
  background: rgba(255, 255, 255, 0.82);
}

/* 灵动岛活动卡片深色样式（与灵动岛/通知中心保持一致） */
.ls-card-front.ls-activity-card,
.ls-card-front.is-recorder {
  background: rgba(26, 26, 28, 0.88);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.ls-act-icon-wrap {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ls-act-icon-wrap.icon-alarm {
  background: transparent;
}
.ls-act-icon-wrap.icon-alarm.is-ringing svg {
  animation: alarmRingWiggle 1.4s ease-in-out infinite;
  transform-origin: 17px 17px;
}
@keyframes alarmRingWiggle {
  0%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(-10deg) scale(1.05); }
  20% { transform: rotate(10deg) scale(1.05); }
  30% { transform: rotate(-8deg) scale(1.03); }
  40% { transform: rotate(8deg) scale(1.03); }
  50% { transform: rotate(-3deg); }
  60% { transform: rotate(3deg); }
  70% { transform: rotate(0deg); }
}
.ls-act-icon-wrap.icon-timer,
.ls-act-icon-wrap.icon-stopwatch {
  background: rgba(255, 149, 0, 0.16);
}
.ls-act-icon-wrap.icon-prayer {
  background: rgba(0, 200, 83, 0.16);
}

.ls-act-ctrls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.ls-act-ctrl-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}
.ls-act-ctrl-btn:active {
  transform: scale(0.92);
}
.ls-act-ctrl-btn.btn-cancel,
.ls-act-ctrl-btn.btn-snooze {
  background: rgba(255, 255, 255, 0.16);
}
.ls-act-ctrl-btn.btn-action {
  background: #ff9500;
  box-shadow: 0 4px 14px rgba(255, 149, 0, 0.4);
}

/* 录音卡片内部元素 */
.ls-rc-icon-wrap {
  flex: none;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ls-rc-audio-bars {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 28px;
}
.ls-rc-audio-bars .bar {
  display: inline-block;
  width: 2.5px;
  border-radius: 1.5px;
  background: #ffffff;
}
.ls-rc-audio-bars .bar-1 { height: 14px; animation: lsRcAudioPulse 1.2s infinite alternate 0.1s; }
.ls-rc-audio-bars .bar-2 { height: 8px; animation: lsRcAudioPulse 1.2s infinite alternate 0.3s; }
.ls-rc-audio-bars .bar-3 { height: 20px; animation: lsRcAudioPulse 1.2s infinite alternate 0.15s; }
.ls-rc-audio-bars .bar-main {
  width: 3px;
  height: 26px;
  background: #ff5238;
  animation: lsRcAudioPulseMain 0.9s infinite alternate 0.05s;
}
.ls-rc-audio-bars .bar-5 { height: 11px; animation: lsRcAudioPulse 1.2s infinite alternate 0.4s; }
.ls-rc-audio-bars .bar-6 { height: 6px; animation: lsRcAudioPulse 1.2s infinite alternate 0.2s; }
.ls-rc-audio-bars .bar-7 { height: 4px; animation: lsRcAudioPulse 1.2s infinite alternate 0.5s; }

@keyframes lsRcAudioPulse {
  0% { transform: scaleY(0.45); opacity: 0.6; }
  100% { transform: scaleY(1.15); opacity: 1; }
}
@keyframes lsRcAudioPulseMain {
  0% { transform: scaleY(0.5); }
  100% { transform: scaleY(1.1); }
}

.ls-rc-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.ls-rc-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.ls-overflow-activity-title {
  color: #ffffff;
  font: 700 20px/1.15 var(--font-stack);
  font-variant-numeric: tabular-nums;
}
.ls-rc-sub {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 12.5px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.68);
  margin-top: 2px;
}

.ls-rc-stop-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #eb4436;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
  transition: transform 0.12s ease, background 0.15s ease;
  box-shadow: 0 4px 14px rgba(235, 68, 54, 0.4);
}
.ls-rc-stop-btn:active {
  transform: scale(0.92);
}
.ls-rc-stop-square {
  width: 15px;
  height: 15px;
  border-radius: 3.5px;
  background: #ffffff;
}

/* 普通通知卡片内容 */
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

/* 微缩胶囊里的录音红点 */
.lp-mini-rec {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(235, 68, 54, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}
.rec-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff3b30;
  animation: recDotBlink 1s infinite alternate;
}
@keyframes recDotBlink {
  0% { opacity: 0.5; transform: scale(0.85); }
  100% { opacity: 1; transform: scale(1.1); }
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
