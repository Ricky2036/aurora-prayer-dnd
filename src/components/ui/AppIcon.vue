<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { GLYPHS } from '../../assets/icons/glyphs'
import { useClock } from '../../composables/useClock'
import { useHomeStore } from '../../stores/homeStore'
import { useNotificationsStore } from '../../stores/notificationsStore'
import { useSystemStore } from '../../stores/systemStore'
import { useI18nStore } from '../../stores/i18nStore'
import { rectRelativeToScreen } from '../../utils/dom'
import { getAnchorRect, registerAnchor, setLaunchRect, unregisterAnchor } from '../../utils/appIconAnchors'

/**
 * 通用应用图标：渐变底 + glyph，或自绘特殊图标（日历/照片/时钟）。
 * 点击时上报自身 rect（hero 动画起点）并触发打开。
 */
const props = defineProps({
  app: { type: Object, required: true },
  showLabel: { type: Boolean, default: true },
  enterDelay: { type: Number, default: 0 },  // 解锁入场 stagger (ms)
  size: { type: Number, default: 60 },  // tile 边长（默认桌面 60；通知设置内 40）
  ignoreHidden: { type: Boolean, default: false }, // 是否忽略全局隐藏状态（用于过渡动画中的镜像）
  homeAnchor: { type: Boolean, default: false }
})

const home = useHomeStore()
const notifications = useNotificationsStore()
const system = useSystemStore()
const i18n = useI18nStore()

const anchorRef = ref(null)
const { today, hourDeg, minuteDeg, secondDeg } = useClock()

const appDisplayName = computed(() => i18n.appName(props.app.id) || props.app.name)
const weekday = computed(() => i18n.calWeekDays[new Date().getDay()] || '周日')

const badge = computed(() => notifications.countByApp[props.app.id] || 0)

/** hero 动画期间隐藏图标本体防重影 */
const hidden = computed(() => !props.ignoreHidden && home.hiddenIconId === props.app.id)

const entering = computed(() => system.unlockProgress === 0 && system.baseLayer === 'lock')

const resolvedImage = computed(() => {
  if (!props.app.image) return null
  if (props.app.image.startsWith('http') || props.app.image.startsWith('data:')) return props.app.image
  const clean = props.app.image.replace(/^\/+/, '')
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/'
  return `${base}${clean}`
})

function open() {
  if (!anchorRef.value) return
  const screenEl = document.querySelector('.screen-view')
  if (!screenEl) return
  // 无论入口位于桌面、Dock 或资源库，Hero 都优先使用注册的桌面稳定锚点。
  const launchRect = getAnchorRect(props.app.id, screenEl)
    || rectRelativeToScreen(anchorRef.value, screenEl)
  setLaunchRect(props.app.id, launchRect)
  system.openApp(props.app.id)
}

onMounted(() => {
  if (props.homeAnchor) registerAnchor(props.app.id, anchorRef.value)
})

onBeforeUnmount(() => {
  if (props.homeAnchor) unregisterAnchor(props.app.id, anchorRef.value)
})
</script>

