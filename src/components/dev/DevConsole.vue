<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useControlStore, LAYOUT_PRESETS } from '../../stores/controlStore'
import { useSystemStore } from '../../stores/systemStore'
import { usePrayerStore } from '../../stores/prayerStore'
import { useClockStore } from '../../stores/clockStore'
import { useI18nStore } from '../../stores/i18nStore'
import { useRecorderStore } from '../../stores/recorderStore'
import { useNotificationsStore } from '../../stores/notificationsStore'
import { useCapture } from '../../composables/useCapture'
import { CLOCK_ICONS } from '../apps/clock/clockIcons'
import { GLYPHS } from '../../assets/icons/glyphs'
import LIcon from '../ui/LIcon.vue'

/* 微调面板改为按需异步加载 */
const ControlCenterFineTunePanel = defineAsyncComponent(() =>
  import('./ControlCenterFineTunePanel.vue')
)

const props = defineProps({
  mode: {
    type: String,
    default: 'desktop' // 'desktop' | 'mobile'
  },
  isRecording: {
    type: Boolean,
    default: false
  },
  isTranscoding: {
    type: Boolean,
    default: false
  },
  recordWithFrame: {
    type: Boolean,
    default: false
  },
  /** 控制台「带壳截图」开关状态（由 App.vue 经 v-model 传入） */
  screenshotWithFrame: {
    type: Boolean,
    default: false
  },
  /** 截图进行中：禁用按钮 + 显示「截取中...」 */
  isCapturing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'toggle-recording',
  'update:recordWithFrame',
  'capture-screenshot',
  'update:screenshotWithFrame'
])

const control = useControlStore()
const system = useSystemStore()
const prayerStore = usePrayerStore()
const clockStore = useClockStore()
const recorderStore = useRecorderStore()
const notificationsStore = useNotificationsStore()
const i18n = useI18nStore()

if (typeof window !== 'undefined') {
  window.__clock = clockStore
  window.__recorder = recorderStore
}

/** 默认布局按「系列」分行：tOS 16 / tOS 17 / EE1，每行同样是 CAMON / NOTE / GT */
const presetSeries = computed(() => [
  { key: '16', tag: 'tOS 16', presets: LAYOUT_PRESETS.filter((p) => (p.series || '16') === '16') },
  { key: '17', tag: 'tOS 17', presets: LAYOUT_PRESETS.filter((p) => p.series === '17') },
  { key: 'ee1', tag: 'EE1', presets: LAYOUT_PRESETS.filter((p) => p.series === 'ee1') }
])

function usePresetThumb() {
  const rowsRef = ref(null)
  const thumbStyle = ref({ opacity: 0 })
  const ready = ref(false)
  let ro = null

  function syncThumb() {
    const el = rowsRef.value
    if (!el) return
    const btn = el.querySelector('.pc-seg-btn.on')
    if (!btn) {
      thumbStyle.value = { ...thumbStyle.value, opacity: 0 }
      return
    }
    const c = el.getBoundingClientRect()
    const b = btn.getBoundingClientRect()
    thumbStyle.value = {
      width: `${b.width}px`,
      height: `${b.height}px`,
      transform: `translate(${b.left - c.left}px, ${b.top - c.top}px)`,
      opacity: 1
    }
  }

  function attach() {
    const el = rowsRef.value
    if (!el) return
    syncThumb()
    requestAnimationFrame(() => { ready.value = true })
    if (typeof ResizeObserver !== 'undefined') {
      if (ro) ro.disconnect()
      ro = new ResizeObserver(() => syncThumb())
      ro.observe(el)
    }
  }

  onMounted(attach)
  watch(rowsRef, (el) => { if (el) nextTick(attach) })
  onBeforeUnmount(() => { if (ro) ro.disconnect() })
  watch(() => control.layoutPreset, () => nextTick(syncThumb))

  return { rowsRef, thumbStyle, ready, syncThumb }
}

const desktopPresetThumb = usePresetThumb()
const mobilePresetThumb = usePresetThumb()
const desktopRowsRef = desktopPresetThumb.rowsRef
const mobileRowsRef = mobilePresetThumb.rowsRef

/* ================= 模块下拉选择器状态 ================= */
const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
const initialModule = (urlParams?.get('overlay') === 'controlCenter' || urlParams?.get('finetune') === '1' || urlParams?.get('tab') === 'control' || urlParams?.get('module') === 'control')
  ? 'control'
  : (urlParams?.get('tab') === 'island' || urlParams?.get('module') === 'island')
    ? 'island'
    : (urlParams?.get('tab') === 'prayer' || urlParams?.get('tab') === 'muslim' || urlParams?.get('module') === 'muslim')
      ? 'muslim'
      : 'island'

const selectedModule = ref(initialModule) // 'control' | 'island' | 'muslim'

watch(selectedModule, (mod) => {
  if (mod === 'control') {
    nextTick(() => {
      desktopPresetThumb.syncThumb()
      mobilePresetThumb.syncThumb()
    })
  }
})

/* ================= 系统应用灵动岛开关与应用状态联动 ================= */
function toggleAlarmIsland() {
  if (clockStore.isAlarmActive) {
    clockStore.dismissAlarm()
  } else {
    notificationsStore.setIslandEnabled('alarm', true)
    clockStore.triggerAlarm()
  }
}

function toggleStopwatchIsland() {
  if (clockStore.isStopwatchActive) {
    clockStore.resetStopwatch()
  } else {
    notificationsStore.setIslandEnabled('stopwatch', true)
    clockStore.startStopwatch()
    if (system.activeAppId === 'clock') {
      system.closeApp()
    }
  }
}

function toggleTimerIsland() {
  if (clockStore.isTimerActive) {
    clockStore.cancelTimer()
  } else {
    notificationsStore.setIslandEnabled('timer', true)
    if (clockStore.timer.totalDuration <= 0) {
      clockStore.setTimerDuration(0, 5, 0)
    }
    clockStore.startTimer()
    if (system.activeAppId === 'clock') {
      system.closeApp()
    }
  }
}

function toggleRecorderIsland() {
  if (recorderStore.isRecording) {
    recorderStore.stopRecording()
  } else {
    notificationsStore.setIslandEnabled('recorder', true)
    recorderStore.startRecording()
    if (system.activeAppId === 'voicememos') {
      system.closeApp()
    }
  }
}

function toggleMediaIsland() {
  if (control.mediaActive) {
    control.dismissMediaImmediately()
  } else {
    notificationsStore.setIslandEnabled('media', true)
    control.mediaActive = true
    control.mediaPlaying = true
  }
}

