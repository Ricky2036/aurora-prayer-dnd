<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useSystemStore } from '../../stores/systemStore'
import { useNotificationsStore } from '../../stores/notificationsStore'
import { useClock } from '../../composables/useClock'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { getDriver } from '../../composables/driverRegistry'
import NotificationIcon from '../ui/NotificationIcon.vue'
import { formatRelativeTime } from '../../utils/timeFormat'
import { clamp } from '../../utils/math'
import MusicPlayerCard from './MusicPlayerCard.vue'
import MaterialBlur from '../ui/MaterialBlur.vue'
import LIcon from '../ui/LIcon.vue'
import { useI18nStore } from '../../stores/i18nStore'
import { useRecorderStore } from '../../stores/recorderStore'
import { useClockStore } from '../../stores/clockStore'
import { usePrayerStore } from '../../stores/prayerStore'
import { useActiveActivities } from '../../composables/useActiveActivities'
import { CLOCK_ICONS } from '../apps/clock/clockIcons'
import { GLYPHS } from '../../assets/icons/glyphs'

/**
 * 通知中心（移植自 notificationcenter.tsx）：
 * 深色液态玻璃叠层 + 背景流光、音乐播放器卡片、贯通式通知列表、
 * 物理阻尼堆叠算法（滚动时底部卡片堆叠）、悬浮圆形清除按钮。
 * 叠层手势（下拉打开/上滑关闭）由 ScreenView 与 driver 驱动。
 */
const system = useSystemStore()
const i18n = useI18nStore()
const notifications = useNotificationsStore()
const recorder = useRecorderStore()
const clock = useClockStore()
const prayer = usePrayerStore()
const { activeActivities } = useActiveActivities()
const { timeShort, now } = useClock()

const overlay = computed(() => system.overlays.notificationCenter)
const visible = computed(() => overlay.value.status !== 'closed')

const layerStyle = computed(() => {
  const p = overlay.value.progress
  return {
    transform: `translateY(${(p - 1) * 100}%)`,
    visibility: visible.value ? 'visible' : 'hidden',
    pointerEvents: visible.value ? 'auto' : 'none'
  }
})

/** 模糊与暗化随进度插值 */
const blurStyle = computed(() => ({ opacity: clamp(overlay.value.progress * 1.2, 0, 1) }))

/* 打开后面板上滑关闭（驱动与顶部下拉同一 spring） */
const rootRef = ref(null)
const driver = getDriver('notificationCenter')
if (driver) useSwipeGesture(rootRef, driver.closeGesture)

let lastSwipeEndTime = 0
const swipedTransitionId = ref(null)

function onNcClick(e) {
  if (Date.now() - lastSwipeEndTime < 350) return
  // 点击卡片本体、操作按钮、播放器、清除按钮等交互元素内部时，不重置滑开状态也不关闭叠层
  if (e.target.closest('.nc-card, .nc-activity-card, .nc-swipe-card-wrapper, .nc-item-wrapper, .nc-activity-wrapper, .ls-player, .nc-player-instance, .nc-swipe-actions, .nc-action-btn, .nc-clear-fab, .lp-play, button, a, input, label')) {
    return
  }
  // 点击空白处时，如果有滑开的卡片，先收回
  if (Object.keys(swipeOffsets.value).length > 0) {
    swipeOffsets.value = {}
    return
  }
  system.requestCloseOverlay('notificationCenter')
}

/* ---------- 卡片横向滑动（左滑露操作按钮：灵动岛设置 / 删除） ---------- */
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
  if (activeCardId !== id) return
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
    e.preventDefault?.()
    let nextOffset = cardInitialOffset + dx
    if (nextOffset > 0) nextOffset = nextOffset * 0.2
    if (nextOffset < -160) nextOffset = -160 + (nextOffset + 160) * 0.2
    swipeOffsets.value = {
      ...swipeOffsets.value,
      [id]: nextOffset
    }
  }
}

