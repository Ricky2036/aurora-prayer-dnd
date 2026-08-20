<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { usePrayerStore } from '../../stores/prayerStore'
import { useI18nStore } from '../../stores/i18nStore'
import { GLYPHS } from '../../assets/icons/glyphs'

const prayerStore = usePrayerStore()
const i18n = useI18nStore()

/* 计时器轮询（自动倒数，到期自动退出） */
let timer = null
onMounted(() => {
  timer = setInterval(() => {
    if (prayerStore.currentIslandPrayer) {
      prayerStore.decrementCountdown()
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

/* 格式化倒计时文本 MM:SS */
const formattedCountdown = computed(() => {
  const s = prayerStore.islandCountdownSeconds
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

/* 当前多语言辅助文案 */
const activeSubtitle = computed(() => {
  const prayerId = prayerStore.currentIslandPrayer?.id || 'fajr'
  return i18n.islandSub(prayerId)
})

function handleCardClick() {
  if (!prayerStore.islandExpanded) {
    prayerStore.islandExpanded = true
  }
}

function handleClose(e) {
  e.stopPropagation()
  prayerStore.closeIsland()
}
</script>

<template>
  <!-- 全局点击空白处收回至胶囊状态遮罩 -->
  <div
    v-if="prayerStore.currentIslandPrayer && prayerStore.islandExpanded"
    class="island-backdrop"
    @click="prayerStore.islandExpanded = false"
  ></div>

  <!-- 灵动岛无缝形态过渡容器（同一DOM连续缩放与变形） -->
  <div
    v-if="prayerStore.currentIslandPrayer"
    class="dynamic-island-wrapper"
  >
    <div
      class="island-card"
      :class="{ 'is-expanded': prayerStore.islandExpanded, 'is-compact': !prayerStore.islandExpanded }"
      @click="handleCardClick"
    >
      <!-- ================= 1. 收起态内容（连续交叉淡入淡出） ================= -->
      <div class="morph-layer compact-layer">
        <div class="cc-left">
          <svg width="13" height="13" viewBox="0 0 24 24">
            <path :d="GLYPHS.moon" fill="#00C853" />
          </svg>
        </div>
        <div class="cc-camera-slot"></div>
        <div class="cc-right">
          <span class="cc-time">{{ formattedCountdown }}</span>
        </div>
      </div>

      <!-- ================= 2. 展开态内容：圆角矩形卡片 ================= -->
      <div class="morph-layer expanded-layer" @click.stop>
        <!-- 左侧：勿扰月亮图标 -->
        <div class="ic-left-icon">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path :d="GLYPHS.moon" fill="#00C853" />
          </svg>
        </div>

        <!-- 中间：倒计时与辅助文案 -->
        <div class="ic-center-info">
          <div class="ic-time">{{ formattedCountdown }}</div>
          <div class="ic-sub">{{ activeSubtitle }}</div>
        </div>

        <!-- 右侧：关闭按钮 (点击关闭勿扰) -->
        <button class="ic-close-btn" @click.stop="handleClose">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全局透明背景遮罩：点击空白处收回胶囊 */
.island-backdrop {
  position: absolute;
  inset: 0;
  z-index: 96;
  background: transparent;
}

.dynamic-island-wrapper {
  position: absolute;
  top: 7px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 97;
  user-select: none;
}

/* ================= 灵动岛无缝连续形变核心 (Liquid Morphing) ================= */
.island-card {
  position: relative;
  background: #000000;
  color: #ffffff;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.48), 0 0 0 0.5px rgba(255, 255, 255, 0.12);
  cursor: pointer;
  overflow: hidden;
  will-change: width, height, border-radius, padding, box-shadow;
  /* 苹果级流体弹簧形变过渡曲线 */
  transition:
    width 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    height 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    padding 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 0.38s ease;
}

/* 收起态尺寸 */
.island-card.is-compact {
  width: 124px;
  height: 30px;
  border-radius: 15px;
  padding: 0 10px;
}

/* 展开态尺寸：圆角矩形 */
.island-card.is-expanded {
  width: 358px;
  height: 80px;
  border-radius: 22px;
  padding: 0 16px 0 18px;
  cursor: default;
}

/* 图层绝对定位叠放并无缝渐变 */
.morph-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  will-change: opacity, transform;
}

/* ================= 收起态图层 ================= */
.compact-layer {
  padding: 0 10px;
  justify-content: space-between;
  transition: opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1), transform 0.38s cubic-bezier(0.32, 0.72, 0, 1);
}
.is-compact .compact-layer {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}
.is-expanded .compact-layer {
  opacity: 0;
  transform: scale(0.8);
  pointer-events: none;
}

.cc-left {
  display: flex;
  align-items: center;
  justify-content: center;
}
.cc-camera-slot {
  width: 18px;
  height: 15px;
  flex: none;
}
.cc-right {
  display: flex;
  align-items: center;
}
.cc-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 12.5px;
  font-weight: 600;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.2px;
}

/* ================= 展开态图层 ================= */
.expanded-layer {
  padding: 0 16px 0 18px;
  justify-content: space-between;
  transition: opacity 0.26s cubic-bezier(0.32, 0.72, 0, 1) 0.08s, transform 0.38s cubic-bezier(0.32, 0.72, 0, 1);
}
.is-expanded .expanded-layer {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}
.is-compact .expanded-layer {
  opacity: 0;
  transform: scale(0.85);
  pointer-events: none;
}

/* 左侧图标容器 */
.ic-left-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(0, 200, 83, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

/* 中间文案 */
.ic-center-info {
  flex: 1;
  min-width: 0;
  margin-left: 14px;
  margin-right: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.ic-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 23px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.3px;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.ic-sub {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 右侧关闭按钮 */
.ic-close-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #333336;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
  transition: background 0.15s ease, transform 0.1s ease;
}

.ic-close-btn:hover {
  background: #444448;
}

.ic-close-btn:active {
  transform: scale(0.92);
}
</style>