/* ================= 移动端悬浮球与弹窗状态 ================= */
const isDrawerOpen = ref(false)
const fabPos = ref({ x: 0, y: 0 })
const isSnapping = ref(false)

let isPointerDown = false
let startPointer = { x: 0, y: 0 }
let startFab = { x: 0, y: 0 }
let startTime = 0
let hasMoved = false
let modalOpenedTime = 0

function openModal() {
  isDrawerOpen.value = true
  modalOpenedTime = Date.now()
}

function closeModal() {
  isDrawerOpen.value = false
}

function toggleModal() {
  if (isDrawerOpen.value) {
    closeModal()
  } else {
    openModal()
  }
}

/* ================= 全屏模式控制 (Chrome / Android / PC) ================= */
const isFullscreen = ref(false)

function updateFullscreenState() {
  isFullscreen.value = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  )
}

function toggleFullscreen() {
  const doc = document
  const docEl = document.documentElement

  const requestFs =
    docEl.requestFullscreen ||
    docEl.webkitRequestFullscreen ||
    docEl.mozRequestFullScreen ||
    docEl.msRequestFullscreen

  const exitFs =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen

  if (!isFullscreen.value) {
    if (requestFs) {
      requestFs.call(docEl).then(() => {
        isFullscreen.value = true
      }).catch((err) => {
        console.warn('Fullscreen request failed:', err)
      })
    }
  } else {
    if (exitFs) {
      exitFs.call(doc).then(() => {
        isFullscreen.value = false
      }).catch((err) => {
        console.warn('Exit fullscreen failed:', err)
      })
    }
  }
}

function initFabPosition() {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  const h = window.innerHeight
  fabPos.value = {
    x: Math.max(12, w - 64),
    y: Math.max(80, h - 190)
  }
}

onMounted(() => {
  initFabPosition()
  updateFullscreenState()
  window.addEventListener('resize', handleWindowResize)
  document.addEventListener('fullscreenchange', updateFullscreenState)
  document.addEventListener('webkitfullscreenchange', updateFullscreenState)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
  document.removeEventListener('fullscreenchange', updateFullscreenState)
  document.removeEventListener('webkitfullscreenchange', updateFullscreenState)
})

function handleWindowResize() {
  if (props.mode === 'mobile') {
    snapToEdge()
  }
}

function onFabPointerDown(e) {
  if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return
  isPointerDown = true
  hasMoved = false
  isSnapping.value = false
  startTime = Date.now()
  startPointer = { x: e.clientX, y: e.clientY }
  startFab = { ...fabPos.value }

  try {
    e.currentTarget?.setPointerCapture?.(e.pointerId)
  } catch (err) {}
}

function onFabPointerMove(e) {
  if (!isPointerDown) return
  const dx = e.clientX - startPointer.x
  const dy = e.clientY - startPointer.y
  const dist = Math.hypot(dx, dy)

  if (!hasMoved && dist > 8) {
    hasMoved = true
  }

  if (hasMoved) {
    const w = window.innerWidth
    const h = window.innerHeight
    const newX = Math.max(8, Math.min(w - 56, startFab.x + dx))
    const newY = Math.max(48, Math.min(h - 80, startFab.y + dy))
    fabPos.value = { x: newX, y: newY }
  }
}

function onFabPointerUp(e) {
  if (!isPointerDown) return
  isPointerDown = false
  const elapsed = Date.now() - startTime
  const dx = e.clientX - startPointer.x
  const dy = e.clientY - startPointer.y
  const dist = Math.hypot(dx, dy)

  try {
    e.currentTarget?.releasePointerCapture?.(e.pointerId)
  } catch (err) {}
  
  if (hasMoved && (dist >= 8 || elapsed >= 300)) {
    snapToEdge()
  }
}

function onFabClick(e) {
  e.stopPropagation()
  if (!hasMoved) {
    toggleModal()
  }
}

function onBackdropClick(e) {
  if (Date.now() - modalOpenedTime < 350) return
  if (e.target === e.currentTarget) {
    closeModal()
  }
}

function snapToEdge() {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  const h = window.innerHeight
  isSnapping.value = true

  const snapX = fabPos.value.x < w / 2 ? 14 : w - 62
  const clampY = Math.max(54, Math.min(h - 90, fabPos.value.y))
  fabPos.value = { x: snapX, y: clampY }

  setTimeout(() => {
    isSnapping.value = false
  }, 320)
}

/* 录屏计时单例 */
const { recordElapsed } = useCapture()

/* 通用「带壳」选项：联动控制录屏带壳与截图带壳 */
const withFrame = computed(() => props.recordWithFrame && props.screenshotWithFrame)

function toggleWithFrame(checked) {
  emit('update:recordWithFrame', checked)
  emit('update:screenshotWithFrame', checked)
}

/* 图标微调快捷操作 */
function onToggleFineTune(enabled) {
  control.setFineTuningMode(enabled)
  if (enabled) {
    system.unlock()
    system.settleOverlay('controlCenter', true)
  }
}
</script>