let justSwipedId = null

function onCardPointerUp(e, id) {
  if (activeCardId !== id) return
  if (isSwipingCard) {
    lastSwipeEndTime = Date.now()
    justSwipedId = id
    swipedTransitionId.value = id
    setTimeout(() => {
      if (justSwipedId === id) justSwipedId = null
    }, 300)
    setTimeout(() => {
      if (swipedTransitionId.value === id) swipedTransitionId.value = null
    }, 280)

    const currentOffset = swipeOffsets.value[id] || 0
    if (currentOffset < -45) {
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

function onDeleteCard(id) {
  if (id === '__recorder__' || id === 'recorder') {
    recorder.stopRecording()
  } else if (id === 'timer') {
    clock.cancelTimer()
  } else if (id === 'stopwatch') {
    clock.resetStopwatch()
  } else if (id === 'prayer') {
    prayer.closeIsland()
  } else {
    notifications.remove(id)
  }
  const next = { ...swipeOffsets.value }
  delete next[id]
  swipeOffsets.value = next
}

function onJumpSettings() {
  notifications.setTargetView('notifications', 'dynamicBar')
  system.requestCloseOverlay('notificationCenter')
  system.openApp('settings')
  swipeOffsets.value = {}
}

function onActivityCardClick(act) {
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
  if (act.type === 'recorder') {
    system.openApp('voicememos')
  } else if (act.type === 'timer') {
    clock.setActiveTab('timer')
    system.openApp('clock')
  } else if (act.type === 'stopwatch') {
    clock.setActiveTab('stopwatch')
    system.openApp('clock')
  } else if (act.type === 'prayer') {
    clock.setActiveTab('muslim')
    system.openApp('clock')
  }
  system.requestCloseOverlay('notificationCenter')
}

function handleStopRecording(e) {
  e.stopPropagation()
  recorder.stopRecording()
}

/* ---------- 清除动画 ---------- */
const isClearing = ref(false)
let clearTimer = null
function handleClearAll() {
  if (isClearing.value) return
  isClearing.value = true
  clearTimeout(clearTimer)
  clearTimer = setTimeout(() => {
    notifications.clearAll()
    isClearing.value = false
    clearTimer = null
  }, 800)
}

/* ---------- 底部灵动堆叠算法（底部无空间时才堆叠，位置不变并缩放至完全遮挡） ---------- */
const listRef = ref(null)
let rafId = null

function updateStacking() {
  rafId = null
  const container = listRef.value
  if (!container || overlay.value.status === 'closed') return
  const containerHeight = container.clientHeight
  if (!containerHeight) return

  const wrappers = container.querySelectorAll('.nc-item-wrapper')
  if (!wrappers.length) return

  // 只有当卡片触及视口底部安全区时才开始堆叠（允许通知与底部清除按钮重叠，保留适度安全间距）
  const bottomThreshold = containerHeight - 26
  const scrollTop = container.scrollTop

  // 批量只读测量，彻底避免循环内读写交替引发强制同步重排 (Layout Thrashing)
  const items = []
  for (let i = 0; i < wrappers.length; i++) {
    const w = wrappers[i]
    const card = w.querySelector('.nc-card')
    items.push({
      card,
      content: card ? card.querySelector('.nc-card-body') : null,
      icon: card ? card.querySelector('.notif-icon') : null,
      chevron: card ? card.querySelector('.nc-card-chevron') : null,
      id: w.dataset.id,
      offsetTop: w.offsetTop,
      offsetHeight: w.offsetHeight
    })
  }

  // 批量样式写入
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const card = item.card
    if (!card) continue
    const swipeX = swipeOffsets.value[item.id] || 0
    const relativeY = item.offsetTop - scrollTop
    const cardBottom = relativeY + item.offsetHeight

    // 只有当卡片真实底部超过视口底线时才形成层叠
    if (cardBottom > bottomThreshold) {
      const excess = cardBottom - bottomThreshold
      const stackIndex = excess / 48
      if (stackIndex <= 3.5) {
        const scale = Math.max(0.82, 1 - stackIndex * 0.05)
        const visualY = stackIndex <= 1 ? stackIndex * 12 : (12 + (stackIndex - 1) * 8)
        card.style.transform = `translateX(${swipeX}px) translate3d(0, ${-excess + visualY}px, 0) scale(${scale})`
        card.style.opacity = '1'
        card.style.filter = ''
        card.style.pointerEvents = 'auto'

        // 堆叠在后方的卡片文字与图标渐隐（iOS 经典堆叠机制：底层卡片只保留圆角底板轮廓，不露内部文字内容）
        const contentOpacity = Math.max(0, 1 - stackIndex * 2.2)
        if (item.content) item.content.style.opacity = contentOpacity < 0.99 ? contentOpacity : ''
        if (item.icon) item.icon.style.opacity = contentOpacity < 0.99 ? contentOpacity : ''
        if (item.chevron) item.chevron.style.opacity = contentOpacity < 0.99 ? contentOpacity : ''
      } else {
        card.style.transform = `translateX(${swipeX}px) translate3d(0, ${-excess + 32}px, 0) scale(0.8)`
        card.style.opacity = 0
        card.style.filter = ''
        card.style.pointerEvents = 'none'
        if (item.content) item.content.style.opacity = 0
        if (item.icon) item.icon.style.opacity = 0
        if (item.chevron) item.chevron.style.opacity = 0
      }
    } else {
      card.style.transform = swipeX ? `translateX(${swipeX}px) translate3d(0, 0, 0) scale(1)` : ''
      card.style.opacity = ''
      card.style.filter = ''
      card.style.pointerEvents = ''
      if (item.content) item.content.style.opacity = ''
      if (item.icon) item.icon.style.opacity = ''
      if (item.chevron) item.chevron.style.opacity = ''
    }
  }
}

function onScroll() {
  if (rafId == null) rafId = requestAnimationFrame(updateStacking)
}

watch(() => notifications.list.length, async () => {
  await nextTick()
  updateStacking()
})

watch(() => activeActivities.value.length, async () => {
  await nextTick()
  updateStacking()
})

watch(swipeOffsets, () => {
  if (rafId == null) rafId = requestAnimationFrame(updateStacking)
}, { deep: true })

watch(() => overlay.value.status, async (status) => {
  if (status === 'open') {
    await nextTick()
    setTimeout(updateStacking, 30)
  }
})

let mountTimer = null
onMounted(() => {
  mountTimer = setTimeout(() => {
    updateStacking()
    mountTimer = null
  }, 100)
})

onBeforeUnmount(() => {
  clearTimeout(clearTimer)
  clearTimeout(mountTimer)
  clearTimer = null
  mountTimer = null
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
})

/* 星期/日期 */
/* 星期与月日走 i18n：英文是 Tue / Sep 8，中文是 周二 / 9月8日 */
const weekday = computed(() => (i18n.currentWeekDays || [])[now.value.getDay()] || '')
const monthDay = computed(() => i18n.t('monthDay')(i18n.monthNames[now.value.getMonth()] || now.value.getMonth() + 1, now.value.getDate()))

/* 卡片点击展开描述 */
const expandedId = ref(null)
function toggleExpand(id) {
  if (isSwipingCard) return
  if (justSwipedId === id) {
    justSwipedId = null
    return
  }
  if (swipeOffsets.value[id]) {
    const next = { ...swipeOffsets.value }
    delete next[id]
    swipeOffsets.value = next
    return
  }
  expandedId.value = expandedId.value === id ? null : id
}

watch(expandedId, async () => {
  await nextTick()
  updateStacking()
})
</script>

<template>
  <div ref="rootRef" class="notification-center" :style="layerStyle" @click="onNcClick">
    <!-- 动态高斯模糊与材质混色底 -->
    <MaterialBlur />

    <div class="nc-content">
      <!-- 时间/日期标题 -->
      <div class="nc-title">
        <span class="nc-title-time">{{ timeShort }}</span>
        <div class="nc-title-date">
          <span>{{ weekday }}</span>
          <span>{{ monthDay }}</span>
        </div>
      </div>

      <!-- 贯通式列表 -->
      <div ref="listRef" class="nc-list scrollable" @scroll.passive="onScroll">
        <!-- 灵动岛活动卡片队列：同步所有活跃灵动岛（不设数量上限，有几个显示几个） -->
        <template v-for="act in activeActivities" :key="act.id">
          <div class="nc-swipe-card-wrapper nc-activity-wrapper">
            <!-- 底层滑动操作按钮 -->
            <div class="nc-swipe-actions" :class="{ 'is-active': (swipeOffsets[act.id] || 0) < -2 }">
              <button class="nc-action-btn nc-btn-settings" @click.stop="onJumpSettings" :title="i18n.t('islandSettings')">
                <LIcon name="headerSettings" :size="20" />
              </button>
              <button class="nc-action-btn nc-btn-delete" @click.stop="onDeleteCard(act.id)" :title="i18n.t('delete')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>

            <!-- 表层活动卡片主体 -->
            <div
              class="nc-activity-card"
              :class="[`is-${act.type}`, { 'is-swiping': isSwipingCard && activeCardId === act.id }]"
              :style="{ transform: `translateX(${swipeOffsets[act.id] || 0}px)` }"
              @pointerdown="onCardPointerDown($event, act.id)"
              @pointermove="onCardPointerMove($event, act.id)"
              @pointerup="onCardPointerUp($event, act.id)"
              @pointercancel="onCardPointerUp($event, act.id)"
              @click.stop="onActivityCardClick(act)"
            >
              <!-- 录音类型 -->
              <template v-if="act.type === 'recorder'">
                <div class="nc-rc-left">
                  <div class="nc-rc-audio-bars">
                    <span class="bar bar-1"></span>
                    <span class="bar bar-2"></span>
                    <span class="bar bar-3"></span>
                    <span class="bar bar-main"></span>
                    <span class="bar bar-5"></span>
                    <span class="bar bar-6"></span>
                    <span class="bar bar-7"></span>
                  </div>
                </div>
                <div class="nc-rc-info">
                  <div class="nc-rc-time">{{ act.title }}</div>
                  <div class="nc-rc-sub">{{ act.subtitle }}</div>
                </div>
                <button class="nc-rc-stop-btn" @click.stop="handleStopRecording" title="停止录音">
                  <div class="nc-rc-stop-square"></div>
                </button>
              </template>

              <!-- 定时器类型 -->
              <template v-else-if="act.type === 'timer'">
                <div class="nc-act-icon-wrap icon-timer">
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path :d="CLOCK_ICONS.timer" fill="#ff9500" />
                  </svg>
                </div>
                <div class="nc-rc-info">
                  <div class="nc-rc-time">{{ act.title }}</div>
                  <div class="nc-rc-sub">{{ act.subtitle }}</div>
                </div>
                <div class="nc-act-ctrls">
                  <button class="nc-act-ctrl-btn btn-cancel" @click.stop="clock.cancelTimer()" title="取消">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.close" fill="#fff" /></svg>
                  </button>
                  <button
                    class="nc-act-ctrl-btn btn-action"
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
                <div class="nc-act-icon-wrap icon-stopwatch">
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path :d="CLOCK_ICONS.stopwatch" fill="#ff9500" />
                  </svg>
                </div>
                <div class="nc-rc-info">
                  <div class="nc-rc-time">{{ act.title }}</div>
                  <div class="nc-rc-sub">{{ act.subtitle }}</div>
                </div>
                <div class="nc-act-ctrls">
                  <button
                    v-if="clock.stopwatch.status === 'running'"
                    class="nc-act-ctrl-btn btn-cancel"
                    @click.stop="clock.recordLap()"
                    title="计次"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.lap" fill="#fff" /></svg>
                  </button>
                  <button
                    v-else
                    class="nc-act-ctrl-btn btn-cancel"
                    @click.stop="clock.resetStopwatch()"
                    title="重置"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.close" fill="#fff" /></svg>
                  </button>
                  <button
                    class="nc-act-ctrl-btn btn-action"
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
                <div class="nc-act-icon-wrap icon-prayer">
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path :d="GLYPHS.moon" fill="#00C853" />
                  </svg>
                </div>
                <div class="nc-rc-info">
                  <div class="nc-rc-time">{{ act.title }}</div>
                  <div class="nc-rc-sub">{{ act.subtitle }}</div>
                </div>
                <div class="nc-act-ctrls">
                  <button class="nc-act-ctrl-btn btn-cancel" @click.stop="prayer.closeIsland()" title="关闭">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path :d="CLOCK_ICONS.close" fill="#fff" /></svg>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </template>

        <!-- 音乐播放器卡片 -->
        <MusicPlayerCard class="nc-player-instance" />

        <!-- 通知列表 -->
        <template v-if="notifications.list.length">
          <div
            v-for="(n, idx) in notifications.list"
            :key="n.id"
            class="nc-item-wrapper nc-swipe-card-wrapper"
            :class="{ clearing: isClearing }"
            :data-id="n.id"
            :style="{ transitionDelay: isClearing ? idx * 40 + 'ms' : '0ms', zIndex: notifications.list.length - idx }"
          >
            <!-- 底层滑动操作按钮 -->
            <div class="nc-swipe-actions" :class="{ 'is-active': (swipeOffsets[n.id] || 0) < -2 }">
              <button class="nc-action-btn nc-btn-settings" @click.stop="onJumpSettings" :title="i18n.t('islandSettings')">
                <LIcon name="headerSettings" :size="20" />
              </button>
              <button class="nc-action-btn nc-btn-delete" @click.stop="onDeleteCard(n.id)" :title="i18n.t('delete')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            </div>

            <!-- 表层通知卡片主体 -->
            <div
              class="nc-card"
              :class="{
                expanded: expandedId === n.id,
                'is-swiping': isSwipingCard && activeCardId === n.id,
                'has-swipe-transition': !isSwipingCard && swipedTransitionId === n.id
              }"
              @pointerdown="onCardPointerDown($event, n.id)"
              @pointermove="onCardPointerMove($event, n.id)"
              @pointerup="onCardPointerUp($event, n.id)"
              @pointercancel="onCardPointerUp($event, n.id)"
              @click.stop="toggleExpand(n.id)"
            >
              <NotificationIcon :type="n.iconType" />
              <div class="nc-card-body">
                <div class="nc-card-head">
                  <span class="nc-card-title">{{ i18n.notifTitle(n.appId) }}</span>
                  <span class="nc-card-time">{{ formatRelativeTime(n.time, i18n.t) }}</span>
                </div>
                <p class="nc-card-desc" :class="{ 'line-clamp-2': expandedId !== n.id }">{{ i18n.notifBody(n.appId) }}</p>
              </div>
              <svg class="nc-card-chevron" :class="{ flipped: expandedId === n.id }" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
        </template>
        <div v-else class="nc-empty">
          <div class="nc-empty-title">{{ i18n.t('noOlderNotifs') }}</div>
        </div>
      </div>
    </div>

    <!-- 悬浮圆形清除按钮 -->
    <button
      v-if="notifications.list.length"
      class="nc-clear-fab"
      :title="i18n.t('clearAllNotifs')"
      @click.stop="handleClearAll"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
    </button>
  </div>
</template>

<style scoped>
.notification-center {
  position: absolute;
  inset: 0;
  z-index: var(--z-notification-center);
  overflow: hidden;
  will-change: transform;
  /* background 已经交由底层的 MaterialBlur 组件负责 */
}

.nc-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}
.nc-content > * { pointer-events: auto; }

