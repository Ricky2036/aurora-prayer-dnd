<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import PhoneFrame from './components/phone/PhoneFrame.vue'
import ScreenView from './components/phone/ScreenView.vue'
import DevConsole from './components/dev/DevConsole.vue'
import { useSystemStore } from './stores/systemStore'
import { useControlStore } from './stores/controlStore'
import { useCapture } from './composables/useCapture'

/**
 * 舞台：手机 + 原型配置控制台。
 * 移动端适配：
 * 1. 手机端打开网页：不显示手机金属外壳与外层阴影边框，整个 OS 满屏铺满展示；
 * 2. 手机端控制台改为在屏幕上的半透明悬浮按钮（FAB），支持点击展开/收起底部控制台抽屉，支持拖拽更改位置（吸边吸附）。
 * 3. 桌面端保留原有手机外壳与侧边栏控制台。
 */
const stageRef = ref(null)
const phoneScaleRef = ref(null)
const system = useSystemStore()
const control = useControlStore()
const scale = ref(1)
const isMobile = ref(false)

function checkMobile() {
  if (typeof window === 'undefined') return
  const isTouchDevice = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
  const isSmallScreen = window.innerWidth <= 768
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  isMobile.value = isMobileUA || (isSmallScreen && isTouchDevice) || isSmallScreen
}

let fitStage = null

onMounted(() => {
  fitStage = () => {
    checkMobile()
    if (isMobile.value) {
      scale.value = 1
      return
    }
    const phoneH = (phoneScaleRef.value?.offsetHeight || 810) + 60
    const s = Math.min(1, (window.innerHeight - 32) / phoneH)
    scale.value = Math.max(0.62, s)
  }
  fitStage()
  window.addEventListener('resize', fitStage)
})

onBeforeUnmount(() => {
  if (fitStage) window.removeEventListener('resize', fitStage)
})

/* ================= 录屏 / 截图 ================= */
/* 录制状态与实现收敛到 useCapture 单例：控制台和控制中心共用同一份，
   保证「控制中心开始录屏 → 控制台点停止」能停止同一个录制任务。 */
const {
  isRecording,
  isTranscoding,
  isCapturing,
  recordElapsed,
  recordWithFrame,
  screenshotWithFrame,
  toasts,
  toggleRecording: runRecording,
  captureScreenshot: runScreenshot
} = useCapture()

/** 控制台：连外壳 + 圆角裁切 + 转码 ProRes（演示素材管线，行为保持原样） */
function toggleRecording() {
  runRecording({
    withFrame: !isMobile.value && recordWithFrame.value,
    rounded: true,
    transcode: true,
    preferMp4: false
  })
}

/**
 * 控制台截图：带壳 = 连金属外壳一起截；不带壳 = 只截屏幕本体，
 * 且**不做圆角裁切**（四角为直角矩形）。移动端本来就没有外壳，一律按不带壳处理。
 */
function takeScreenshot() {
  return runScreenshot({
    withFrame: !isMobile.value && screenshotWithFrame.value,
    rounded: false
  })
}
</script>