<template>
  <!-- ================= 1. 桌面侧边栏模式 ================= -->
  <aside v-if="mode === 'desktop'" class="proto-console">
    <!-- 背景流光 -->
    <div class="pc-glow"></div>

    <!-- 顶部标题栏：左上角全屏，右上角亮灭屏，居中标题 -->
    <header class="pc-header">
      <button
        class="pc-header-icon-btn"
        @click="toggleFullscreen"
        :title="isFullscreen ? '退出全屏' : '全屏'"
        aria-label="切换全屏"
      >
        <svg v-if="!isFullscreen" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
        <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
        </svg>
      </button>

      <h2 class="pc-title">控制台</h2>

      <button
        class="pc-header-icon-btn"
        :class="system.screenOn ? 'is-active-power' : 'is-off-power'"
        @click="system.screenOn ? system.powerOff() : system.powerOn()"
        :title="system.screenOn ? '灭屏' : '亮屏'"
        aria-label="系统亮灭屏"
      >
        <svg v-if="system.screenOn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
        <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
        </svg>
      </button>
    </header>

    <!-- 常用功能：截屏录屏合一卡片（带壳作为通用选项置于标题右侧，按钮精简） -->
    <div class="pc-card">
      <div class="pc-card-header">
        <span class="pc-card-title">截屏录屏</span>
        <label class="pc-switch-wrap">
          <span>带壳</span>
          <input type="checkbox" :checked="withFrame" @change="toggleWithFrame($event.target.checked)" />
          <div class="pc-switch"></div>
        </label>
      </div>
      <div class="pc-btn-group-2">
        <!-- 录屏动作按钮 -->
        <button
          class="pc-btn"
          :class="isTranscoding ? 'pc-btn-disabled' : isRecording ? 'pc-btn-danger' : 'pc-btn-primary'"
          :disabled="isTranscoding"
          @click="emit('toggle-recording')"
        >
          <template v-if="isTranscoding">
            <span class="pc-rec-spin">⏳</span>
            <span>转码中...</span>
          </template>
          <template v-else-if="isRecording">
            <LIcon name="video" :size="14" />
            <span>停止 · {{ recordElapsed }}</span>
          </template>
          <template v-else>
            <LIcon name="video" :size="14" />
            <span>录屏</span>
          </template>
        </button>

        <!-- 截屏动作按钮 -->
        <button
          class="pc-btn pc-btn-secondary"
          :class="isCapturing ? 'pc-btn-disabled' : ''"
          :disabled="isCapturing"
          @click="emit('capture-screenshot')"
        >
          <LIcon name="scissors" :size="14" />
          <span>{{ isCapturing ? '截取中...' : '截屏' }}</span>
        </button>
      </div>
    </div>

    <!-- 下拉选择控件：切换模块 -->
    <div class="pc-module-selector-wrap">
      <label for="desktop-module-select" class="pc-module-label">切换模块</label>
      <div class="pc-select-wrapper">
        <select id="desktop-module-select" v-model="selectedModule" class="pc-module-select">
          <option value="island">灵动岛</option>
          <option value="muslim">礼拜模式</option>
          <option value="control">控制中心</option>
        </select>
        <svg class="pc-select-arrow" viewBox="0 0 20 20" fill="none">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="m6 8 4 4 4-4"/>
        </svg>
      </div>
    </div>

    <!-- 单一模块大卡片：所有设置项收纳于一张大卡内，按需用虚线分割 -->
    <main class="pc-content-body">
      <Transition name="tab-fade" mode="out-in">
        <div class="pc-card pc-module-big-card" :key="selectedModule">
          <!-- 模块 1: 控制中心 -->
          <div v-if="selectedModule === 'control'" class="pc-module-section-group">
            <!-- 区域 1：默认布局 -->
            <div class="pc-section">
              <div class="pc-card-header">
                <span class="pc-card-title">默认布局</span>
              </div>
              <div class="pc-preset-rows" ref="desktopRowsRef">
                <div
                  class="pc-preset-thumb"
                  :class="{ 'is-ready': desktopPresetThumb.ready.value }"
                  :style="desktopPresetThumb.thumbStyle.value"
                ></div>
                <div class="pc-preset-row" v-for="s in presetSeries" :key="s.key">
                  <span class="pc-preset-tag">{{ s.tag }}</span>
                  <div class="pc-seg">
                    <button
                      v-for="p in s.presets"
                      :key="p.id"
                      class="pc-seg-btn"
                      :class="{ on: control.layoutPreset === p.id }"
                      @click="control.setLayoutPreset(p.id)"
                    >
                      {{ p.shortLabel || p.label }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 虚线分割 -->
            <div class="pc-divider-dashed"></div>

            <!-- 区域 2：编辑算法 -->
            <div class="pc-section">
              <div class="pc-card-header">
                <span class="pc-card-title">编辑算法</span>
              </div>
              <div class="pc-seg">
                <div
                  class="pc-seg-thumb"
                  :style="{ transform: control.dragMode === 'flow' ? 'translateX(0)' : 'translateX(100%)' }"
                ></div>
                <button
                  class="pc-seg-btn"
                  :class="{ on: control.dragMode === 'flow' }"
                  @click="control.setDragMode('flow')"
                >
                  流式推挤
                </button>
                <button
                  class="pc-seg-btn"
                  :class="{ on: control.dragMode === 'swap' }"
                  @click="control.setDragMode('swap')"
                >
                  坐标沉降
                </button>
              </div>
            </div>

            <!-- 虚线分割 -->
            <div class="pc-divider-dashed"></div>

            <!-- 区域 3：隐私指示 + 双卡显示（一行两列并排） -->
            <div class="pc-section">
              <div class="pc-duo-row">
                <div class="pc-duo-item">
                  <span class="pc-card-title">隐私指示</span>
                  <label class="pc-switch-wrap">
                    <input
                      type="checkbox"
                      :checked="control.showPrivacyIndicators"
                      @change="control.setShowPrivacyIndicators($event.target.checked)"
                    />
                    <div class="pc-switch"></div>
                  </label>
                </div>
                <div class="pc-duo-item">
                  <span class="pc-card-title">双卡显示</span>
                  <label class="pc-switch-wrap">
                    <input
                      type="checkbox"
                      :checked="control.showDualSim"
                      @change="control.setShowDualSim($event.target.checked)"
                    />
                    <div class="pc-switch"></div>
                  </label>
                </div>
              </div>
            </div>

            <!-- 虚线分割 -->
            <div class="pc-divider-dashed"></div>

            <!-- 区域 4：微调图标尺寸 -->
            <div class="pc-section">
              <div class="pc-card-header" style="margin-bottom: 0;">
                <span class="pc-card-title">图标尺寸</span>
                <label class="pc-switch-wrap">
                  <input
                    type="checkbox"
                    :checked="control.fineTuningMode"
                    @change="onToggleFineTune($event.target.checked)"
                  />
                  <div class="pc-switch"></div>
                </label>
              </div>
              <Transition name="finetune-expand">
                <ControlCenterFineTunePanel v-if="control.fineTuningMode" />
              </Transition>
            </div>
          </div>

          <!-- 模块 2: 灵动岛 -->
          <div v-else-if="selectedModule === 'island'" class="pc-module-section-group">
            <!-- 区域 1：系统应用 -->
            <div class="pc-section">
              <div class="pc-card-header">
                <span class="pc-card-title">系统应用</span>
                <span v-if="clockStore.isAlarmActive || clockStore.isStopwatchActive || clockStore.isTimerActive || recorderStore.isRecording || control.mediaActive" class="pc-state-tag is-on">
                  {{ clockStore.isAlarmActive ? '闹钟进行中' : (clockStore.isStopwatchActive ? '计时中' : (clockStore.isTimerActive ? '倒计时中' : (recorderStore.isRecording ? '录音中' : '音乐播放中'))) }}
                </span>
              </div>
              <div class="pc-sysapp-grid">
                <!-- 1. 闹钟 -->
                <button
                  class="pc-sysapp-btn"
                  :class="{ on: clockStore.isAlarmActive }"
                  @click="toggleAlarmIsland"
                  title="开启/关闭闹钟灵动岛"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="CLOCK_ICONS.alarm" />
                  </svg>
                  <span>闹钟</span>
                </button>

                <!-- 2. 计时器 -->
                <button
                  class="pc-sysapp-btn"
                  :class="{ on: clockStore.isStopwatchActive }"
                  @click="toggleStopwatchIsland"
                  title="开启/关闭计时器灵动岛"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="CLOCK_ICONS.stopwatch" />
                  </svg>
                  <span>计时器</span>
                </button>

                <!-- 3. 倒计时 -->
                <button
                  class="pc-sysapp-btn"
                  :class="{ on: clockStore.isTimerActive }"
                  @click="toggleTimerIsland"
                  title="开启/关闭倒计时灵动岛"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="CLOCK_ICONS.timer" />
                  </svg>
                  <span>倒计时</span>
                </button>

                <!-- 4. 录音 -->
                <button
                  class="pc-sysapp-btn"
                  :class="{ on: recorderStore.isRecording }"
                  @click="toggleRecorderIsland"
                  title="开启/关闭录音灵动岛"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="GLYPHS.mic" />
                  </svg>
                  <span>录音</span>
                </button>

                <!-- 5. 音乐 -->
                <button
                  class="pc-sysapp-btn"
                  :class="{ on: control.mediaActive }"
                  @click="toggleMediaIsland"
                  title="开启/关闭音乐灵动岛"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="GLYPHS.music" />
                  </svg>
                  <span>音乐</span>
                </button>
              </div>
            </div>

            <!-- 虚线分割 -->
            <div class="pc-divider-dashed"></div>

            <!-- 区域 2：礼拜模式模拟 -->
            <div class="pc-section">
              <div class="pc-card-header">
                <span class="pc-card-title">礼拜模式</span>
                <span v-if="prayerStore.currentIslandPrayer" class="pc-state-tag is-on">
                  {{ i18n.prayerName(prayerStore.currentIslandPrayer.id) }}中
                </span>
              </div>
              <div class="pc-sysapp-grid">
                <button
                  v-for="p in prayerStore.prayers"
                  :key="p.id"
                  class="pc-sysapp-btn"
                  :class="{ on: prayerStore.currentIslandPrayer?.id === p.id }"
                  @click="prayerStore.toggleSimulatedPrayer(p.id)"
                >
                  <!-- 晨礼：朝阳破晓 -->
                  <svg
                    v-if="p.id === 'fajr'"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 2v6" />
                    <path d="m4.93 10.93 2.83 2.83" />
                    <path d="m19.07 10.93-2.83 2.83" />
                    <path d="M2 18h20" />
                    <path d="M6 18a6 6 0 0 1 12 0" />
                  </svg>
                  <!-- 晌礼：正午烈日 -->
                  <svg
                    v-else-if="p.id === 'dhuhr'"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="m4.93 4.93 1.41 1.41" />
                    <path d="m17.66 17.66 1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="m6.34 17.66-1.41 1.41" />
                    <path d="m19.07 4.93-1.41 1.41" />
                  </svg>
                  <!-- 哺礼：斜阳斜影 -->
                  <svg
                    v-else-if="p.id === 'asr'"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="9" cy="9" r="3.5" />
                    <path d="M9 2v2.5" />
                    <path d="M2 9h2.5" />
                    <path d="m4.05 4.05 1.77 1.77" />
                    <path d="M13 13l6 6" />
                    <path d="M20 16v4h-4" />
                    <path d="M2 21h8" />
                  </svg>
                  <!-- 昏礼：落日余晖 -->
                  <svg
                    v-else-if="p.id === 'maghrib'"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 10v6" />
                    <path d="m9 13 3 3 3-3" />
                    <path d="m4.93 10.93 2.83 2.83" />
                    <path d="m19.07 10.93-2.83 2.83" />
                    <path d="M2 18h20" />
                    <path d="M6 18a6 6 0 0 1 12 0" />
                  </svg>
                  <!-- 宵礼：夜空星月 -->
                  <svg
                    v-else
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    <path d="M19 4v3" />
                    <path d="M17.5 5.5h3" />
                  </svg>
                  <span>{{ i18n.prayerName(p.id) }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 模块 3: 礼拜模式 -->
          <div v-else-if="selectedModule === 'muslim'" class="pc-module-section-group">
            <!-- 区域 1：智慧建议模式 -->
            <div class="pc-section">
              <div class="pc-card-header">
                <span class="pc-card-title">智慧建议</span>
              </div>
              <div class="pc-seg">
                <div
                  class="pc-seg-thumb"
                  :style="{ transform: prayerStore.userMode === 'normal' ? 'translateX(0)' : 'translateX(100%)' }"
                ></div>
                <button
                  class="pc-seg-btn"
                  :class="{ on: prayerStore.userMode === 'normal' }"
                  @click="prayerStore.setUserMode('normal')"
                >
                  普通用户
                </button>
                <button
                  class="pc-seg-btn"
                  :class="{ on: prayerStore.userMode === 'muslim' }"
                  @click="prayerStore.setUserMode('muslim')"
                >
                  穆斯林用户
                </button>
              </div>
            </div>

            <!-- 虚线分割 -->
            <div class="pc-divider-dashed"></div>

            <!-- 区域 2：穆斯林闹钟时间模式切换卡片 -->
            <div class="pc-section">
              <div class="pc-card-header">
                <span class="pc-card-title">穆斯林闹钟</span>
                <label class="pc-switch-wrap">
                  <input
                    type="checkbox"
                    :checked="clockStore.settings.muslimAlarmEnabled"
                    @change="clockStore.setMuslimAlarmEnabled($event.target.checked)"
                  />
                  <div class="pc-switch"></div>
                </label>
              </div>
              <div class="pc-seg">
                <div
                  class="pc-seg-thumb"
                  :style="{ transform: clockStore.muslimTimeMode === 'default' ? 'translateX(0)' : 'translateX(100%)' }"
                ></div>
                <button
                  class="pc-seg-btn"
                  :class="{ on: clockStore.muslimTimeMode === 'default' }"
                  @click="clockStore.setMuslimTimeMode('default')"
                >
                  默认时间
                </button>
                <button
                  class="pc-seg-btn"
                  :class="{ on: clockStore.muslimTimeMode === 'custom' }"
                  @click="clockStore.setMuslimTimeMode('custom')"
                >
                  设定时间
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </main>
  </aside>

  <!-- ================= 2. 移动端悬浮球与居中弹窗模式 ================= -->
  <aside v-else class="mobile-dev-console">
    <!-- 可拖动悬浮按钮 (FAB) -->
    <div
      class="fab-btn"
      :class="{ 'is-snapping': isSnapping, 'is-open': isDrawerOpen }"
      :style="{
        transform: `translate3d(${fabPos.x}px, ${fabPos.y}px, 0)`
      }"
      @pointerdown="onFabPointerDown"
      @pointermove="onFabPointerMove"
      @pointerup="onFabPointerUp"
      @pointercancel="onFabPointerUp"
      @click="onFabClick"
    >
      <div class="fab-inner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="3" ry="3"/>
          <line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
      </div>
      <div class="fab-tag">控制台</div>
    </div>

    <!-- 弹窗遮罩与居中弹窗 (Modal Popup) -->
    <Transition name="modal-fade">
      <div v-if="isDrawerOpen" class="modal-backdrop" @click="onBackdropClick">
        <Transition name="modal-pop">
          <div v-if="isDrawerOpen" class="proto-console modal-console" @click.stop>
            <!-- 背景流光 -->
            <div class="pc-glow"></div>

            <!-- 顶部标题栏：左全屏，中标题，右亮灭屏+关闭 -->
            <header class="pc-header">
              <button
                class="pc-header-icon-btn"
                @click="toggleFullscreen"
                :title="isFullscreen ? '退出全屏' : '全屏'"
                aria-label="切换全屏"
              >
                <svg v-if="!isFullscreen" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
                <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                </svg>
              </button>

              <h2 class="pc-title">控制台</h2>

              <div class="pc-header-actions">
                <button
                  class="pc-header-icon-btn"
                  :class="system.screenOn ? 'is-active-power' : 'is-off-power'"
                  @click="system.screenOn ? system.powerOff() : system.powerOn()"
                  :title="system.screenOn ? '灭屏' : '亮屏'"
                  aria-label="系统亮灭屏"
                >
                  <svg v-if="system.screenOn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                  </svg>
                  <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
                  </svg>
                </button>
                <button class="pc-close-btn" @click.stop="closeModal" aria-label="关闭">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </header>

            <!-- 常用功能：截屏录屏合一卡片 -->
            <div class="pc-card">
              <div class="pc-card-header">
                <span class="pc-card-title">截屏录屏</span>
                <label class="pc-switch-wrap">
                  <span>带壳</span>
                  <input type="checkbox" :checked="withFrame" @change="toggleWithFrame($event.target.checked)" />
                  <div class="pc-switch"></div>
                </label>
              </div>
              <div class="pc-btn-group-2">
                <!-- 录屏动作按钮 -->
                <button
                  class="pc-btn"
                  :class="isTranscoding ? 'pc-btn-disabled' : isRecording ? 'pc-btn-danger' : 'pc-btn-primary'"
                  :disabled="isTranscoding"
                  @click="emit('toggle-recording')"
                >
                  <template v-if="isTranscoding">
                    <span class="pc-rec-spin">⏳</span>
                    <span>转码中...</span>
                  </template>
                  <template v-else-if="isRecording">
                    <LIcon name="video" :size="14" />
                    <span>停止 · {{ recordElapsed }}</span>
                  </template>
                  <template v-else>
                    <LIcon name="video" :size="14" />
                    <span>录屏</span>
                  </template>
                </button>

                <!-- 截屏动作按钮 -->
                <button
                  class="pc-btn pc-btn-secondary"
                  :class="isCapturing ? 'pc-btn-disabled' : ''"
                  :disabled="isCapturing"
                  @click="emit('capture-screenshot')"
                >
                  <LIcon name="scissors" :size="14" />
                  <span>{{ isCapturing ? '截取中...' : '截屏' }}</span>
                </button>
              </div>
            </div>

            <!-- 下拉选择控件：切换模块 -->
            <div class="pc-module-selector-wrap">
              <label for="mobile-module-select" class="pc-module-label">切换模块</label>
              <div class="pc-select-wrapper">
                <select id="mobile-module-select" v-model="selectedModule" class="pc-module-select">
                  <option value="island">灵动岛</option>
                  <option value="muslim">礼拜模式</option>
                  <option value="control">控制中心</option>
                </select>
                <svg class="pc-select-arrow" viewBox="0 0 20 20" fill="none">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="m6 8 4 4 4-4"/>
                </svg>
              </div>
            </div>

            <!-- 单一模块大卡片 -->
            <main class="pc-content-body">
              <Transition name="tab-fade" mode="out-in">
                <div class="pc-card pc-module-big-card" :key="'mob-' + selectedModule">
                  <!-- 模块 1: 控制中心 -->
                  <div v-if="selectedModule === 'control'" class="pc-module-section-group">
                    <!-- 区域 1：默认布局 -->
                    <div class="pc-section">
                      <div class="pc-card-header">
                        <span class="pc-card-title">默认布局</span>
                      </div>
                      <div class="pc-preset-rows" ref="mobileRowsRef">
                        <div
                          class="pc-preset-thumb"
                          :class="{ 'is-ready': mobilePresetThumb.ready.value }"
                          :style="mobilePresetThumb.thumbStyle.value"
                        ></div>
                        <div class="pc-preset-row" v-for="s in presetSeries" :key="s.key">
                          <span class="pc-preset-tag">{{ s.tag }}</span>
                          <div class="pc-seg">
                            <button
                              v-for="p in s.presets"
                              :key="p.id"
                              class="pc-seg-btn"
                              :class="{ on: control.layoutPreset === p.id }"
                              @click="control.setLayoutPreset(p.id)"
                            >
                              {{ p.shortLabel || p.label }}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 虚线分割 -->
                    <div class="pc-divider-dashed"></div>

                    <!-- 区域 2：编辑算法 -->
                    <div class="pc-section">
                      <div class="pc-card-header">
                        <span class="pc-card-title">编辑算法</span>
                      </div>
                      <div class="pc-seg">
                        <div
                          class="pc-seg-thumb"
                          :style="{ transform: control.dragMode === 'flow' ? 'translateX(0)' : 'translateX(100%)' }"
                        ></div>
                        <button
                          class="pc-seg-btn"
                          :class="{ on: control.dragMode === 'flow' }"
                          @click="control.setDragMode('flow')"
                        >
                          流式推挤
                        </button>
                        <button
                          class="pc-seg-btn"
                          :class="{ on: control.dragMode === 'swap' }"
                          @click="control.setDragMode('swap')"
                        >
                          坐标沉降
                        </button>
                      </div>
                    </div>

                    <!-- 虚线分割 -->
                    <div class="pc-divider-dashed"></div>

                    <!-- 区域 3：隐私指示 + 双卡显示（一行两列并排） -->
                    <div class="pc-section">
                      <div class="pc-duo-row">
                        <div class="pc-duo-item">
                          <span class="pc-card-title">隐私指示</span>
                          <label class="pc-switch-wrap">
                            <input
                              type="checkbox"
                              :checked="control.showPrivacyIndicators"
                              @change="control.setShowPrivacyIndicators($event.target.checked)"
                            />
                            <div class="pc-switch"></div>
                          </label>
                        </div>
                        <div class="pc-duo-item">
                          <span class="pc-card-title">双卡显示</span>
                          <label class="pc-switch-wrap">
                            <input
                              type="checkbox"
                              :checked="control.showDualSim"
                              @change="control.setShowDualSim($event.target.checked)"
                            />
                            <div class="pc-switch"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <!-- 虚线分割 -->
                    <div class="pc-divider-dashed"></div>

                    <!-- 区域 4：微调图标尺寸 -->
                    <div class="pc-section">
                      <div class="pc-card-header" style="margin-bottom: 0;">
                        <span class="pc-card-title">图标尺寸</span>
                        <label class="pc-switch-wrap">
                          <input
                            type="checkbox"
                            :checked="control.fineTuningMode"
                            @change="onToggleFineTune($event.target.checked)"
                          />
                          <div class="pc-switch"></div>
                        </label>
                      </div>
                      <Transition name="finetune-expand">
                        <ControlCenterFineTunePanel v-if="control.fineTuningMode" />
                      </Transition>
                    </div>
                  </div>

                  <!-- 模块 2: 灵动岛 -->
                  <div v-else-if="selectedModule === 'island'" class="pc-module-section-group">
                    <!-- 区域 1：系统应用 -->
                    <div class="pc-section">
                      <div class="pc-card-header">
                        <span class="pc-card-title">系统应用</span>
                        <span v-if="clockStore.isAlarmActive || clockStore.isStopwatchActive || clockStore.isTimerActive || recorderStore.isRecording || control.mediaActive" class="pc-state-tag is-on">
                          {{ clockStore.isAlarmActive ? '闹钟进行中' : (clockStore.isStopwatchActive ? '计时中' : (clockStore.isTimerActive ? '倒计时中' : (recorderStore.isRecording ? '录音中' : '音乐播放中'))) }}
                        </span>
                      </div>
                      <div class="pc-sysapp-grid">
                        <!-- 1. 闹钟 -->
                        <button
                          class="pc-sysapp-btn"
                          :class="{ on: clockStore.isAlarmActive }"
                          @click="toggleAlarmIsland"
                          title="开启/关闭闹钟灵动岛"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path :d="CLOCK_ICONS.alarm" />
                          </svg>
                          <span>闹钟</span>
                        </button>

                        <!-- 2. 计时器 -->
                        <button
                          class="pc-sysapp-btn"
                          :class="{ on: clockStore.isStopwatchActive }"
                          @click="toggleStopwatchIsland"
                          title="开启/关闭计时器灵动岛"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path :d="CLOCK_ICONS.stopwatch" />
                          </svg>
                          <span>计时器</span>
                        </button>

                        <!-- 3. 倒计时 -->
                        <button
                          class="pc-sysapp-btn"
                          :class="{ on: clockStore.isTimerActive }"
                          @click="toggleTimerIsland"
                          title="开启/关闭倒计时灵动岛"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path :d="CLOCK_ICONS.timer" />
                          </svg>
                          <span>倒计时</span>
                        </button>

                        <!-- 4. 录音 -->
                        <button
                          class="pc-sysapp-btn"
                          :class="{ on: recorderStore.isRecording }"
                          @click="toggleRecorderIsland"
                          title="开启/关闭录音灵动岛"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path :d="GLYPHS.mic" />
                          </svg>
                          <span>录音</span>
                        </button>

                        <!-- 5. 音乐 -->
                        <button
                          class="pc-sysapp-btn"
                          :class="{ on: control.mediaActive }"
                          @click="toggleMediaIsland"
                          title="开启/关闭音乐灵动岛"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path :d="GLYPHS.music" />
                          </svg>
                          <span>音乐</span>
                        </button>
                      </div>
                    </div>

                    <!-- 虚线分割 -->
                    <div class="pc-divider-dashed"></div>

                    <!-- 区域 2：礼拜模式模拟 -->
                    <div class="pc-section">
                      <div class="pc-card-header">
                        <span class="pc-card-title">礼拜模式</span>
                        <span v-if="prayerStore.currentIslandPrayer" class="pc-state-tag is-on">
                          {{ i18n.prayerName(prayerStore.currentIslandPrayer.id) }}中
                        </span>
                      </div>
                      <div class="pc-sysapp-grid">
                        <button
                          v-for="p in prayerStore.prayers"
                          :key="p.id"
                          class="pc-sysapp-btn"
                          :class="{ on: prayerStore.currentIslandPrayer?.id === p.id }"
                          @click="prayerStore.toggleSimulatedPrayer(p.id)"
                        >
                          <!-- 晨礼：朝阳破晓 -->
                          <svg
                            v-if="p.id === 'fajr'"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path d="M12 2v6" />
                            <path d="m4.93 10.93 2.83 2.83" />
                            <path d="m19.07 10.93-2.83 2.83" />
                            <path d="M2 18h20" />
                            <path d="M6 18a6 6 0 0 1 12 0" />
                          </svg>
                          <!-- 晌礼：正午烈日 -->
                          <svg
                            v-else-if="p.id === 'dhuhr'"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v2" />
                            <path d="M12 20v2" />
                            <path d="m4.93 4.93 1.41 1.41" />
                            <path d="m17.66 17.66 1.41 1.41" />
                            <path d="M2 12h2" />
                            <path d="M20 12h2" />
                            <path d="m6.34 17.66-1.41 1.41" />
                            <path d="m19.07 4.93-1.41 1.41" />
                          </svg>
                          <!-- 哺礼：斜阳斜影 -->
                          <svg
                            v-else-if="p.id === 'asr'"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <circle cx="9" cy="9" r="3.5" />
                            <path d="M9 2v2.5" />
                            <path d="M2 9h2.5" />
                            <path d="m4.05 4.05 1.77 1.77" />
                            <path d="M13 13l6 6" />
                            <path d="M20 16v4h-4" />
                            <path d="M2 21h8" />
                          </svg>
                          <!-- 昏礼：落日余晖 -->
                          <svg
                            v-else-if="p.id === 'maghrib'"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path d="M12 10v6" />
                            <path d="m9 13 3 3 3-3" />
                            <path d="m4.93 10.93 2.83 2.83" />
                            <path d="m19.07 10.93-2.83 2.83" />
                            <path d="M2 18h20" />
                            <path d="M6 18a6 6 0 0 1 12 0" />
                          </svg>
                          <!-- 宵礼：夜空星月 -->
                          <svg
                            v-else
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            <path d="M19 4v3" />
                            <path d="M17.5 5.5h3" />
                          </svg>
                          <span>{{ i18n.prayerName(p.id) }}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- 模块 3: 礼拜模式 -->
                  <div v-else-if="selectedModule === 'muslim'" class="pc-module-section-group">
                    <!-- 区域 1：智慧建议模式 -->
                    <div class="pc-section">
                      <div class="pc-card-header">
                        <span class="pc-card-title">智慧建议</span>
                      </div>
                      <div class="pc-seg">
                        <div
                          class="pc-seg-thumb"
                          :style="{ transform: prayerStore.userMode === 'normal' ? 'translateX(0)' : 'translateX(100%)' }"
                        ></div>
                        <button
                          class="pc-seg-btn"
                          :class="{ on: prayerStore.userMode === 'normal' }"
                          @click="prayerStore.setUserMode('normal')"
                        >
                          普通用户
                        </button>
                        <button
                          class="pc-seg-btn"
                          :class="{ on: prayerStore.userMode === 'muslim' }"
                          @click="prayerStore.setUserMode('muslim')"
                        >
                          穆斯林用户
                        </button>
                      </div>
                    </div>

                    <!-- 虚线分割 -->
                    <div class="pc-divider-dashed"></div>

                    <!-- 区域 2：穆斯林闹钟时间模式切换卡片 -->
                    <div class="pc-section">
                      <div class="pc-card-header">
                        <span class="pc-card-title">穆斯林闹钟</span>
                        <label class="pc-switch-wrap">
                          <input
                            type="checkbox"
                            :checked="clockStore.settings.muslimAlarmEnabled"
                            @change="clockStore.setMuslimAlarmEnabled($event.target.checked)"
                          />
                          <div class="pc-switch"></div>
                        </label>
                      </div>
                      <div class="pc-seg">
                        <div
                          class="pc-seg-thumb"
                          :style="{ transform: clockStore.muslimTimeMode === 'default' ? 'translateX(0)' : 'translateX(100%)' }"
                        ></div>
                        <button
                          class="pc-seg-btn"
                          :class="{ on: clockStore.muslimTimeMode === 'default' }"
                          @click="clockStore.setMuslimTimeMode('default')"
                        >
                          默认时间
                        </button>
                        <button
                          class="pc-seg-btn"
                          :class="{ on: clockStore.muslimTimeMode === 'custom' }"
                          @click="clockStore.setMuslimTimeMode('custom')"
                        >
                          设定时间
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </main>
          </div>
        </Transition>
      </div>
    </Transition>
  </aside>
</template>

<style scoped>
/* ================= 桌面控制台容器 ================= */
.proto-console {
  position: relative;
  width: 320px;
  flex: none;
  background: #18181c;
  border-radius: 24px;
  padding: 14px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  align-self: center;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pc-glow {
  position: absolute;
  top: -80px;
  right: -80px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%);
  filter: blur(40px);
  pointer-events: none;
}

/* 顶部标题栏：左右分布图标按钮，中间居中标题 */
.pc-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 2px 2px 4px;
  margin-bottom: 0;
}

