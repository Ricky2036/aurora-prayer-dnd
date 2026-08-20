<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import PhoneFrame from './components/phone/PhoneFrame.vue'
import ScreenView from './components/phone/ScreenView.vue'
import { useControlStore } from './stores/controlStore'
import { useSystemStore } from './stores/systemStore'
import { usePrayerStore } from './stores/prayerStore'
import { useI18nStore } from './stores/i18nStore'

/**
 * 舞台：说明文字 + 手机 + 原型配置控制台。
 * 控制台（移植自 android_control_center.tsx Prototype Console Panel）：
 * 拖拽排列算法切换（流式推挤 Flow / 绝对坐标沉降 swap）、编辑模式开关、亮灭屏模拟、朝拜勿扰灵动岛切换、多语言切换。
 */
const control = useControlStore()
const system = useSystemStore()
const prayerStore = usePrayerStore()
const i18n = useI18nStore()

/** 舞台缩放：窗口太小时整体等比缩小手机，保证完整可见 */
const stageRef = ref(null)
const phoneScaleRef = ref(null)
const scale = ref(1)

let fitStage = null

onMounted(() => {
  fitStage = () => {
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
    const targetSelector = recordWithFrame.value ? '.phone-scale' : '.screen'
    const targetEl = stageRef.value?.querySelector(targetSelector)
    const shapeEl = recordWithFrame.value
      ? targetEl?.querySelector('.phone-frame') || targetEl
      : targetEl
    const shapeWidth = shapeEl?.offsetWidth || 1
    const shapeRadius = shapeEl
      ? Number.parseFloat(getComputedStyle(shapeEl).borderTopLeftRadius) || 0
      : 0
    const captureRadiusRatio = shapeRadius / shapeWidth

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      preferCurrentTab: true,
      audio: false
    })
    
    // 尝试使用 Region Capture API 仅截取指定区域
    if (window.CropTarget && targetEl) {
      if (targetEl) {
        try {
          const cropTarget = await CropTarget.fromElement(targetEl)
          const [track] = stream.getVideoTracks()
          await track.cropTo(cropTarget)
        } catch (e) {
          console.warn('裁剪录制区域失败 (Region Capture API)', e)
        }
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
        ctx.beginPath()
        
        // 圆角读取当前实际录制元素，避免屏幕/机身尺寸变化后继续使用旧常量。
        const radius = canvas.width * captureRadiusRatio
        
        if (ctx.roundRect) {
          ctx.roundRect(0, 0, canvas.width, canvas.height, radius)
        } else {
          ctx.rect(0, 0, canvas.width, canvas.height)
        }
        ctx.clip()
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        ctx.restore()
        
        animationId = requestAnimationFrame(drawFrame)
      }
      isDrawing = true
      drawFrame()
      
      const canvasStream = canvas.captureStream(60) // 60 FPS
      recordedChunks = []

      // 优先采用 H.265 / HEVC 编码与 MP4 封装
      const preferredMimeTypes = [
        'video/mp4;codecs=hevc,mp4a.40.2',
        'video/mp4;codecs=hevc',
        'video/mp4;codecs=hvc1',
        'video/mp4;codecs=h265',
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=h265',
        'video/webm;codecs=vp9',
        'video/webm'
      ]

      let selectedMime = ''
      for (const mime of preferredMimeTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime
          break
        }
      }

      const recorderOptions = {
        videoBitsPerSecond: 8000000 // 8 Mbps 高清画质
      }
      if (selectedMime) {
        recorderOptions.mimeType = selectedMime
      }

      mediaRecorder = new MediaRecorder(canvasStream, recorderOptions)
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data)
      }
      
      mediaRecorder.onstop = () => {
        const outMime = selectedMime || 'video/mp4'
        const blob = new Blob(recordedChunks, { type: outMime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `prototype-recording-${Date.now()}.mp4`
        a.click()
        URL.revokeObjectURL(url)
        
        isRecording.value = false
        isDrawing = false
        cancelAnimationFrame(animationId)
        stream.getTracks().forEach(t => t.stop())
        video.remove()
        canvas.remove()
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
  <div class="stage" ref="stageRef">
    <div ref="phoneScaleRef" class="phone-scale" :style="{ transform: `scale(${scale})` }">
      <PhoneFrame>
        <ScreenView />
      </PhoneFrame>
    </div>

    <!-- ================= 原型配置控制台 ================= -->
    <div class="proto-console">
      <div class="pc-glow"></div>
      <h2 class="pc-title">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>
        原型配置控制台
      </h2>

      <!-- 语言切换：中文 / 英文 / 孟加拉语 -->
      <div class="pc-block">
        <p class="pc-label">
          <span>系统语言</span>
          <span class="pc-badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc;">LANG</span>
        </p>
        <div class="pc-seg pc-lang-seg">
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
          <button
            class="pc-seg-btn"
            :class="{ on: i18n.locale === 'zh' }"
            @click="i18n.setLocale('zh')"
          >
            中文
          </button>
          <button
            class="pc-seg-btn"
            :class="{ on: i18n.locale === 'en' }"
            @click="i18n.setLocale('en')"
          >
            English
          </button>
          <button
            class="pc-seg-btn"
            :class="{ on: i18n.locale === 'bn' }"
            @click="i18n.setLocale('bn')"
          >
            বাংলা
          </button>
        </div>
      </div>

      <!-- 智慧建议：普通用户 / 穆斯林用户 -->
      <div class="pc-block">
        <p class="pc-label">
          <span>智慧建议</span>
          <span class="pc-badge" style="background: rgba(234, 179, 8, 0.2); color: #facc15;">STACK</span>
        </p>
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

      <!-- 朝拜勿扰灵动岛模拟控制 -->
      <div class="pc-block">
        <p class="pc-label">
          <span>朝拜勿扰灵动岛</span>
          <span class="pc-badge" style="background: rgba(52, 199, 89, 0.2); color: #34c759;">LIVE</span>
        </p>
        <div class="prayer-buttons-grid">
          <button
            v-for="p in prayerStore.prayers"
            :key="p.id"
            class="pc-prayer-btn"
            :class="{ on: prayerStore.currentIslandPrayer?.id === p.id }"
            @click="prayerStore.toggleSimulatedPrayer(p.id)"
          >
            {{ p.cnName }}
          </button>
        </div>
      </div>

      <!-- 拖拽排列算法 -->
      <div class="pc-block">
        <p class="pc-label">控制中心编辑</p>
        <div class="pc-seg">
          <div class="pc-seg-thumb" :style="{ transform: control.dragMode === 'flow' ? 'translateX(0)' : 'translateX(100%)' }"></div>
          <button class="pc-seg-btn" :class="{ on: control.dragMode === 'flow' }" @click="control.setDragMode('flow')">流式推挤</button>
          <button class="pc-seg-btn" :class="{ on: control.dragMode === 'swap' }" @click="control.setDragMode('swap')">坐标沉降</button>
        </div>
      </div>

      <!-- 亮灭屏控制 -->
      <div class="pc-block">
        <p class="pc-label">屏幕状态</p>
        <div class="pc-actions">
          <button class="pc-btn" :class="system.screenOn ? 'pc-btn-danger' : 'pc-btn-primary'" @click="system.screenOn ? system.powerOff() : system.powerOn()">
            {{ system.screenOn ? '熄灭屏幕' : '点亮屏幕' }}
          </button>
        </div>
      </div>

      <!-- 录屏功能 -->
      <div class="pc-block">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <p class="pc-label" style="margin-bottom: 0;">录制屏幕</p>
          <label class="pc-switch-wrap">
            <span>带壳录制</span>
            <input type="checkbox" v-model="recordWithFrame" />
            <div class="pc-switch"></div>
          </label>
        </div>
        <div class="pc-actions">
          <button class="pc-btn" :class="isRecording ? 'pc-btn-danger' : 'pc-btn-primary'" @click="toggleRecording">
            {{ isRecording ? '⏹ 停止录制' : '⏺ 开始录制' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.phone-scale {
  transform-origin: center center;
  transition: transform 0.2s ease;
}

/* ================= 控制台 ================= */
.proto-console {
  position: relative;
  width: 300px;
  flex: none;
  background: #1a1a1a;
  border-radius: 28px;
  padding: 24px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  align-self: center;
}
.pc-glow {
  position: absolute;
  top: -60px;
  right: -60px;
  width: 180px;
  height: 180px;
  background: rgba(59, 130, 246, 0.22);
  filter: blur(60px);
  border-radius: 50%;
  pointer-events: none;
}
.pc-title {
  position: relative;
  z-index: 1;
  font: 700 18px/1.3 var(--font-stack);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  letter-spacing: 0.2px;
}
.pc-block { position: relative; z-index: 1; margin-bottom: 20px; }
.pc-label {
  font: 500 13px/1.4 var(--font-stack);
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.pc-badge {
  padding: 3px 8px;
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  font-size: 10px;
  font-weight: 700;
  border-radius: 6px;
}
.pc-seg {
  position: relative;
  display: flex;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 16px;
  padding: 4px;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
}
.pc-seg-thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: calc(50% - 4px);
  background: #3a3a3c;
  border-radius: 12px;
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.pc-seg-thumb-3 {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: calc(33.333% - 2.6px);
  background: #3a3a3c;
  border-radius: 12px;
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.pc-seg-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 9px 0;
  font: 500 13px/1 var(--font-stack);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: color 0.25s ease;
}
.pc-seg-btn.on { color: #fff; }
.pc-desc {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  font: 400 12px/1.7 var(--font-stack);
  color: rgba(255, 255, 255, 0.6);
  min-height: 80px;
}
.pc-desc-title { color: rgba(255, 255, 255, 0.92); font-weight: 700; display: block; margin-bottom: 2px; }

.pc-actions { display: flex; gap: 10px; }
.pc-btn {
  flex: 1;
  padding: 11px 0;
  border-radius: 12px;
  font: 600 13px/1 var(--font-stack);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.1s ease, opacity 0.2s;
}
.pc-btn:hover { background: rgba(255, 255, 255, 0.18); }
.pc-btn:active { transform: scale(0.96); }
.pc-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
.pc-btn.on { background: #2563eb; border-color: rgba(37, 99, 235, 0.6); }
.pc-btn-danger { background: rgba(239, 68, 68, 0.18); border-color: rgba(239, 68, 68, 0.35); }
.pc-btn-danger:hover:not(:disabled) { background: rgba(239, 68, 68, 0.32); }
.pc-btn-primary { background: rgba(37, 99, 235, 0.22); border-color: rgba(37, 99, 235, 0.4); }
.pc-btn-primary:hover:not(:disabled) { background: rgba(37, 99, 235, 0.4); }
.pc-state {
  margin-top: 10px;
  font: 400 11px/1.5 var(--font-stack);
  color: rgba(255, 255, 255, 0.45);
}

.prayer-buttons-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-bottom: 4px;
}
.pc-prayer-btn {
  padding: 8px 0;
  border-radius: 8px;
  font: 600 12px/1 var(--font-stack);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: all 0.15s ease;
}
.pc-prayer-btn:hover {
  background: rgba(255, 255, 255, 0.16);
}
.pc-prayer-btn.on {
  background: #34c759;
  border-color: #34c759;
  color: #fff;
  box-shadow: 0 2px 8px rgba(52, 199, 89, 0.35);
}

.pc-switch-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font: 400 11px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.5);
  user-select: none;
}
.pc-switch-wrap input { display: none; }
.pc-switch {
  position: relative;
  width: 28px;
  height: 16px;
  background: rgba(255, 255, 255, 0.2);
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
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.pc-switch-wrap input:checked + .pc-switch { background: #2563eb; }
.pc-switch-wrap input:checked + .pc-switch::after { transform: translateX(12px); }
</style>
