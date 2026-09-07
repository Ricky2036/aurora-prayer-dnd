<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { getApp } from '../../config/apps'
import { GLYPHS } from '../../assets/icons/glyphs'
import { clamp } from '../../utils/math'
import { useI18nStore } from '../../stores/i18nStore'

/**
 * 通知卡片：锁屏摘要 / 通知中心共用。
 * dismissible 时支持左滑露出红色「清除」并触发 dismiss。
 */
const props = defineProps({
  notification: { type: Object, required: true },
  dismissible: { type: Boolean, default: false }
})
const emit = defineEmits(['dismiss'])
const i18n = useI18nStore()

const app = computed(() => getApp(props.notification.appId))

/** 相对时间 */
const timeLabel = computed(() => {
  const diff = Date.now() - props.notification.time
  const m = Math.floor(diff / 60000)
  if (m < 1) return i18n.t('justNow')
  if (m < 60) return i18n.t('minutesAgo')(m)
  const h = Math.floor(m / 60)
  if (h < 24) return i18n.t('hoursAgo')(h)
  const d = new Date(props.notification.time)
  return i18n.t('monthDay')(i18n.monthNames[d.getMonth()] || d.getMonth() + 1, d.getDate())
})

/* ---- 左滑删除（卡片级轻量拖拽，独立实现不复用系统手势） ---- */
const offsetX = ref(0)
const removing = ref(false)
let startX = 0
let dragging = false
const DELETE_THRESHOLD = -72
const FULL_DELETE = -160

function onPointerDown(e) {
  if (!props.dismissible || removing.value) return
  dragging = true
  startX = e.clientX
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onPointerMove(e) {
  if (!dragging) return
  const d = e.clientX - startX
  offsetX.value = clamp(d, FULL_DELETE, 0)
}
/* 滑出动画 180ms 后真正派发 dismiss。卡片若在这期间被「清空全部」移除，
   定时器仍会向已卸载组件派发一次，故统一登记句柄并在卸载时清理 */
let dismissTimer = null
function scheduleDismiss() {
  clearTimeout(dismissTimer)
  dismissTimer = setTimeout(() => {
    dismissTimer = null
    emit('dismiss', props.notification.id)
  }, 180)
}

function onPointerUp() {
  if (!dragging) return
  dragging = false
  if (offsetX.value <= FULL_DELETE * 0.85) {
    removing.value = true
    offsetX.value = -420
    scheduleDismiss()
  } else if (offsetX.value <= DELETE_THRESHOLD) {
    offsetX.value = DELETE_THRESHOLD // 停在露出删除键的位置
  } else {
    offsetX.value = 0
  }
}
function quickDelete() {
  removing.value = true
  offsetX.value = -420
  scheduleDismiss()
}

onBeforeUnmount(() => {
  clearTimeout(dismissTimer)
  dismissTimer = null
})

const cardStyle = computed(() => ({
  transform: `translateX(${offsetX.value}px)`,
  transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.25, 0.9, 0.3, 1)'
}))
const deleteOpacity = computed(() => clamp(-offsetX.value / 60, 0, 1))
</script>

<template>
  <div class="nc-wrap">
    <div v-if="dismissible" class="nc-delete" :style="{ opacity: deleteOpacity }" @click="quickDelete">
      <svg width="18" height="18" viewBox="0 0 24 24"><path :d="GLYPHS.trash" fill="#fff" /></svg>
      <span>{{ i18n.t('clear') }}</span>
    </div>

    <div
      class="notification-card"
      :style="cardStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="nc-icon" :style="{ background: app?.gradient || '#8e8e93' }">
        <svg v-if="app?.glyph" width="15" height="15" viewBox="0 0 24 24">
          <path :d="GLYPHS[app.glyph]" :fill="app.glyphColor || '#fff'" />
        </svg>
        <span v-else class="nc-icon-text">{{ app?.name?.slice(0, 1) }}</span>
      </div>
      <div class="nc-body">
        <div class="nc-head">
          <span class="nc-title">{{ i18n.notifTitle(notification.appId) }}</span>
          <span class="nc-time">{{ timeLabel }}</span>
        </div>
        <p class="nc-text">{{ i18n.notifBody(notification.appId) }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nc-wrap {
  position: relative;
  border-radius: var(--radius-card);
}
.nc-delete {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  padding-right: 18px;
  background: var(--ios-red);
  border-radius: var(--radius-card);
  color: #fff;
  font: 500 14px/1 var(--font-stack);
  cursor: pointer;
}
.notification-card {
  position: relative;
  display: flex;
  align-items: center; /* 图标相对卡片上下居中 */
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-card);
  /* 液态玻璃：高饱和厚模糊 + 内高光描边 + 悬浮投影 */
  background: rgba(255, 255, 255, 0.46);
  backdrop-filter: blur(30px) saturate(210%) brightness(1.08);
  -webkit-backdrop-filter: blur(30px) saturate(210%) brightness(1.08);
  box-shadow:
    inset 0 0.5px 0 rgba(255, 255, 255, 0.85),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.28),
    0 8px 24px rgba(0, 0, 0, 0.16);
  touch-action: pan-y;
  cursor: default;
}
.nc-icon {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 7.5px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nc-icon-text {
  color: #fff;
  font: 600 14px/1 var(--font-stack);
}
.nc-body { flex: 1; min-width: 0; }
.nc-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.nc-title {
  font: var(--text-subhead);
  font-weight: 600;
  color: var(--label);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nc-time {
  flex: none;
  font: var(--text-footnote);
  color: var(--label-secondary);
}
.nc-text {
  margin-top: 2px;
  font: var(--text-subhead);
  color: var(--label);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