<template>
  <div class="stage" :class="{ 'is-mobile': isMobile }" ref="stageRef">
    <!-- 移动端：直接无外壳全屏满铺 -->
    <div v-if="isMobile" class="mobile-screen-wrap">
      <div class="screen mobile-screen">
        <ScreenView />
      </div>
    </div>

    <!-- 桌面端：带金属外壳与等比居中缩放 -->
    <div v-else ref="phoneScaleRef" class="phone-scale" :style="{ transform: `scale(${scale})` }">
      <PhoneFrame>
        <ScreenView />
      </PhoneFrame>
    </div>

    <!-- 控制台：桌面侧边栏 / 移动端悬浮球与抽屉 -->
    <DevConsole
      :mode="isMobile ? 'mobile' : 'desktop'"
      :is-recording="isRecording"
      :is-transcoding="isTranscoding"
      :is-capturing="isCapturing"
      v-model:record-with-frame="recordWithFrame"
      v-model:screenshot-with-frame="screenshotWithFrame"
      @toggle-recording="toggleRecording"
      @capture-screenshot="takeScreenshot"
    />

    <!-- 录制中指示器：红点 + 计时。
         位置刻意放在手机屏幕之外，所以不会被录进视频里。 -->
    <Transition name="rec">
      <div v-if="isRecording" class="rec-pill" role="status" aria-live="polite">
        <span class="rec-dot" />
        <span class="rec-time">{{ recordElapsed }}</span>
      </div>
    </Transition>

    <!-- 截图/录屏的结果提示：以前失败只写 console，界面毫无动静，
         看起来就是「点了没反应」。 -->
    <div class="toast-layer" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="`is-${t.kind}`">
          {{ t.text }}
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.stage {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48px;
  background:
    radial-gradient(1200px 800px at 15% 15%, rgba(99, 102, 241, 0.18), transparent 60%),
    radial-gradient(1000px 700px at 85% 85%, rgba(59, 130, 246, 0.15), transparent 55%),
    linear-gradient(145deg, #111218 0%, #0a0b0e 100%);
}

.stage.is-mobile {
  width: 100vw;
  height: 100dvh;
  padding: 0;
  margin: 0;
  gap: 0;
  background: #000;
  overflow: hidden;
  position: fixed;
  inset: 0;
}

.mobile-screen-wrap {
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  position: relative;
  background: #000;
}

.mobile-screen {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 0 !important;
  overflow: hidden;
  background: #000;
  container-type: size;
}

.mobile-screen :deep(.screen-view) {
  border-radius: 0 !important;
}

.phone-scale {
  transform-origin: center center;
  transition: transform 0.2s ease;
}

/* ============ 录制中指示器 ============ */
.rec-pill {
  position: fixed;
  top: 18px;
  left: 50%;
  z-index: 9998;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px 7px 12px;
  border-radius: 999px;
  background: rgba(20, 20, 24, 0.72);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.35);
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.2px;
  pointer-events: none;
}

.rec-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ff3b30;
  animation: rec-blink 1.4s ease-in-out infinite;
}

.rec-time {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}

@keyframes rec-blink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.82); }
}

.rec-enter-active { transition: all 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
.rec-leave-active { transition: all 0.24s ease; }
.rec-enter-from { opacity: 0; transform: translate(-50%, -14px) scale(0.9); }
.rec-leave-to { opacity: 0; transform: translate(-50%, -8px) scale(0.96); }

/* ============ 结果提示 ============ */
.toast-layer {
  position: fixed;
  left: 50%;
  bottom: 30px;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.toast {
  max-width: 78vw;
  padding: 10px 18px;
  border-radius: 14px;
  background: rgba(24, 24, 28, 0.86);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  color: #f2f2f7;
  font-size: 13.5px;
  line-height: 1.45;
  text-align: center;
}

.toast.is-success { color: #7bf0a8; }
.toast.is-error { color: #ff9d95; }

.toast-enter-active { transition: all 0.44s cubic-bezier(0.34, 1.56, 0.64, 1); }
.toast-leave-active { transition: all 0.26s ease; position: absolute; }
.toast-enter-from { opacity: 0; transform: translateY(14px) scale(0.94); }
.toast-leave-to { opacity: 0; transform: translateY(6px) scale(0.97); }
.toast-move { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
</style>

<!-- 采集态（录屏/截图）：与移动端完全同一套处理 —— 把屏幕圆角归零。
     屏幕本体是圆角 + overflow:hidden，直接录它的外接矩形时，四个角会露出
     圆角外的黑色机身。移动端正是靠 border-radius:0 做到无边框满屏的，
     录/截时复用这个状态，四角自然就是壁纸，不需要任何后期修补。 -->
<style>
body.is-capturing .screen,
body.is-capturing .screen-view,
body.is-capturing .mobile-screen,
body.is-capturing .app-window,
body.is-capturing .aw-clip {
  border-radius: 0 !important;
  clip-path: none !important;
}

body.is-capturing:has(.app-window) .wallpaper {
  opacity: 0 !important;
}
</style>