.pc-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pc-header-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

.pc-header-icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}

.pc-header-icon-btn:active {
  transform: scale(0.94);
}

.pc-header-icon-btn.is-active-power {
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
}

.pc-header-icon-btn.is-active-power:hover {
  background: rgba(245, 158, 11, 0.25);
  color: #fef3c7;
}

.pc-header-icon-btn.is-off-power {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
}

.pc-header-icon-btn.is-off-power:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #fee2e2;
}

.pc-title {
  font: 800 15px/1.2 var(--font-stack);
  letter-spacing: -0.2px;
  color: #ffffff;
  margin: 0;
  text-align: center;
  flex: 1;
}

/* ================= 截屏录屏两列操作按钮 ================= */
.pc-btn-group-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* ================= 模块下拉选择器 ================= */
.pc-module-selector-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
}

.pc-module-label {
  font: 600 12px/1 var(--font-stack);
  color: #a1a1aa;
  white-space: nowrap;
  letter-spacing: 0.1px;
}

.pc-select-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.pc-module-select {
  width: 100%;
  background: #1f1f26;
  border: 1px solid #2e2e38;
  border-radius: 10px;
  padding: 7px 28px 7px 11px;
  font: 600 12px/1 var(--font-stack);
  color: #ffffff;
  outline: none;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition: all 0.2s ease;
}

