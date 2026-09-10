<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useControlStore, LAYOUT_PRESETS } from '../../stores/controlStore'
import { useSystemStore } from '../../stores/systemStore'
import { usePrayerStore } from '../../stores/prayerStore'
import { useClockStore } from '../../stores/clockStore'
import { useI18nStore } from '../../stores/i18nStore'
import { useCapture } from '../../composables/useCapture'
import { CLOCK_ICONS } from '../apps/clock/clockIcons'
import LIcon from '../ui/LIcon.vue'

/* 微调面板（373 行）改为按需异步加载：线上演示默认不进入微调模式，
   这样能从生产首包剥离。DevConsole 自身保留 —— 录屏与三语切换是演示必需。 */
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
    default: true
  },
  /** 控制台「带壳截图」开关状态（由 App.vue 经 v-model 传入） */
  screenshotWithFrame: {
    type: Boolean,
    default: true
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
const i18n = useI18nStore()

if (typeof window !== 'undefined') {
  window.__clock = clockStore
}

/** 当前默认布局在三档分段控件里的下标（驱动滑块位移） */
const presetIndex = computed(() =>
  Math.max(0, LAYOUT_PRESETS.findIndex((p) => p.id === control.layoutPreset))
)

/** 默认布局按「系列」分行：tOS 16 / tOS 17 / EE1，每行同样是 CAMON / NOTE / GT。
 *  行是数据驱动的 —— 将来再加系列只改这个数组，模板和滑块动效都不用动。
 *  滑块是整张卡片唯一一个，靠实测按钮位置在 9 个格子间连续移动。 */
const presetSeries = computed(() => [
  { key: '16', tag: 'tOS 16', presets: LAYOUT_PRESETS.filter((p) => (p.series || '16') === '16') },
  { key: '17', tag: 'tOS 17', presets: LAYOUT_PRESETS.filter((p) => p.series === '17') },
  { key: 'ee1', tag: 'EE1', presets: LAYOUT_PRESETS.filter((p) => p.series === 'ee1') }
])
/* 默认布局两行共 6 个按钮 —— 整张卡片只保留「一个」滑块，
   切换时靠实测目标按钮相对容器的偏移连续移动（含跨行），
   而不是两行各一个滑块各自淡出/归位（那样跨行切换会先从行首闪一下）。
   首帧无动画就位，之后才开过渡；容器尺寸变化（面板折叠/响应式）时重算。 */
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

  /* 两行是 v-if 页签里的延迟内容 —— 首次挂载时 rowsRef 可能还是 null，
     切到「控制中心」页签后才真正出现，所以元素一挂上就要补一次测量。 */
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

  return { rowsRef, thumbStyle, ready }
}

const desktopPresetThumb = usePresetThumb()
const mobilePresetThumb = usePresetThumb()
/* 模板 ref 需要顶层同名变量才能绑定 */
const desktopRowsRef = desktopPresetThumb.rowsRef
const mobileRowsRef = mobilePresetThumb.rowsRef

/* ================= Tab 切换状态 ================= */
const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
const initialTab = (urlParams?.get('overlay') === 'controlCenter' || urlParams?.get('finetune') === '1' || urlParams?.get('tab') === 'control') ? 'control' : 'system'
const activeTab = ref(initialTab) // 'system' | 'prayer' | 'control'
const tabs = [
  { id: 'system', name: '系统控制' },
  { id: 'prayer', name: '礼拜模式' },
  { id: 'control', name: '控制中心' }
]

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

/* ================= 录制计时（给「到底录没录上」一个明确反馈） ================= */
/* 计时由 useCapture 单例统一维护：控制台和屏幕上的录制指示器显示的是同一份，
   不会出现两个计时器各走各的。 */
const { recordElapsed } = useCapture()

/* ================= 图标微调模式快捷控制 ================= */
const fineTuneCopied = ref(false)

function onToggleFineTune(enabled) {
  control.setFineTuningMode(enabled)
  if (enabled) {
    system.unlock()
    system.settleOverlay('controlCenter', true)
  }
}