/* 时间/日期标题 */
.nc-title {
  flex: none;
  display: flex;
  align-items: flex-end;
  padding: calc(var(--safe-top) + 10px) 24px 8px 24px;
  color: #fff;
  z-index: 2;
}
.nc-title-time {
  font: 300 62px/1 var(--font-stack);
  letter-spacing: -2px;
  text-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  font-variant-numeric: tabular-nums;
}
.nc-title-date {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
  padding-bottom: 3px;
  opacity: 0.85;
  font: 500 15px/1.3 var(--font-stack);
}

/* 贯通式列表：全屏边缘贴合，卡片滑动至屏幕边缘直接被视口裁切，允许与底部删除按钮重叠 */
.nc-list {
  position: relative;
  flex: 1;
  margin: 4px 0 0;
  padding: 6px 14px 48px;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: clip;
  overscroll-behavior-y: contain;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.nc-list::-webkit-scrollbar { display: none; }
.nc-list { scrollbar-width: none; }

.nc-activity-card,
.nc-recorder-card {
  flex: none;
  position: relative;
  z-index: 6;
  width: 100%;
  height: 84px;
  border-radius: 26px;
  background: rgba(20, 20, 24, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 18px;
  cursor: pointer;
  margin-bottom: 0;
  user-select: none;
  touch-action: pan-y;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease;
}
.nc-activity-card:active,
.nc-recorder-card:active {
  background: rgba(22, 22, 26, 0.95);
}

.nc-act-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.nc-act-icon-wrap.icon-timer,
.nc-act-icon-wrap.icon-stopwatch {
  background: rgba(255, 149, 0, 0.16);
}
.nc-act-icon-wrap.icon-prayer {
  background: rgba(0, 200, 83, 0.16);
}

.nc-act-ctrls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.nc-act-ctrl-btn {
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
.nc-act-ctrl-btn:active {
  transform: scale(0.92);
}
.nc-act-ctrl-btn.btn-cancel {
  background: rgba(255, 255, 255, 0.16);
}
.nc-act-ctrl-btn.btn-action {
  background: #ff9500;
  box-shadow: 0 4px 14px rgba(255, 149, 0, 0.4);
}

.nc-rc-left {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 44px;
  height: 44px;
}
.nc-rc-audio-bars {
  display: flex;
  align-items: center;
  gap: 3.5px;
  height: 32px;
}
.nc-rc-audio-bars .bar {
  display: inline-block;
  width: 3px;
  border-radius: 1.5px;
  background: #ffffff;
}
.nc-rc-audio-bars .bar-1 { height: 16px; animation: ncRcAudioPulse 1.2s infinite alternate 0.1s; }
.nc-rc-audio-bars .bar-2 { height: 10px; animation: ncRcAudioPulse 1.2s infinite alternate 0.3s; }
.nc-rc-audio-bars .bar-3 { height: 22px; animation: ncRcAudioPulse 1.2s infinite alternate 0.15s; }
.nc-rc-audio-bars .bar-main {
  width: 3.5px;
  height: 30px;
  background: #ff5238;
  animation: ncRcAudioPulseMain 0.9s infinite alternate 0.05s;
}
.nc-rc-audio-bars .bar-5 { height: 12px; animation: ncRcAudioPulse 1.2s infinite alternate 0.4s; }
.nc-rc-audio-bars .bar-6 { height: 6px; animation: ncRcAudioPulse 1.2s infinite alternate 0.2s; }
.nc-rc-audio-bars .bar-7 { height: 4px; animation: ncRcAudioPulse 1.2s infinite alternate 0.5s; }

@keyframes ncRcAudioPulse {
  0% { transform: scaleY(0.45); opacity: 0.6; }
  100% { transform: scaleY(1.15); opacity: 1; }
}
@keyframes ncRcAudioPulseMain {
  0% { transform: scaleY(0.5); }
  100% { transform: scaleY(1.1); }
}

.nc-rc-info {
  flex: 1;
  min-width: 0;
  margin-left: 12px;
  margin-right: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.nc-rc-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.nc-rc-sub {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.68);
  margin-top: 3px;
  letter-spacing: -0.1px;
}

.nc-rc-stop-btn {
  width: 46px;
  height: 46px;
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
.nc-rc-stop-btn:hover {
  background: #f05244;
  transform: scale(1.04);
}
.nc-rc-stop-btn:active {
  transform: scale(0.92);
}
.nc-rc-stop-square {
  width: 17px;
  height: 17px;
  border-radius: 4px;
  background: #ffffff;
}

.nc-player-instance {
  flex: none;
  position: relative;
  z-index: 5;
  margin-bottom: 0;
  box-shadow: none !important;
}

/* ---- 滑动容器与底层操作按钮 ---- */
.nc-swipe-card-wrapper {
  flex: none;
  position: relative;
  border-radius: 24px;
  overflow: visible;
  will-change: transform;
}

.nc-recorder-wrapper {
  margin-bottom: 3px;
  height: 84px;
}

.nc-swipe-actions {
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
.nc-swipe-actions.is-active {
  opacity: 1;
  pointer-events: auto;
}

.nc-action-btn {
  border: none;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  max-width: 44px;
  max-height: 44px;
  border-radius: 50%;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  cursor: pointer;
  transition: transform 0.12s ease, opacity 0.15s ease;
  padding: 0;
  box-sizing: border-box;
}
.nc-action-btn:active {
  transform: scale(0.92);
  opacity: 0.85;
}
.nc-action-btn svg,
.nc-action-btn :deep(svg) {
  display: block;
  flex: none;
}

.nc-btn-settings {
  background: rgba(80, 80, 86, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.nc-btn-delete {
  background: #ff3b30;
}

/* ---- 通知卡片 ---- */
.nc-item-wrapper {
  flex: none;
  transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.5s ease;
  transform-origin: top;
  position: relative;
}
.nc-item-wrapper.clearing {
  transform: translateX(120%);
  opacity: 0;
}
.nc-card {
  position: relative;
  z-index: 2;
  user-select: none;
  touch-action: pan-y;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: none;
  cursor: pointer;
  transition: background 0.2s ease;
  transform-origin: center center;
}
.nc-card.is-swiping,
.nc-activity-card.is-swiping,
.nc-recorder-card.is-swiping {
  transition: none !important;
}
.nc-card.has-swipe-transition {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
.nc-card:hover { background: rgba(255, 255, 255, 0.12); }
.nc-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.nc-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.nc-card-title {
  color: #fff;
  font: 600 15px/1.2 var(--font-stack);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nc-card-time { color: rgba(255, 255, 255, 0.55); font: 400 12px/1.2 var(--font-stack); flex: none; }
.nc-card-desc {
  color: rgba(255, 255, 255, 0.72);
  font: 400 14px/1.45 var(--font-stack);
  margin-top: 2px;
}
.nc-card-desc.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.nc-card-chevron {
  flex: none;
  color: rgba(255, 255, 255, 0.5);
  transition: transform 0.3s ease;
}
.nc-card-chevron.flipped { transform: rotate(180deg); }

.nc-empty { flex: 1; display: flex; align-items: center; justify-content: center; }
.nc-empty-title {
  font: var(--text-subhead);
  color: rgba(255, 255, 255, 0.65);
}

/* 悬浮圆形清除按钮 */
.nc-clear-fab {
  position: absolute;
  left: 50%;
  bottom: 42px;
  transform: translateX(-50%);
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease;
  z-index: 60; /* 高于通知卡片的动态 zIndex（20-idx），保证永不被盖住 */
}
.nc-clear-fab:hover { background: rgba(255, 59, 48, 0.5); }
.nc-clear-fab:active { transform: translateX(-50%) scale(0.88); }
</style>