.pc-module-select:hover {
  background: #23232c;
  border-color: #3f3f4c;
}

.pc-module-select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
}

.pc-select-arrow {
  position: absolute;
  right: 9px;
  top: 50%;
  transform: translateY(-50%);
  width: 15px;
  height: 15px;
  color: #71717a;
  pointer-events: none;
}

/* ================= 单一模块大卡片 & 虚线分割 ================= */
.pc-content-body {
  position: relative;
  min-height: 220px;
}

.pc-card {
  background: #1f1f26;
  border: 1px solid #2e2e38;
  border-radius: 16px;
  padding: 11px 13px 13px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.pc-card:hover {
  background: #23232c;
  border-color: #3f3f4c;
}

.pc-module-big-card {
  padding: 12px 13px;
}

.pc-module-section-group {
  display: flex;
  flex-direction: column;
}

.pc-section {
  display: flex;
  flex-direction: column;
}

/* 虚线分割线 */
.pc-divider-dashed {
  border-top: 1px dashed rgba(255, 255, 255, 0.12);
  margin: 11px 0;
  width: 100%;
}

.pc-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}

.pc-card-title {
  font: 600 12.5px/1.2 var(--font-stack);
  color: #f4f4f5;
  letter-spacing: 0.1px;
}

/* 一行两列并排：隐私指示 + 双卡显示 */
.pc-duo-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pc-duo-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #141418;
  border: 1px solid #27272f;
  border-radius: 12px;
  padding: 9px 10px;
}