function onCopyFineTune() {
  const config = control.exportConfig()
  const text = JSON.stringify(config, null, 2)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      fineTuneCopied.value = true
      setTimeout(() => { fineTuneCopied.value = false }, 1800)
    }).catch(() => {
      prompt('配置 JSON：', text)
    })
  } else {
    prompt('配置 JSON：', text)
  }
}
</script>

<template>
  <!-- ================= 1. 桌面侧边栏模式 ================= -->
  <aside v-if="mode === 'desktop'" class="proto-console">
    <!-- 背景流光 -->
    <div class="pc-glow"></div>

    <!-- 顶部标题 (居中加粗) -->
    <header class="pc-header">
      <h2 class="pc-title">控制台</h2>
    </header>

    <!-- 模块切换卡片 -->
    <div class="pc-card pc-tab-card">
      <div class="pc-card-header">
        <span class="pc-card-title">模块切换</span>
      </div>
      <nav class="pc-tab-bar">
        <div
          class="pc-tab-indicator"
          :style="{
            transform: activeTab === 'system'
              ? 'translateX(0)'
              : activeTab === 'prayer'
                ? 'translateX(100%)'
                : 'translateX(200%)'
          }"
        ></div>
        <button
          v-for="t in tabs"
          :key="t.id"
          class="pc-tab-btn"
          :class="{ active: activeTab === t.id }"
          @click="activeTab = t.id"
        >
          {{ t.name }}
        </button>
      </nav>
    </div>

    <!-- Tab 内容区 -->
    <main class="pc-content-body">
      <Transition name="tab-fade" mode="out-in">
        <!-- 1. 系统控制 Tab -->
        <section v-if="activeTab === 'system'" key="system" class="pc-tab-panel">
          <!-- 语言切换 -->
          <div class="pc-card">
            <div class="pc-card-header">
              <span class="pc-card-title">系统语言</span>
            </div>
            <div class="pc-seg pc-seg-3">
              <div
                class="pc-seg-thumb-3"
                :style="{
                  transform: i18n.locale === 'zh'
                    ? 'translateX(0)'
                    : i18n.locale === 'en'
                      ? 'translateX(100%)'
                      : 'translateX(200%)'
                }"
              ></div>
              <button class="pc-seg-btn" :class="{ on: i18n.locale === 'zh' }" @click="i18n.setLocale('zh')">中文</button>
              <button class="pc-seg-btn" :class="{ on: i18n.locale === 'en' }" @click="i18n.setLocale('en')">English</button>
              <button class="pc-seg-btn" :class="{ on: i18n.locale === 'bn' }" @click="i18n.setLocale('bn')">বাংলা</button>
            </div>
          </div>

          <!-- 系统导航切换 -->
          <div class="pc-card">
            <div class="pc-card-header">
              <span class="pc-card-title">系统导航</span>
            </div>
            <div class="pc-seg">
              <div
                class="pc-seg-thumb"
                :style="{
                  transform: system.navigationMode === 'gesture' ? 'translateX(0)' : 'translateX(100%)'
                }"
              ></div>
              <button
                class="pc-seg-btn"
                :class="{ on: system.navigationMode === 'gesture' }"
                @click="system.setNavigationMode('gesture')"
              >
                手势导航
              </button>
              <button
                class="pc-seg-btn"
                :class="{ on: system.navigationMode === 'threeButton' }"
                @click="system.setNavigationMode('threeButton')"
              >
                三键导航
              </button>
            </div>
          </div>

          <!-- 屏幕状态控制与全屏 -->
          <div class="pc-card">
            <div class="pc-card-header">
              <span class="pc-card-title">系统显示</span>
            </div>
            <div class="pc-btn-group-2">
              <button class="pc-btn pc-btn-secondary" @click="toggleFullscreen">
                全屏
              </button>
              <button
                class="pc-btn pc-btn-toggle"
                :class="system.screenOn ? 'pc-btn-danger' : 'pc-btn-primary'"
                @click="system.screenOn ? system.powerOff() : system.powerOn()"
              >
                {{ system.screenOn ? '灭屏' : '亮屏' }}
              </button>
            </div>
          </div>

          <!-- 录屏功能 -->
          <div class="pc-card">
            <div class="pc-card-header">
              <span class="pc-card-title">录制屏幕</span>
              <label class="pc-switch-wrap">
                <span>带壳录制</span>
                <input type="checkbox" :checked="recordWithFrame" @change="emit('update:recordWithFrame', $event.target.checked)" />
                <div class="pc-switch"></div>
              </label>
            </div>
            <button
              class="pc-btn"
              :class="isTranscoding ? 'pc-btn-disabled' : isRecording ? 'pc-btn-danger' : 'pc-btn-primary'"
              :disabled="isTranscoding"
              @click="emit('toggle-recording')"
            >
              <template v-if="isTranscoding">
                <span class="pc-rec-spin">⏳</span>
                <span>正在自动转码导出...</span>
              </template>
              <template v-else-if="isRecording">
                <LIcon name="video" :size="15" />
                <span>停止录制 · {{ recordElapsed }}</span>
              </template>
              <template v-else>
                <LIcon name="video" :size="15" />
                <span>开始录制</span>
              </template>
            </button>
          </div>

          <!-- 屏幕截图：带壳 / 不带壳两种效果 -->
          <div class="pc-card">
            <div class="pc-card-header">
              <span class="pc-card-title">屏幕截图</span>
              <label class="pc-switch-wrap">
                <span>带壳截图</span>
                <input type="checkbox" :checked="screenshotWithFrame" @change="emit('update:screenshotWithFrame', $event.target.checked)" />
                <div class="pc-switch"></div>
              </label>
            </div>
            <button
              class="pc-btn"
              :class="isCapturing ? 'pc-btn-disabled' : 'pc-btn-primary'"
              :disabled="isCapturing"
              @click="emit('capture-screenshot')"
            >
              <LIcon name="scissors" :size="15" />
              <span>{{ isCapturing ? '截取中...' : '截取屏幕' }}</span>
            </button>
          </div>
        </section>

        <!-- 2. 礼拜模式 Tab -->
        <section v-else-if="activeTab === 'prayer'" key="prayer" class="pc-tab-panel">
          <!-- 智慧建议模式 -->
          <div class="pc-card">
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

          <!-- 灵动岛模拟 -->
          <div class="pc-card">
            <div class="pc-card-header">
              <span class="pc-card-title">灵动岛</span>
              <span v-if="prayerStore.currentIslandPrayer" class="pc-state-tag is-on">
                {{ i18n.prayerName(prayerStore.currentIslandPrayer.id) }}中
              </span>
            </div>
            <div class="prayer-buttons-grid">
              <button
                v-for="p in prayerStore.prayers"
                :key="p.id"
                class="pc-prayer-btn"
                :class="{ on: prayerStore.currentIslandPrayer?.id === p.id }"
                @click="prayerStore.toggleSimulatedPrayer(p.id)"
              >
                {{ i18n.prayerName(p.id) }}
              </button>
            </div>

            <!-- 闹钟灵动岛控制 -->
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 12px; color: rgba(255,255,255,0.65); font-weight: 500;">闹钟提醒</span>
                <span v-if="clockStore.isAlarmActive" class="pc-state-tag is-on">
                  {{ clockStore.isAlarmRinging ? '响铃中' : '延时倒计时' }}
                </span>
              </div>
              <div style="display: flex; gap: 8px;">
                <button
                  class="pc-prayer-btn pc-alarm-trigger-btn"
                  style="flex: 1;"
                  :class="{ on: clockStore.isAlarmRinging }"
                  @click="clockStore.isAlarmRinging ? clockStore.dismissAlarm() : clockStore.triggerAlarm()"
                >
                  <svg class="pc-alarm-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="CLOCK_ICONS.alarm" />
                  </svg>
                  <span>{{ clockStore.isAlarmRinging ? '关闭闹钟' : '闹钟' }}</span>
                </button>
                <button
                  v-if="clockStore.isAlarmActive"
                  class="pc-prayer-btn"
                  style="flex: 1;"
                  :class="{ on: clockStore.isAlarmSnoozing }"
                  @click="clockStore.snoozeAlarm()"
                >
                  {{ clockStore.isAlarmSnoozing ? '重置10分' : '延时10分' }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. 控制中心 Tab -->
        <section v-else-if="activeTab === 'control'" key="control" class="pc-tab-panel">
          <!-- 默认布局：tOS16 / tOS17 两行对照，同一张卡片内 -->
          <div class="pc-card">
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

          <!-- 排列算法 -->
          <div class="pc-card">
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

          <!-- 隐私指示 + 双卡显示（一行两块底板） -->
          <div class="pc-card-duo">
            <div class="pc-card pc-card-single">
              <div class="pc-card-header">
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
            </div>
            <div class="pc-card pc-card-single">
              <div class="pc-card-header">
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

          <!-- 微调图标尺寸 (放置在最下方，开关打开后卡片内展开完整面板) -->
          <div class="pc-card" :class="control.fineTuningMode ? 'pc-card-expanded' : 'pc-card-single'">
            <div class="pc-card-header">
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
            <!-- 开关开启时展开微调控制面板（无缝过渡动效） -->
            <Transition name="finetune-expand">
              <ControlCenterFineTunePanel v-if="control.fineTuningMode" />
            </Transition>
          </div>
        </section>
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

            <!-- 顶部标题 (居中加粗 + 关闭按钮) -->
            <header class="pc-header">
              <h2 class="pc-title">控制台</h2>
              <button class="pc-close-btn" @click.stop="closeModal" aria-label="关闭">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </header>

            <!-- 模块切换卡片 -->
            <div class="pc-card pc-tab-card">
              <div class="pc-card-header">
                <span class="pc-card-title">模块切换</span>
              </div>
              <nav class="pc-tab-bar">
                <div
                  class="pc-tab-indicator"
                  :style="{
                    transform: activeTab === 'system'
                      ? 'translateX(0)'
                      : activeTab === 'prayer'
                        ? 'translateX(100%)'
                        : 'translateX(200%)'
                  }"
                ></div>
                <button
                  v-for="t in tabs"
                  :key="t.id"
                  class="pc-tab-btn"
                  :class="{ active: activeTab === t.id }"
                  @click="activeTab = t.id"
                >
                  {{ t.name }}
                </button>
              </nav>
            </div>

            <!-- Tab 内容区 -->
            <main class="pc-content-body">
              <Transition name="tab-fade" mode="out-in">
                <!-- 1. 系统控制 Tab -->
                <section v-if="activeTab === 'system'" key="mob-system" class="pc-tab-panel">
                  <!-- 语言切换 -->
                  <div class="pc-card">
                    <div class="pc-card-header">
                      <span class="pc-card-title">系统语言</span>
                    </div>
                    <div class="pc-seg pc-seg-3">
                      <div
                        class="pc-seg-thumb-3"
                        :style="{
                          transform: i18n.locale === 'zh'
                            ? 'translateX(0)'
                            : i18n.locale === 'en'
                              ? 'translateX(100%)'
                              : 'translateX(200%)'
                        }"
                      ></div>
                      <button class="pc-seg-btn" :class="{ on: i18n.locale === 'zh' }" @click="i18n.setLocale('zh')">中文</button>
                      <button class="pc-seg-btn" :class="{ on: i18n.locale === 'en' }" @click="i18n.setLocale('en')">English</button>
                      <button class="pc-seg-btn" :class="{ on: i18n.locale === 'bn' }" @click="i18n.setLocale('bn')">বাংলা</button>
                    </div>
                  </div>

                  <!-- 系统导航切换 -->
                  <div class="pc-card">
                    <div class="pc-card-header">
                      <span class="pc-card-title">系统导航</span>
                    </div>
                    <div class="pc-seg">
                      <div
                        class="pc-seg-thumb"
                        :style="{
                          transform: system.navigationMode === 'gesture' ? 'translateX(0)' : 'translateX(100%)'
                        }"
                      ></div>
                      <button
                        class="pc-seg-btn"
                        :class="{ on: system.navigationMode === 'gesture' }"
                        @click="system.setNavigationMode('gesture')"
                      >
                        手势导航
                      </button>
                      <button
                        class="pc-seg-btn"
                        :class="{ on: system.navigationMode === 'threeButton' }"
                        @click="system.setNavigationMode('threeButton')"
                      >
                        三键导航
                      </button>
                    </div>
                  </div>

                  <!-- 屏幕状态控制与全屏 -->
                  <div class="pc-card">
                    <div class="pc-card-header">
                      <span class="pc-card-title">系统显示</span>
                    </div>
                    <div class="pc-btn-group-2">
                      <button class="pc-btn pc-btn-secondary" @click="toggleFullscreen">
                        全屏
                      </button>
                      <button
                        class="pc-btn pc-btn-toggle"
                        :class="system.screenOn ? 'pc-btn-danger' : 'pc-btn-primary'"
                        @click="system.screenOn ? system.powerOff() : system.powerOn()"
                      >
                        {{ system.screenOn ? '灭屏' : '亮屏' }}
                      </button>
                    </div>
                  </div>

                  <!-- 录屏功能 -->
                  <div class="pc-card">
                    <div class="pc-card-header">
                      <span class="pc-card-title">录制屏幕</span>
                      <label class="pc-switch-wrap">
                        <span>带壳录制</span>
                        <input type="checkbox" :checked="recordWithFrame" @change="emit('update:recordWithFrame', $event.target.checked)" />
                        <div class="pc-switch"></div>
                      </label>
                    </div>
                    <button
                      class="pc-btn"
                      :class="isTranscoding ? 'pc-btn-disabled' : isRecording ? 'pc-btn-danger' : 'pc-btn-primary'"
                      :disabled="isTranscoding"
                      @click="emit('toggle-recording')"
                    >
                      <template v-if="isTranscoding">
                        <span class="pc-rec-spin">⏳</span>
                        <span>正在自动转码导出...</span>
                      </template>
                      <template v-else-if="isRecording">
                        <LIcon name="video" :size="15" />
                        <span>停止录制 · {{ recordElapsed }}</span>
                      </template>
                      <template v-else>
                        <LIcon name="video" :size="15" />
                        <span>开始录制</span>
                      </template>
                    </button>
                  </div>

                  <!-- 屏幕截图：带壳 / 不带壳两种效果 -->
                  <div class="pc-card">
                    <div class="pc-card-header">
                      <span class="pc-card-title">屏幕截图</span>
                      <label class="pc-switch-wrap">
                        <span>带壳截图</span>
                        <input type="checkbox" :checked="screenshotWithFrame" @change="emit('update:screenshotWithFrame', $event.target.checked)" />
                        <div class="pc-switch"></div>
                      </label>
                    </div>
                    <button
                      class="pc-btn"
                      :class="isCapturing ? 'pc-btn-disabled' : 'pc-btn-primary'"
                      :disabled="isCapturing"
                      @click="emit('capture-screenshot')"
                    >
                      <LIcon name="scissors" :size="15" />
                      <span>{{ isCapturing ? '截取中...' : '截取屏幕' }}</span>
                    </button>
                  </div>
                </section>

                <!-- 2. 礼拜模式 Tab -->
                <section v-else-if="activeTab === 'prayer'" key="mob-prayer" class="pc-tab-panel">
                  <!-- 智慧建议模式 -->
                  <div class="pc-card">
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

                  <!-- 灵动岛模拟 -->
                  <div class="pc-card">
                    <div class="pc-card-header">
                      <span class="pc-card-title">灵动岛</span>
                      <span v-if="prayerStore.currentIslandPrayer" class="pc-state-tag is-on">
                        {{ i18n.prayerName(prayerStore.currentIslandPrayer.id) }}中
                      </span>
                    </div>
                    <div class="prayer-buttons-grid">
                      <button
                        v-for="p in prayerStore.prayers"
                        :key="p.id"
                        class="pc-prayer-btn"
                        :class="{ on: prayerStore.currentIslandPrayer?.id === p.id }"
                        @click="prayerStore.toggleSimulatedPrayer(p.id)"
                      >
                        {{ i18n.prayerName(p.id) }}
                      </button>
                    </div>

                    <!-- 闹钟灵动岛控制 -->
                    <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08);">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 12px; color: rgba(255,255,255,0.65); font-weight: 500;">闹钟提醒</span>
                        <span v-if="clockStore.isAlarmActive" class="pc-state-tag is-on">
                          {{ clockStore.isAlarmRinging ? '响铃中' : '延时倒计时' }}
                        </span>
                      </div>
                      <div style="display: flex; gap: 8px;">
                        <button
                          class="pc-prayer-btn pc-alarm-trigger-btn"
                          style="flex: 1;"
                          :class="{ on: clockStore.isAlarmRinging }"
                          @click="clockStore.isAlarmRinging ? clockStore.dismissAlarm() : clockStore.triggerAlarm()"
                        >
                          <svg class="pc-alarm-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path :d="CLOCK_ICONS.alarm" />
                          </svg>
                          <span>{{ clockStore.isAlarmRinging ? '关闭闹钟' : '闹钟' }}</span>
                        </button>
                        <button
                          v-if="clockStore.isAlarmActive"
                          class="pc-prayer-btn"
                          style="flex: 1;"
                          :class="{ on: clockStore.isAlarmSnoozing }"
                          @click="clockStore.snoozeAlarm()"
                        >
                          {{ clockStore.isAlarmSnoozing ? '重置10分' : '延时10分' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <!-- 3. 控制中心 Tab -->
                <section v-else-if="activeTab === 'control'" key="mob-control" class="pc-tab-panel">
                  <!-- 默认布局：tOS16 / tOS17 两行对照，同一张卡片内 -->
                  <div class="pc-card">
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

                  <!-- 排列算法 -->
                  <div class="pc-card">
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

                  <!-- 隐私指示 + 双卡显示（一行两块底板） -->
                  <div class="pc-card-duo">
                    <div class="pc-card pc-card-single">
                      <div class="pc-card-header">
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
                    </div>
                    <div class="pc-card pc-card-single">
                      <div class="pc-card-header">
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

                  <!-- 微调图标尺寸 (放置在最下方，开关打开后卡片内展开完整面板) -->
                  <div class="pc-card" :class="control.fineTuningMode ? 'pc-card-expanded' : 'pc-card-single'">
                    <div class="pc-card-header">
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
                    <!-- 开关开启时展开微调控制面板（无缝过渡动效） -->
                    <Transition name="finetune-expand">
                      <ControlCenterFineTunePanel v-if="control.fineTuningMode" />
                    </Transition>
                  </div>
                </section>
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
  padding: 16px;
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

/* 顶部标题栏 (上下居中) */
.pc-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 2px 0 4px;
  margin-bottom: 0;
}

.pc-title {
  font: 800 15.5px/1.2 var(--font-stack);
  letter-spacing: -0.2px;
  color: #ffffff;
  margin: 0;
  text-align: center;
}

/* ================= 模块切换卡片 & Tab 导航条 ================= */
.pc-tab-card {
  padding: 11px 13px 12px;
}

.mobile-tab-card {
  margin: 0 16px 12px;
}

.pc-tab-bar {
  position: relative;
  display: flex;
  background: #101014;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 3px;
  margin-bottom: 0;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}

.pc-tab-indicator {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(33.333% - 2px);
  background: #2563eb;
  border-radius: 9px;
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.45);
}

