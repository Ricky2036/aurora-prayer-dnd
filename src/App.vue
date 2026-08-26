<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import PhoneFrame from './components/phone/PhoneFrame.vue'
import ScreenView from './components/phone/ScreenView.vue'
import DevConsole from './components/dev/DevConsole.vue'

/**
 * 舞台：手机 + 原型配置控制台。
 * 移动端适配：
 * 1. 手机端打开网页：不显示手机金属外壳与外层阴影边框，整个 OS 满屏铺满展示；
 * 2. 手机端控制台改为在屏幕上的半透明悬浮按钮（FAB），支持点击展开/收起底部控制台抽屉，支持拖拽更改位置（吸边吸附）。
 * 3. 桌面端保留原有手机外壳与侧边栏控制台。
 */
const stageRef = ref(null)
const phoneScaleRef = ref(null)
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
    const phoneH = (phoneScaleRef.value?.offsetHeight || 870) + 60
    const s = Math.min(1, (window.innerHeight - 32) / phoneH)
    scale.value = Math.max(0.62, s)
  }
  fitStage()
  window.addEventListener('resize', fitStage)
})

onBeforeUnmount(() => {
  if (fitStage) window.removeEventListener('resize', fitStage)
})

/* ================= 录屏功能 ================= */
const isRecording = ref(false)
const isTranscoding = ref(false)
const recordWithFrame = ref(true)
let mediaRecorder = null
let recordedChunks = []

async function toggleRecording() {
  if (isRecording.value) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    return
  }
  
  try {
    const targetSelector = isMobile.value ? '.screen' : (recordWithFrame.value ? '.phone-scale' : '.screen')
    const targetEl = stageRef.value?.querySelector(targetSelector)
    const shapeEl = (!isMobile.value && recordWithFrame.value)
      ? targetEl?.querySelector('.phone-frame') || targetEl
      : targetEl
    const shapeWidth = shapeEl?.offsetWidth || 1
    const shapeRadius = (!isMobile.value && shapeEl)
      ? Number.parseFloat(getComputedStyle(shapeEl).borderTopLeftRadius) || 0
      : 44
    const captureRadiusRatio = shapeRadius / shapeWidth

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      preferCurrentTab: true,
      audio: false
    })
    
    // 尝试使用 Region Capture API 仅截取指定区域
    if (window.CropTarget && targetEl) {
      try {
        const cropTarget = await CropTarget.fromElement(targetEl)
        const [track] = stream.getVideoTracks()
        await track.cropTo(cropTarget)
      } catch (e) {
        console.warn('裁剪录制区域失败 (Region Capture API)', e)
      }
    }
    
    // 隐藏的 Video 用于播放获取到的流
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    
    // 隐藏的 Canvas 用于处理透明圆角
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { alpha: true })
    
    let animationId
    let isDrawing = false
    
    video.onloadedmetadata = async () => {
      try { await video.play() } catch (e) {}
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const drawFrame = () => {
        if (!isDrawing) return
        
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        
        // 严格圆角透明裁切
        const radius = canvas.width * captureRadiusRatio
        if (radius > 0) {
          ctx.beginPath()
          if (ctx.roundRect) {
            ctx.roundRect(0, 0, canvas.width, canvas.height, radius)
          } else {
            ctx.rect(0, 0, canvas.width, canvas.height)
          }
          ctx.clip()
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.restore()
        
        animationId = requestAnimationFrame(drawFrame)
      }
      isDrawing = true
      drawFrame()
      
      const canvasStream = canvas.captureStream(60) // 60 FPS
      recordedChunks = []

      // 优先采用支持透明通道的编码
      const preferredMimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4;codecs=hevc',
        'video/mp4'
      ]

      let selectedMime = ''
      for (const mime of preferredMimeTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime
          break
        }
      }

      const recorderOptions = {
        videoBitsPerSecond: 10000000 // 10 Mbps 高码率
      }
      if (selectedMime) {
        recorderOptions.mimeType = selectedMime
      }

      mediaRecorder = new MediaRecorder(canvasStream, recorderOptions)
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data)
      }
      
      mediaRecorder.onstop = async () => {
        isRecording.value = false
        isTranscoding.value = true
        isDrawing = false
        cancelAnimationFrame(animationId)
        stream.getTracks().forEach(t => t.stop())
        video.remove()
        canvas.remove()

        const outMime = selectedMime || 'video/webm'
        const rawBlob = new Blob(recordedChunks, { type: outMime })

        // 自动调用硬件转码管道（转为 Apple 原生 ProRes 4444 with Alpha .mov）
        try {
          const res = await fetch(`/__transcode_mov?radiusRatio=${captureRadiusRatio}`, {
            method: 'POST',
            body: rawBlob
          })
          if (res.ok) {
            const movBlob = await res.blob()
            const url = URL.createObjectURL(movBlob)
            const a = document.createElement('a')
            a.href = url
            a.download = `prototype-alpha-${Date.now()}.mov`
            a.click()
            URL.revokeObjectURL(url)
            isTranscoding.value = false
            return
          }
        } catch (e) {
          console.warn('本地转码接口未响应，回退直接下载透明 WebM 文件', e)
        }

        // 静态托管环境（如 GitHub Pages）回退直接下载原生透明 WebM 视频
        const url = URL.createObjectURL(rawBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `prototype-alpha-${Date.now()}.webm`
        a.click()
        URL.revokeObjectURL(url)
        isTranscoding.value = false
      }
      
      mediaRecorder.start()
      isRecording.value = true
    }
    
    stream.getVideoTracks()[0].onended = () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      }
    }
    
  } catch (err) {
    console.error('Failed to start recording', err)
  }
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
      v-model:record-with-frame="recordWithFrame"
      @toggle-recording="toggleRecording"
    />
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
    radial-gradient(1200px 800px at 18% 12%, rgba(120, 119, 198, 0.28), transparent 60%),
    radial-gradient(1000px 700px at 85% 80%, rgba(90, 200, 250, 0.22), transparent 55%),
    linear-gradient(160deg, #e8e8ee 0%, #d9d9e3 50%, #cfcfd9 100%);
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
</style>
