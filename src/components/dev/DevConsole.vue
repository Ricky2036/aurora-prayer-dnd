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
  { id: 'prayer', name: '礼拜勿扰' },
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

    <!-- 顶部标题 -->
    <header class="pc-header">
      <div class="pc-title-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <div class="pc-title-text">
        <h2 class="pc-title">原型配置控制台</h2>
        <span class="pc-subtitle">Aurora Prototype Studio</span>
      </div>
    </header>

    <!-- 顶部多 Tab 切换条 -->
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
              <span class="pc-state-tag" :class="{ 'is-on': system.screenOn }">
                <span class="pc-dot"></span>
                {{ system.screenOn ? '屏幕已亮起' : '屏幕已熄灭' }}
              </span>
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

        <!-- 2. 礼拜与勿扰 Tab -->
        <section v-else-if="activeTab === 'prayer'" key="prayer" class="pc-tab-panel">
          <!-- 智慧建议模式 -->
          <div class="pc-card">
            <div class="pc-card-header">
              <span class="pc-card-title">智慧建议堆叠</span>
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

          <!-- 礼拜勿扰灵动岛模拟 -->
          <div class="pc-card">
            <div class="pc-card-header">
              <span class="pc-card-title">礼拜勿扰灵动岛</span>
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

  <!-- ================= 2. 移动端悬浮球与抽屉模式 ================= -->
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            <span class="dh-title">原型配置控制台</span>
          </div>
          <button class="dh-close-btn" @click="closeDrawer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- 移动端抽屉 Tab 条 -->
        <nav class="pc-tab-bar mobile-tab-bar">
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

        <div class="drawer-body scrollable">
          <Transition name="tab-fade" mode="out-in">
            <!-- 1. 系统控制 Tab -->
            <div v-if="activeTab === 'system'" key="mob-system" class="pc-tab-panel">
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
                  <span class="pc-state-tag" :class="{ 'is-on': system.screenOn }">
                    <span class="pc-dot"></span>
                    {{ system.screenOn ? '屏幕已亮起' : '屏幕已熄灭' }}
                  </span>
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
            </div>

            <!-- 2. 礼拜与勿扰 Tab -->
            <div v-else-if="activeTab === 'prayer'" key="mob-prayer" class="pc-tab-panel">
              <!-- 智慧建议模式 -->
              <div class="pc-card">
                <div class="pc-card-header">
                  <span class="pc-card-title">智慧建议堆叠</span>
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

              <!-- 礼拜勿扰灵动岛模拟 -->
              <div class="pc-card">
                <div class="pc-card-header">
                  <span class="pc-card-title">礼拜勿扰灵动岛</span>
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
            </div>

            <!-- 3. 控制中心 Tab -->
            <div v-else-if="activeTab === 'control'" key="mob-control" class="pc-tab-panel">
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
            </div>
          </Transition>
        </div>
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
  background: rgba(26, 26, 30, 0.82);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-radius: 24px;
  padding: 20px 18px 22px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  overflow: hidden;
  align-self: center;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pc-glow {
  position: absolute;
  top: -80px;
  right: -80px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%);
  filter: blur(40px);
  pointer-events: none;
}

/* 顶部标题栏 */
.pc-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.pc-title-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(37, 99, 235, 0.1));
  border: 1px solid rgba(96, 165, 250, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #60a5fa;
}

.pc-title-text {
  display: flex;
  flex-direction: column;
}

.pc-title {
  font: 700 15px/1.2 var(--font-stack);
  letter-spacing: -0.2px;
  color: #fff;
  margin: 0;
}

.pc-subtitle {
  font: 400 10.5px/1.2 var(--font-stack);
  color: rgba(255, 255, 255, 0.45);
  margin-top: 2px;
  letter-spacing: 0.3px;
}

/* ================= 顶部 Tab 导航条 ================= */
.pc-tab-bar {
  position: relative;
  display: flex;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 3px;
  margin-bottom: 16px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
}