.pc-tab-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 7px 0;
  font: 600 12px/1 var(--font-stack);
  color: #a1a1aa;
  text-align: center;
  border-radius: 9px;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: color 0.2s ease;
  -webkit-tap-highlight-color: transparent !important;
  outline: none !important;
  user-select: none;
}

.pc-tab-btn:hover {
  color: #e4e4e7;
}

.pc-tab-btn.active {
  color: #ffffff;
  font-weight: 700;
}

/* ================= 卡片与控件 ================= */
.pc-content-body {
  position: relative;
  min-height: 280px;
}

.pc-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.pc-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}

/* 只有标题一行的卡片（隐私指示/双卡显示单行底板 / 微调图标尺寸收起态）：
   通用卡片 padding 是 11px 13px 13px（上小下大，为多行内容留呼吸感），
   单行卡片改用对称的 12px，标题+开关正好落在卡片垂直中心（卡片总高不变） */
.pc-card.pc-card-single {
  padding-top: 12px;
  padding-bottom: 12px;
}
.pc-card.pc-card-single .pc-card-header {
  margin-bottom: 0;
}

/* 一行放两块底板（隐私指示 / 双卡显示）：
   两块各占一半（flex 1:1，min-width 0 防止长标题把格子撑歪），
   高度 stretch 对齐，间距 10 与其它卡片之间的间距同档 */
