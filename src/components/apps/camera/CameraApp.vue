<script setup>
import { ref } from 'vue'
import { GLYPHS } from '../../../assets/icons/glyphs'

/**
 * 相机：取景器（渐变场景 + 网格线 + 点按对焦）、模式滑条、快门（闪光动效）、相册缩略图。
 */
const props = defineProps({ app: Object })

const MODES = ['延时摄影', '视频', '照片', '人像', '全景']
const mode = ref('照片')

/** 点按对焦：显示对焦框 1.2s */
const focusPoint = ref(null)
let focusTimer = null
function onViewfinderTap(e) {
  const r = e.currentTarget.getBoundingClientRect()
  focusPoint.value = {
    x: ((e.clientX - r.left) / r.width) * 100,
    y: ((e.clientY - r.top) / r.height) * 100
  }
  clearTimeout(focusTimer)
  focusTimer = setTimeout(() => (focusPoint.value = null), 1200)
}

/** 快门：白闪 + 缩略图更新 */
const flashing = ref(false)
const shotCount = ref(0)
function shutter() {
  flashing.value = true
  setTimeout(() => (flashing.value = false), 180)
  shotCount.value++
}
</script>

<template>
  <div class="camera-app">
    <!-- 取景器 -->
    <div class="viewfinder" @click="onViewfinderTap">
      <!-- 模拟场景：黄昏天空渐变 -->
      <div class="scene"></div>
      <!-- 网格线 -->
      <div class="grid-lines">
        <i class="v" style="left: 33.3%"></i>
        <i class="v" style="left: 66.6%"></i>
        <i class="h" style="top: 33.3%"></i>
        <i class="h" style="top: 66.6%"></i>
      </div>
      <!-- 对焦框 -->
      <div
        v-if="focusPoint"
        class="focus-box"
        :style="{ left: focusPoint.x + '%', top: focusPoint.y + '%' }"
      ></div>
      <!-- 顶部工具 -->
      <div class="vf-top">
        <svg width="20" height="20" viewBox="0 0 24 24"><path d="M13 2L3 14h7v8l10-12h-7V2z" fill="#fff" opacity="0.9"/></svg>
        <svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="#fff" opacity="0.9"/></svg>
      </div>
      <!-- 闪光 -->
      <div class="flash" :class="{ on: flashing }"></div>
    </div>

    <!-- 模式滑条 -->
    <div class="mode-bar">
      <button
        v-for="m in MODES"
        :key="m"
        class="mode-item"
        :class="{ active: m === mode }"
        @click="mode = m"
      >{{ m }}</button>
    </div>

    <!-- 底部控制区 -->
    <div class="control-bar">
      <div class="thumbnail" :class="{ 'has-shot': shotCount > 0 }">
        <div class="thumb-scene"></div>
        <span v-if="shotCount" class="thumb-count">{{ shotCount }}</span>
      </div>
      <button class="shutter" @click="shutter">
        <span class="shutter-inner"></span>
      </button>
      <button class="flip">
        <svg width="26" height="26" viewBox="0 0 24 24">
          <path d="M12 6c-2.76 0-5 2.24-5 5 0 .35.04.69.1 1.02L5.5 10.6C5.18 11.07 5.1 11.53 5.28 12c.36.93 1.26 1.5 2.72 1.5 1.85 0 3.32-.91 3.85-2.5h1.15C12.35 12.91 10.88 14 8.5 14 6.57 14 5 12.76 5 11c0-.28.02-.55.05-.82L3 12.13C3 11.42 3 10.72 3.1 10.02 3.5 6.67 6.76 4 12 4c1.93 0 3.68.55 5 1.5V4h2v5h-5V7.5c.6-.3 1.3-.5 2-.5z" fill="#fff" transform="rotate(45 12 12)"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.camera-app {
  height: 100%;
  background: #000;
  display: flex;
  flex-direction: column;
}

.viewfinder {
  position: relative;
  flex: 1;
  overflow: hidden;
}
.scene {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(60% 45% at 72% 30%, rgba(255, 214, 130, 0.85) 0%, transparent 60%),
    radial-gradient(80% 60% at 20% 75%, rgba(40, 60, 120, 0.7) 0%, transparent 65%),
    linear-gradient(180deg, #2b3a67 0%, #7a4a6e 46%, #e8875a 72%, #2c3e50 100%);
}
.scene::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(18% 12% at 30% 62%, rgba(20, 24, 40, 0.85), transparent 70%),
    radial-gradient(24% 16% at 68% 70%, rgba(16, 20, 34, 0.9), transparent 70%);
}
.grid-lines i {
  position: absolute;
  background: rgba(255, 255, 255, 0.22);
}
.grid-lines .v { top: 0; bottom: 0; width: 0.5px; }
.grid-lines .h { left: 0; right: 0; height: 0.5px; }

.focus-box {
  position: absolute;
  width: 76px;
  height: 76px;
  border: 1.5px solid #FFD60A;
  transform: translate(-50%, -50%);
  animation: focus-in 0.25s ease;
}
@keyframes focus-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

.vf-top {
  position: absolute;
  top: calc(var(--safe-top) + 6px);
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 20px;
}

.flash {
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  pointer-events: none;
}
.flash.on {
  animation: flash 0.18s ease;
}
@keyframes flash {
  0% { opacity: 0; }
  30% { opacity: 0.95; }
  100% { opacity: 0; }
}

.mode-bar {
  flex: none;
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 12px 0;
  background: #000;
}
.mode-item {
  font: 500 13px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.65);
  transition: color 0.15s ease;
}
.mode-item.active { color: #FFD60A; }

.control-bar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 30px calc(var(--safe-bottom) + 12px);
  background: #000;
}
.thumbnail {
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.25);
}
.thumb-scene {
  width: 100%;
  height: 100%;
  background: linear-gradient(160deg, #3a4a6a, #7a5a4a);
  opacity: 0.5;
}
.thumbnail.has-shot .thumb-scene { opacity: 1; }
.thumb-count {
  position: absolute;
  right: 3px;
  bottom: 2px;
  font: 600 10px/1 var(--font-stack);
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
}
.shutter {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: 4px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}
.shutter-inner {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.1s ease;
}
.shutter:active .shutter-inner { transform: scale(0.88); }
.flip {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