/* 灵动岛常驻说明条 */
.pc-island-hint-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: #a1a1aa;
}

.pc-island-badge {
  font-size: 10px;
  font-weight: 600;
  color: #60a5fa;
  background: rgba(37, 99, 235, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.25);
  padding: 2px 7px;
  border-radius: 6px;
}

/* 图标尺寸展开面板无缝过渡动效 */
.finetune-expand-enter-active,
.finetune-expand-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  overflow: hidden;
}

.finetune-expand-enter-from,
.finetune-expand-leave-to {
  opacity: 0;
  max-height: 0px;
  transform: translateY(-8px);
  margin-top: 0 !important;
  padding-top: 0 !important;
}

.finetune-expand-enter-to,
.finetune-expand-leave-from {
  opacity: 1;
  max-height: 500px;
  transform: translateY(0);
}

.pc-state-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: 600 11px/1 var(--font-stack);
  color: #71717a;
}

.pc-state-tag.is-on {
  color: #34d399;
}

/* 默认布局：三行对照 */
.pc-preset-rows {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pc-preset-thumb {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: 0;
  height: 0;
  opacity: 0;
  border-radius: 9px;
  background: #2563eb;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.45);
  pointer-events: none;
}

.pc-preset-thumb.is-ready {
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pc-preset-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pc-preset-tag {
  flex: 0 0 54px;
  width: 54px;
  font: 600 11px/1 var(--font-stack);
  color: #8b8b93;
  letter-spacing: 0.02em;
  user-select: none;
}

.pc-preset-row .pc-seg {
  flex: 1;
  min-width: 0;
}

/* 分段选择器 */
.pc-seg {
  position: relative;
  display: flex;
  background: #101014;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 3px;
}

.pc-seg-thumb {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  background: #2563eb;
  border-radius: 9px;
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.45);
}

.pc-seg-thumb-3 {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(33.333% - 2px);
  background: #2563eb;
  border-radius: 9px;
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.45);
}

