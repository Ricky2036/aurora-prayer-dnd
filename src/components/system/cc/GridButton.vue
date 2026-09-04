<script setup>
import { computed } from 'vue'
import { useControlStore } from '../../../stores/controlStore'
import LIcon from '../../ui/LIcon.vue'

/**
 * 控制中心网格开关按钮（移植自 android_control_center.tsx GridButton）。
 * 1x1 圆形 / 2x1 胶囊（展开 label）；响铃展开为三段切换；
 * 编辑模式显示删除徽标与右下角伸缩手柄。
 */
const props = defineProps({
  item: { type: Object, required: true }, // TOGGLES 配置项
  editing: { type: Boolean, default: false },
  resizing: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false }, // 2x1 展开态
  computedWidth: { type: Number, required: true }
})
const emit = defineEmits(['activate', 'resize-start', 'remove'])

const control = useControlStore()

const isSound = computed(() => props.item.id === 'sound')
const isLocation = computed(() => props.item.id === 'location')

/** 激活状态绑定 controlStore */
const isActive = computed(() => {
  const id = props.item.id
  if (id === 'sound') return control.soundMode === 'ring'
  return !!control[id]
})

const iconName = computed(() => {
  if (isSound.value) {
    if (control.soundMode === 'mute') return 'bellOff'
    if (control.soundMode === 'vibrate') return 'vibrate'
    return 'bell'
  }
  if (props.item.id === 'flashlight' && isActive.value) {
    return 'flashlightOn'
  }
  return props.item.icon
})

/** 展开态响铃容器不激活底色（内部三段有自己的激活态） */
const containerActive = computed(() => (isSound.value && props.expanded) ? false : isActive.value)

const stateStyle = computed(() => {
  if (containerActive.value && !props.expanded) {
    return { background: props.item.activeBg || '#258FFF', color: props.item.activeColor || '#fff' }
  }
  return { background: 'rgba(255, 255, 255, 0.16)', color: '#fff' }
})

const badgeStyle = computed(() => {
  if (!props.expanded) return {}
  if (isActive.value) {
    return {
      background: props.item.activeBg || '#258FFF',
      color: props.item.activeColor || '#fff'
    }
  }
  return {
    background: 'rgba(255, 255, 255, 0.2)',
    color: '#fff'
  }
})

const blurStyle = computed(() => ({
  backdropFilter: (containerActive.value && !props.expanded && !props.editing) ? 'none' : 'blur(25px) saturate(180%)',
  WebkitBackdropFilter: (containerActive.value && !props.expanded && !props.editing) ? 'none' : 'blur(25px) saturate(180%)'
}))

/** 三段滑块位置 (138px - 12px padding = 126px / 3 = 42px) */
const soundKnobX = computed(() => {
  const seg = (props.computedWidth - 12) / 3
  const i = { ring: 0, vibrate: 1, mute: 2 }[control.soundMode]
  return seg * i
})

function onClick() {
  if (props.editing) return
  if (isSound.value && !props.expanded) {
    control.cycleSoundMode()
    return
  }
  emit('activate', props.item.id)
}

function onResizeDown(e) {
  e.preventDefault()
  e.stopPropagation()
  emit('resize-start', e, props.item.id)
}

const labelOpacity = computed(() => (props.expanded && !props.resizing && !isSound.value) ? 1 : 0)
</script>