.pc-tab-indicator {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(33.333% - 2px);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.08) 100%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 11px;
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.pc-tab-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 7px 0;
  font: 600 12px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
  border-radius: 11px;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: color 0.2s ease;
}

.pc-tab-btn.active {
  color: #fff;
}

/* ================= 卡片与控件 ================= */
.pc-content-body {
  position: relative;
  min-height: 240px;
}

.pc-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pc-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 12px 14px 14px;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.pc-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.pc-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.pc-card-title {
  font: 600 12.5px/1.2 var(--font-stack);
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.1px;
}

.pc-state-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: 500 11px/1 var(--font-stack);
  color: rgba(255, 255, 255, 0.4);
}

.pc-state-tag.is-on {
  color: #34c759;
}

.pc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
}

.pc-state-tag.is-on .pc-dot {
  background: #34c759;
  box-shadow: 0 0 8px #34c759;
}

/* 分段选择器 */
.pc-seg {
  position: relative;
  display: flex;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 3px;
}

.pc-seg-thumb {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  background: #3a3a3c;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9px;
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.pc-seg-thumb-3 {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(33.333% - 2px);
  background: #3a3a3c;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9px;
  transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.pc-seg-btn {
  position: relative;
  z-index: 1;
  flex: 1;
  padding: 7px 0;
  font: 500 12px/1 var(--font-stack);
  border-radius: 9px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  background: transparent;
  border: none;
  transition: color 0.2s ease;
}

.pc-seg-btn.on {
  color: #fff;
  font-weight: 600;
}

/* 操作按钮 */
.pc-btn {
  width: 100%;
  padding: 10px 0;
  border-radius: 12px;
  font: 600 12.5px/1 var(--font-stack);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pc-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
}

.pc-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.pc-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pc-btn-primary {
  background: rgba(37, 99, 235, 0.22);
  border-color: rgba(59, 130, 246, 0.35);
  color: #93c5fd;
}

.pc-btn-primary:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.38);
  color: #fff;
}

.pc-btn-danger {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(239, 68, 68, 0.32);
  color: #fca5a5;
}

.pc-btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.28);
  color: #fff;
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
  font: 600 11.5px/1 var(--font-stack);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pc-prayer-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.pc-prayer-btn.on {
  background: #34c759;
  border-color: #34c759;
  color: #fff;
  box-shadow: 0 3px 10px rgba(52, 199, 89, 0.35);
}

/* 开关控件 */
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
  width: 26px;
  height: 15px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  transition: background 0.2s;
}

.pc-switch::after {
  content: '';
  position: absolute;
  top: 1.5px;
  left: 1.5px;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.pc-switch-wrap input:checked + .pc-switch {
  background: #2563eb;
}

.pc-switch-wrap input:checked + .pc-switch::after {
  transform: translateX(11px);
}

/* 提示卡片 */
.pc-hint-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 14px;
}

.pc-hint-icon {
  color: #60a5fa;
  margin-top: 1px;
  flex-shrink: 0;
}

.pc-hint-text {
  font: 400 11.5px/1.45 var(--font-stack);
  color: rgba(255, 255, 255, 0.65);
  margin: 0;
}

/* ================= 移动端悬浮球与抽屉 ================= */
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
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: rgba(24, 24, 28, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
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
  font-size: 8px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.2px;
}

/* 抽屉遮罩 */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  pointer-events: auto;
  z-index: 100000;
}

/* 抽屉主体 */
.drawer-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 80dvh;
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
  padding: 10px 0 4px;
}

.dh-indicator {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.25);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 18px 12px;
}

.dh-title {
  font: 700 15px/1.2 var(--font-stack);
  letter-spacing: -0.1px;
}

.dh-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.mobile-tab-bar {
  margin: 0 16px 14px;
}

.drawer-body {
  flex: 1;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
  overflow-y: auto;
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