.pc-card-duo {
  display: flex;
  align-items: stretch;
  gap: 10px;
}
.pc-card-duo > .pc-card {
  flex: 1 1 0;
  min-width: 0;
}
/* 微调面板展开态：面板自带 margin/padding-top 间距，标题与面板之间保持原有的 0 间隙 */
.pc-card.pc-card-expanded .pc-card-header {
  margin-bottom: 0;
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

.pc-card-title {
  font: 600 12.5px/1.2 var(--font-stack);
  color: #f4f4f5;
  letter-spacing: 0.1px;
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

.pc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #52525b;
}

.pc-state-tag.is-on .pc-dot {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

/* 默认布局：tOS16 / tOS17 两行对照（同一张卡片内） */
.pc-preset-rows {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 两行 6 个按钮共用一个滑块：位置由 JS 实测目标按钮写入 transform，
   所以跨行切换也是连续位移，不会先在行首闪一下。
   z-index 1 与按钮同级 —— 靠 DOM 顺序（滑块在前）压在按钮文字之下、
   .pc-seg 底板之上。 */
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

/* 首帧直接就位，不加过渡；之后才开启动画 */
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
.pc-btn-group-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.pc-btn {
  width: 100%;
  padding: 10px 0;
  border-radius: 12px;
  font: 700 13px/1 var(--font-stack);
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

/* 转码中的沙漏（纯状态指示，不是功能图标） */
.pc-rec-spin {
  display: inline-block;
  margin-right: 6px;
}

/* 录屏 / 截图按钮的图标直接用控制中心同款矢量图（LIcon），
   这里只补「图标与文字之间」的间距 —— 保持两者是同一个控件语言 */
.pc-btn :deep(.l-icon) {
  margin-right: 7px;
}

.pc-btn-toggle.pc-btn-danger {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  box-shadow: none;
}

.pc-btn-toggle.pc-btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.28);
  color: #ffffff;
}

.pc-btn-toggle.pc-btn-primary {
  background: rgba(16, 185, 129, 0.16);
  border-color: rgba(16, 185, 129, 0.4);
  color: #6ee7b7;
  box-shadow: none;
}

.pc-btn-toggle.pc-btn-primary:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.28);
  color: #ffffff;
}

/* 礼拜按钮组 */
.prayer-buttons-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
}

.pc-prayer-btn {
  padding: 8px 0;
  border-radius: 9px;
  font: 600 12px/1 var(--font-stack);
  background: #101014;
  border: 1px solid #27272a;
  color: #d4d4d8;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  -webkit-tap-highlight-color: transparent !important;
  outline: none !important;
  user-select: none;
}

.pc-prayer-btn:hover {
  background: #27272a;
  color: #ffffff;
}

.pc-prayer-btn.on {
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

/* 提示卡片 */
.pc-hint-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  background: rgba(37, 99, 235, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 14px;
}

.pc-hint-icon {
  color: #60a5fa;
  margin-top: 1px;
  flex-shrink: 0;
}

.pc-hint-text {
  font: 500 11.5px/1.45 var(--font-stack);
  color: #bfdbfe;
  margin: 0;
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
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
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