<template>
  <div
    class="gb-wrap"
    :class="{ editing: editing && !resizing }"
    :style="{ width: computedWidth + 'px', transition: resizing ? 'none' : 'width 350ms cubic-bezier(0.2, 0.8, 0.2, 1)' }"
    @click="onClick"
  >
    <div
      class="gb-body"
      :class="{ 'gb-editing': editing, 'gb-active': containerActive, 'gb-expanded': expanded }"
      :style="[stateStyle, blurStyle]"
    >
      <!-- 1*1 矢量质感玻璃高光背景 (未激活时) -->
      <svg v-if="!containerActive && !expanded" class="gb-bg-svg" width="62" height="62" viewBox="0 0 62 62" fill="none">
        <circle cx="31" cy="31" r="30.5" fill="#A6A6A6" fill-opacity="0.1" style="mix-blend-mode:overlay"/>
        <circle cx="31" cy="31" r="30.5" fill="#494949" fill-opacity="0.5" style="mix-blend-mode:color-dodge"/>
        <circle cx="31" cy="31" r="30.5" fill="white" fill-opacity="0.08"/>
        <circle cx="31" cy="31" r="30.5" stroke="url(#paint0_linear_2860_1301)" style="mix-blend-mode:plus-lighter"/>
      </svg>

      <!-- 2*1 矢量质感玻璃胶囊高光背景 (未激活时) -->
      <svg v-if="!containerActive && expanded" class="gb-bg-svg" width="100%" height="100%" viewBox="0 0 138 62" preserveAspectRatio="none" fill="none">
        <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="#A6A6A6" fill-opacity="0.1" style="mix-blend-mode:overlay"/>
        <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="#494949" fill-opacity="0.5" style="mix-blend-mode:color-dodge"/>
        <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" fill="white" fill-opacity="0.08"/>
        <rect x="0.5" y="0.5" width="137" height="61" rx="30.5" stroke="url(#paint0_linear_331_95718)" style="mix-blend-mode:plus-lighter" vector-effect="non-scaling-stroke"/>
      </svg>

      <!-- 常规内容：图标 + 展开 label -->
      <div
        class="gb-row"
        :class="{ 'gb-row-expanded': expanded }"
        :style="{ opacity: (isSound && expanded && !resizing) ? 0 : 1, pointerEvents: (isSound && expanded && !resizing) ? 'none' : 'auto' }"
      >
        <div class="gb-icon-badge" :style="badgeStyle">
          <LIcon
            :name="iconName"
            :size="expanded ? (props.item.id === 'darkMode' ? 38 : 20) : 32"
            :filled="!!(item.fillOnActive && containerActive)"
            :stroke-width="isLocation && isActive ? 2.5 : 2"
          />
        </div>
        <span v-if="expanded" class="gb-label" :style="{ opacity: labelOpacity, transition: resizing ? 'none' : 'opacity 0.25s ease-out 0.15s' }">{{ item.label }}</span>
      </div>

      <!-- 响铃展开：三段切换 -->
      <div v-if="isSound" class="gb-sound" :style="{ opacity: (expanded && !resizing) ? 1 : 0, pointerEvents: (expanded && !resizing) ? 'auto' : 'none' }">
        <div class="gb-sound-knob" :style="{ transform: `translateX(${soundKnobX}px)` }"></div>
        <button class="gb-seg" :class="{ on: control.soundMode === 'ring' }" @click.stop="control.setSoundMode('ring')">
          <LIcon name="bell" :size="18" :filled="control.soundMode === 'ring'" />
        </button>
        <button class="gb-seg gb-seg-vibrate" :class="{ on: control.soundMode === 'vibrate' }" @click.stop="control.setSoundMode('vibrate')">
          <LIcon name="vibrate" :size="18" />
        </button>
        <button class="gb-seg gb-seg-mute" :class="{ on: control.soundMode === 'mute' }" @click.stop="control.setSoundMode('mute')">
          <LIcon name="bellOff" :size="18" />
        </button>
      </div>
    </div>

    <!-- 编辑模式：删除徽标 -->
    <div v-if="editing" class="gb-remove" @click.stop="emit('remove', item.id)">
      <LIcon name="minus" :size="12" :stroke-width="3" />
    </div>
    <!-- 编辑模式：伸缩手柄 -->
    <div
      v-if="editing"
      class="gb-resize"
      @pointerdown="onResizeDown"
      @dragstart.prevent.stop
    >
      <svg width="100%" height="100%" viewBox="-1.5 -1.5 19.5 19.5" fill="none">
        <path d="M 16 2 A 14 14 0 0 1 2 16 A 3 3 0 0 1 2 10 A 8 8 0 0 0 10 2 A 3 3 0 0 1 16 2 Z" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.gb-wrap {
  position: relative;
  height: 100%;
  border-radius: 999px;
  cursor: pointer;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.18));
}
.gb-wrap.editing { cursor: move; }
.gb-body {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  overflow: hidden;
  transition: background 0.3s ease;
  box-shadow: none;
}
.gb-body.gb-active {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}
.gb-editing { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4) !important; }

.gb-bg-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.gb-row {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.3s ease;
  z-index: 1;
}
.gb-row-expanded {
  justify-content: flex-start;
  padding-left: 12px;
  gap: 8px;
}
.gb-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}
.gb-body.gb-expanded .gb-icon-badge {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex: none;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}
.gb-label {
  font: 500 12.5px/1 var(--font-stack);
  letter-spacing: -0.1px;
  white-space: nowrap;
  color: #fff;
}

/* 响铃三段 */
.gb-sound {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px;
  transition: opacity 0.3s ease;
  z-index: 1;
}
.gb-sound-knob {
  position: absolute;
  left: 6px;
  top: 50%;
  margin-top: -21px;
  height: 42px;
  width: calc((100% - 12px) / 3);
  background: #fff;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.gb-seg {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.3s ease;
}
.gb-seg:hover { background: rgba(255, 255, 255, 0.18); }
.gb-seg.on { color: var(--ios-blue); background: transparent; }
.gb-seg-vibrate.on { color: var(--ios-orange); }
.gb-seg-mute.on { color: #1f2937; }

/* 删除徽标 */
.gb-remove {
  position: absolute;
  top: -2px;
  left: -2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(12px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3;
  cursor: pointer;
  transition: background 0.2s ease;
}
.gb-remove:hover { background: rgba(239, 68, 68, 0.8); }

/* 伸缩手柄 */
.gb-resize {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  z-index: 3;
  cursor: nwse-resize;
  touch-action: none;
  opacity: 0.9;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));
}
.gb-resize:hover { opacity: 1; }
</style>
