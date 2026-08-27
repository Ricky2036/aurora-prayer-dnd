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
  isTranscoding: {
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

/* ================= Tab 切换状态 ================= */
const activeTab = ref('system') // 'system' | 'prayer' | 'control'
const tabs = [
  { id: 'system', name: '系统控制' },
  { id: 'prayer', name: '礼拜模式' },
  { id: 'control', name: '控制中心' }
]

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
    snapToEdge()
  }
}

function onFabClick() {
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

          <!-- 屏幕状态控制 -->
          <div class="pc-card">
            <div class="pc-card-header">
              <span class="pc-card-title">屏幕电源</span>
            </div>
            <button
              class="pc-btn pc-btn-toggle"
              :class="system.screenOn ? 'pc-btn-danger' : 'pc-btn-primary'"
              @click="system.screenOn ? system.powerOff() : system.powerOn()"
            >
              {{ system.screenOn ? '熄灭屏幕' : '点亮屏幕' }}
            </button>
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
              {{ isTranscoding ? '⏳ 正在自动转码导出...' : isRecording ? '⏹ 停止录制并自动转码' : '⏺ 开始录制' }}
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
                {{ prayerStore.currentIslandPrayer.cnName }}中
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
                {{ p.cnName }}
              </button>
            </div>
          </div>
        </section>

        <!-- 3. 控制中心 Tab -->
        <section v-else-if="activeTab === 'control'" key="control" class="pc-tab-panel">
          <!-- 排列算法 -->
          <div class="pc-card">
            <div class="pc-card-header">
              <span class="pc-card-title">控制中心编辑算法</span>
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

          <!-- 提示卡片 -->
          <div class="pc-hint-card">
            <div class="pc-hint-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
            <p class="pc-hint-text">
              在手机屏幕右上角边缘向下滑动，即可随时呼出控制中心；长按组件进入编辑网格。
            </p>
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
      <div v-if="isDrawerOpen" class="modal-backdrop" @click="closeDrawer">
        <Transition name="modal-pop">
          <div v-if="isDrawerOpen" class="proto-console modal-console" @click.stop>
            <!-- 背景流光 -->
            <div class="pc-glow"></div>

            <!-- 顶部标题 (居中加粗 + 关闭按钮) -->
            <header class="pc-header">
              <h2 class="pc-title">控制台</h2>
              <button class="pc-close-btn" @click="closeDrawer" aria-label="关闭">
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

                  <!-- 屏幕状态控制 -->
                  <div class="pc-card">
                    <div class="pc-card-header">
                      <span class="pc-card-title">屏幕电源</span>
                    </div>
                    <button
                      class="pc-btn pc-btn-toggle"
                      :class="system.screenOn ? 'pc-btn-danger' : 'pc-btn-primary'"
                      @click="system.screenOn ? system.powerOff() : system.powerOn()"
                    >
                      {{ system.screenOn ? '熄灭屏幕' : '点亮屏幕' }}
                    </button>
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
                      {{ isTranscoding ? '⏳ 正在自动转码导出...' : isRecording ? '⏹ 停止录制并自动转码' : '⏺ 开始录制' }}
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
                        {{ prayerStore.currentIslandPrayer.cnName }}中
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
                        {{ p.cnName }}
                      </button>
                    </div>
                  </div>
                </section>

                <!-- 3. 控制中心 Tab -->
                <section v-else-if="activeTab === 'control'" key="mob-control" class="pc-tab-panel">
                  <!-- 排列算法 -->
                  <div class="pc-card">
                    <div class="pc-card-header">
                      <span class="pc-card-title">控制中心编辑算法</span>
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

                  <!-- 提示卡片 -->
                  <div class="pc-hint-card">
                    <div class="pc-hint-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                    </div>
                    <p class="pc-hint-text">
                      在手机屏幕右上角边缘向下滑动，即可随时呼出控制中心；长按组件进入编辑网格。
                    </p>
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
