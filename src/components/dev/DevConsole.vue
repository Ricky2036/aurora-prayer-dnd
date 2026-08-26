<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useControlStore } from '../../stores/controlStore'
import { useSystemStore } from '../../stores/systemStore'
import { usePrayerStore } from '../../stores/prayerStore'
import { useI18nStore } from '../../stores/i18nStore'

const props = defineProps({
  mode: {
    type: String,
    default: 'desktop' // 'desktop' | 'mobile'
  },
  isRecording: {
    type: Boolean,
    default: false
  },
  recordWithFrame: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['toggle-recording', 'update:recordWithFrame'])

const control = useControlStore()
const system = useSystemStore()
const prayerStore = usePrayerStore()
const i18n = useI18nStore()

/* ================= 移动端悬浮球与抽屉状态 ================= */
const isDrawerOpen = ref(false)
const fabPos = ref({ x: 0, y: 0 })
const isSnapping = ref(false)

let isPointerDown = false
let startPointer = { x: 0, y: 0 }
let startFab = { x: 0, y: 0 }
let startTime = 0
let hasMoved = false
let lastToggleTime = 0

function toggleDrawer() {
  const now = Date.now()
  if (now - lastToggleTime < 300) return
  lastToggleTime = now
  isDrawerOpen.value = !isDrawerOpen.value
}

function initFabPosition() {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  const h = window.innerHeight
  // 默认停靠在右下角（避开底部操作条与右上控制中心热区）
  fabPos.value = {
    x: Math.max(12, w - 64),
    y: Math.max(80, h - 190)
  }
}

onMounted(() => {
  initFabPosition()
  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
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

  // 移动距离大于 12px 判定为拖拽（容忍移动端手指触控轻微抖动）
  if (!hasMoved && dist > 12) {
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
  
  if (!hasMoved || dist < 12 || elapsed < 320) {
    toggleDrawer()
  } else {
    // 拖拽释放：吸附至左侧或右侧边缘
    snapToEdge()
  }
}

function onFabClick(e) {
  if (!hasMoved) {
    toggleDrawer()
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

function closeDrawer() {
  isDrawerOpen.value = false
}
</script>

<template>
  <!-- ================= 1. 桌面侧边栏模式 ================= -->
  <div v-if="mode === 'desktop'" class="proto-console">
    <div class="pc-glow"></div>
    <h2 class="pc-title">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>
      原型配置控制台
    </h2>

    <!-- 控制项内容插槽/模板 -->
    <div class="pc-content-body">
      <!-- 语言切换 -->
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

      <!-- 智慧建议 -->
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

      <!-- 礼拜勿扰灵动岛模拟控制 -->
      <div class="pc-block">
        <p class="pc-label">
          <span>礼拜勿扰灵动岛</span>
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
            <input type="checkbox" :checked="recordWithFrame" @change="emit('update:recordWithFrame', $event.target.checked)" />
            <div class="pc-switch"></div>
          </label>
        </div>
        <div class="pc-actions">
          <button class="pc-btn" :class="isRecording ? 'pc-btn-danger' : 'pc-btn-primary'" @click="emit('toggle-recording')">
            {{ isRecording ? '⏹ 停止录制' : '⏺ 开始录制' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ================= 2. 移动端悬浮球与抽屉模式 ================= -->
  <div v-else class="mobile-dev-console">
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </div>
      <div class="fab-tag">控制台</div>
    </div>

    <!-- 底部控制台抽屉 (Bottom Sheet) -->
    <Transition name="drawer-fade">
      <div v-if="isDrawerOpen" class="drawer-backdrop" @click="closeDrawer"></div>
    </Transition>

    <Transition name="drawer-slide">
      <div v-if="isDrawerOpen" class="drawer-sheet">
        <div class="drawer-handle-bar">
          <div class="dh-indicator"></div>
        </div>

        <div class="drawer-header">
          <div class="dh-title-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg>
            <span class="dh-title">原型配置控制台</span>
          </div>
          <button class="dh-close-btn" @click="closeDrawer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="drawer-body scrollable">
          <!-- 语言切换 -->
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

          <!-- 智慧建议 -->
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

          <!-- 礼拜勿扰灵动岛模拟控制 -->
          <div class="pc-block">
            <p class="pc-label">
              <span>礼拜勿扰灵动岛</span>
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
          <div class="pc-block" style="margin-bottom: 30px;">
            <p class="pc-label">录制屏幕</p>
            <div class="pc-actions">
              <button class="pc-btn" :class="isRecording ? 'pc-btn-danger' : 'pc-btn-primary'" @click="emit('toggle-recording')">
                {{ isRecording ? '⏹ 停止录制' : '⏺ 开始录制' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ================= 桌面控制台样式 ================= */
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

.pc-block {
  position: relative;
  z-index: 1;
  margin-bottom: 20px;
}

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

/* ================= 移动端悬浮球与抽屉样式 ================= */
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
  background: rgba(24, 24, 28, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
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
  box-shadow: 0 0 16px rgba(96, 165, 250, 0.4);
}

.fab-inner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.fab-tag {
  font-size: 8.5px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.2px;
  transform: scale(0.9);
}

/* 抽屉遮罩 */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: auto;
  z-index: 100000;
}

/* 抽屉主体 */
.drawer-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 82dvh;
  background: #1c1c1e;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  color: #fff;
  pointer-events: auto;
  overflow: hidden;
  z-index: 100001;
}

.drawer-handle-bar {
  display: flex;
  justify-content: center;
  padding: 10px 0 6px;
}

.dh-indicator {
  width: 38px;
  height: 4.5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.25);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px 14px;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
}

.dh-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dh-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.dh-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s ease;
}

.dh-close-btn:active {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.drawer-body {
  flex: 1;
  padding: 18px 20px calc(24px + env(safe-area-inset-bottom));
  overflow-y: auto;
}

/* 过渡动画 */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.25s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateY(100%);
}
</style>