.pc-seg-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 7px 0;
  font: 500 12px/1 var(--font-stack);
  border-radius: 9px;
  color: #a1a1aa;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: color 0.2s ease;
  -webkit-tap-highlight-color: transparent !important;
  outline: none !important;
  user-select: none;
}

.pc-seg-btn:hover {
  color: #f4f4f5;
}

.pc-seg-btn.on {
  color: #ffffff;
  font-weight: 700;
}

/* 操作按钮 */
.pc-btn {
  width: 100%;
  padding: 9px 0;
  border-radius: 12px;
  font: 700 12.5px/1 var(--font-stack);
  background: #27272a;
  border: 1px solid #3f3f46;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent !important;
  outline: none !important;
}

.pc-btn:hover:not(:disabled) {
  background: #3f3f46;
}

.pc-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.pc-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pc-btn-secondary {
  background: #27272a;
  border-color: #3f3f46;
  color: #e4e4e7;
  box-shadow: none;
}

.pc-btn-secondary:hover:not(:disabled) {
  background: #33333a;
  border-color: #52525b;
  color: #ffffff;
}

.pc-btn-primary {
  background: #2563eb;
  border-color: #3b82f6;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
}

.pc-btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
  border-color: #60a5fa;
}

.pc-btn-danger {
  background: #dc2626;
  border-color: #ef4444;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);
}