<template>
  <button
    class="app-icon"
    :class="{ 'is-hidden': hidden }"
    :data-app-id="app.id"
    :style="{ '--enter-delay': enterDelay + 'ms', width: size + 'px', '--scale': size / 60 }"
    @click="open"
  >
    <span ref="anchorRef" class="app-icon-anchor" :style="{ width: size + 'px', height: size + 'px' }">
      <span class="icon-tile squircle-mask" :class="app.special ? 'tile-' + app.special : ''" :style="{ ...(app.special ? {} : { background: app.gradient || '#fff' }), width: size + 'px', height: size + 'px' }">
        <!-- 图片图标：略微放大以切除原图可能自带的不完美圆角和毛刺 -->
        <img v-if="app.image" :src="resolvedImage" alt="" :style="{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.02)' }" />

        <!-- 标准：glyph -->
        <svg v-else-if="app.glyph" width="32" height="32" viewBox="0 0 24 24" :style="{ transform: `scale(${size / 60})` }">
          <path :d="GLYPHS[app.glyph]" :fill="app.glyphColor" />
        </svg>

        <!-- 日历：星期 + 日期 -->
        <template v-else-if="app.special === 'calendar'">
          <span class="cal-weekday">{{ weekday }}</span>
          <span class="cal-date">{{ today.date }}</span>
        </template>

        <!-- 照片：彩色风车 -->
        <svg v-else-if="app.special === 'photos'" width="40" height="40" viewBox="0 0 40 40" :style="{ transform: `scale(${size / 60})` }">
          <g transform="translate(20,20)">
            <ellipse v-for="(c, i) in ['#FF3B30','#FF9500','#FFCC00','#34C759','#5AC8FA','#007AFF','#AF52DE','#FF2D55']"
              :key="c" rx="4.6" ry="13" :fill="c" opacity="0.75"
              :transform="`rotate(${i * 45}) translate(0,-7.5)`" />
          </g>
        </svg>

        <!-- 时钟：实时指针 -->
        <svg v-else-if="app.special === 'clock'" width="46" height="46" viewBox="0 0 46 46" :style="{ transform: `scale(${size / 60})` }">
          <circle cx="23" cy="23" r="21" fill="#1c1c1e"/>
          <circle cx="23" cy="23" r="19.5" fill="#fff"/>
          <g stroke="#3a3a3c" stroke-width="1.4">
            <line v-for="i in 12" :key="i" x1="23" y1="5" x2="23" y2="8"
              :transform="`rotate(${(i - 1) * 30} 23 23)`" />
          </g>
          <line x1="23" y1="23" x2="23" y2="13" stroke="#1c1c1e" stroke-width="3" stroke-linecap="round"
            :transform="`rotate(${hourDeg} 23 23)`" />
          <line x1="23" y1="23" x2="23" y2="8" stroke="#1c1c1e" stroke-width="2" stroke-linecap="round"
            :transform="`rotate(${minuteDeg} 23 23)`" />
          <line x1="23" y1="25" x2="23" y2="7" stroke="#FF9500" stroke-width="1" stroke-linecap="round"
            :transform="`rotate(${secondDeg} 23 23)`" />
          <circle cx="23" cy="23" r="1.6" fill="#1c1c1e"/>
        </svg>
      </span>
    </span>

    <span v-if="showLabel" class="icon-label">{{ appDisplayName }}</span>
    <span v-if="badge" class="icon-badge">{{ badge }}</span>
  </button>
</template>

<style scoped>
.app-icon {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 64px;
}
.app-icon-anchor {
  position: relative;
  display: block;
  flex: none;
}
/* 解锁完成后由 HomeScreen 加 .just-unlocked 触发入场动画 */
.just-unlocked .app-icon {
  animation: icon-enter 0.5s cubic-bezier(0.25, 0.9, 0.3, 1.2) backwards;
  animation-delay: var(--enter-delay, 0ms);
}
@keyframes icon-enter {
  from { opacity: 0; transform: scale(1.35); }
  to { opacity: 1; transform: scale(1); }
}
.app-icon.is-hidden .icon-tile { visibility: hidden; }
.app-icon.is-hidden .icon-badge { visibility: hidden; }

.icon-tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.16s cubic-bezier(0.3, 0.8, 0.4, 1), filter 0.16s ease;
}
.squircle-mask {
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 50 0 L 72 0 C 86 0 100 14 100 28 L 100 72 C 100 86 86 100 72 100 L 28 100 C 14 100 0 86 0 72 L 0 28 C 0 14 14 0 28 0 Z' fill='black'/%3E%3C/svg%3E");
  -webkit-mask-size: 100% 100%;
  mask-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M 50 0 L 72 0 C 86 0 100 14 100 28 L 100 72 C 100 86 86 100 72 100 L 28 100 C 14 100 0 86 0 72 L 0 28 C 0 14 14 0 28 0 Z' fill='black'/%3E%3C/svg%3E");
  mask-size: 100% 100%;
}
.app-icon:active .icon-tile {
  transform: scale(0.88);
  filter: brightness(0.85);
}

.icon-label {
  font: var(--text-caption);
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  max-width: 68px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.icon-badge {
  position: absolute;
  top: -4px;
  left: 44px;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 9.5px;
  background: var(--ios-red);
  color: #fff;
  font: 600 12px/19px var(--font-stack);
  text-align: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

/* 日历图标 */
.tile-calendar { background: linear-gradient(180deg, #ffffff 0%, #f6f6f8 100%); flex-direction: column; gap: 0; }
.cal-weekday {
  font: 600 calc(10px * var(--scale, 1))/1 var(--font-stack);
  color: var(--ios-red);
  letter-spacing: 0.5px;
  margin-top: calc(7px * var(--scale, 1));
}
.cal-date {
  font: 300 calc(30px * var(--scale, 1))/1.1 var(--font-stack);
  color: #1c1c1e;
  font-variant-numeric: tabular-nums;
}

/* 照片图标：iOS 风格白底彩色风车 */
.tile-photos { background: linear-gradient(180deg, #ffffff 0%, #f2f2f7 100%); }

/* 时钟图标：黑底白表盘（SVG 自带圆，背景铺满圆角） */
.tile-clock { background: #1c1c1e; }
</style>