.pc-btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.pc-rec-spin {
  display: inline-block;
  margin-right: 6px;
}

.pc-btn :deep(.l-icon) {
  margin-right: 7px;
}

/* 系统应用 5 按钮组 */
.pc-sysapp-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
}

.pc-sysapp-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 2px;
  border-radius: 9px;
  font: 600 11px/1 var(--font-stack);
  background: #101014;
  border: 1px solid #27272a;
  color: #d4d4d8;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  -webkit-tap-highlight-color: transparent !important;
  outline: none !important;
  user-select: none;
}

.pc-sysapp-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.pc-sysapp-btn svg:not([stroke]) {
  fill: currentColor;
}

.pc-sysapp-btn:hover {
  background: #27272a;
  color: #ffffff;
}

.pc-sysapp-btn.on {
  background: #10b981;
  border-color: #34d399;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 3px 12px rgba(16, 185, 129, 0.4);
}


.pc-alarm-trigger-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.pc-alarm-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  fill: currentColor;
}

/* 开关控件 */
.pc-switch-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font: 500 11.5px/1 var(--font-stack);
  color: #a1a1aa;
  user-select: none;
}

.pc-switch-wrap input { display: none; }

.pc-switch {
  position: relative;
  width: 28px;
  height: 16px;
  background: #3f3f46;
  border-radius: 10px;
  transition: background 0.2s;
}

.pc-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pc-switch-wrap input:checked + .pc-switch {
  background: #2563eb;
}

.pc-switch-wrap input:checked + .pc-switch::after {
  transform: translateX(12px);
}

/* ================= 移动端悬浮球与居中弹窗 ================= */
.mobile-dev-console {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 99999;
}

.fab-btn {
  position: fixed;
  top: 0;
  left: 0;
  width: 50px;
  height: 50px;
  border-radius: 25px;
  background: #18181c;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  cursor: grab;
  touch-action: none;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
  will-change: transform;
}

.fab-btn:active {
  cursor: grabbing;
  transform: scale(0.96);
}

.fab-btn.is-snapping {
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.fab-btn.is-open {
  border-color: #60a5fa;
  box-shadow: 0 0 16px rgba(96, 165, 250, 0.5);
}

.fab-inner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab-tag {
  font-size: 8.5px;
  font-weight: 700;
  color: #f4f4f5;
  letter-spacing: 0.2px;
}

/* 弹窗遮罩 (居中容器) */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  pointer-events: auto;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

/* 移动端弹窗控制台 (尺寸布局完全同桌面版) */
.modal-console {
  width: min(320px, calc(100vw - 32px));
  max-height: 90dvh;
  overflow-y: auto;
  pointer-events: auto;
  z-index: 100001;
  box-shadow:
    0 32px 80px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.pc-close-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pc-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

/* ================= 切换过渡动画 ================= */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* 弹窗背景淡入淡出 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* 弹窗微缩放弹出 */
.modal-pop-enter-active,
.modal-pop-leave-active {
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.28s ease;
}

.modal-pop-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(10px);
}

.modal-pop-leave-to {
  opacity: 0;
  transform: scale(0.94) translateY(6px);
}
</style>
