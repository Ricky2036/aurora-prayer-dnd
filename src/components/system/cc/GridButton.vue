<script setup>
import { computed, watch } from 'vue'
import { useControlStore } from '../../../stores/controlStore'
import { useI18nStore } from '../../../stores/i18nStore'
import LIcon from '../../ui/LIcon.vue'

/**
 * 控制中心网格开关按钮（移植自 android_control_center.tsx GridButton）。
 * 1x1 圆形 / 2x1 胶囊（展开 label）；响铃展开为三段切换；
 * 支持无缝缩放与位移衔接动画；手电筒开闭态独立尺寸；响铃三态展开与1x1独立尺寸。
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
const i18n = useI18nStore()

const isSound = computed(() => props.item.id === 'sound')
const isLocation = computed(() => props.item.id === 'location')
const isFlashlight = computed(() => props.item.id === 'flashlight')
const hasBadge = computed(() => true)
const isFineTuning = computed(() => control.fineTuningMode)

/** 激活状态绑定 controlStore */
const isActive = computed(() => {
  const id = props.item.id
  if (id === 'sound') {
    // 1x1 状态下：静音 (mute) 和振动 (vibrate) 属于激活高亮状态
    return control.soundMode === 'mute' || control.soundMode === 'vibrate'
  }
  return !!control[id]
})

const isSelected = computed(() => {
  if (!isFineTuning.value) return false
  if (isSound.value) {
    if (props.expanded) return false
    return control.selectedTarget === 'sound' ||
           control.selectedTarget === `sound_${control.soundMode}_1x1` ||
           control.selectedTarget === `sound_${control.soundMode}` ||
           control.selectedTarget === 'sound_ring_1x1' ||
           control.selectedTarget === 'sound_vibrate_1x1' ||
           control.selectedTarget === 'sound_mute_1x1'
  }
  if (isFlashlight.value) {
    const activeKey = isActive.value ? 'flashlight_on' : 'flashlight_off'
    return control.selectedTarget === 'flashlight' ||
           control.selectedTarget === activeKey ||
           control.selectedTarget === 'flashlight_on' ||
           control.selectedTarget === 'flashlight_off'
  }
  return control.selectedTarget === props.item?.id
})

/** 关闭态专用图标：配置了 item.iconOff 的开关（如晕动舒缓）在关闭时用另一套图形 */
const useOffIcon = computed(() => !isActive.value && !!props.item?.iconOff)

const iconName = computed(() => {
  if (isSound.value) {
    if (control.soundMode === 'mute') return 'bellOff'
    if (control.soundMode === 'vibrate') return 'vibrate'
    return 'bell'
  }
  if (isFlashlight.value) {
    return isActive.value ? 'flashlightOn' : 'flashlight'
  }
  if (useOffIcon.value) return props.item.iconOff
  return props.item.icon
})

/** 展开态响铃容器不激活底色；有底板胶囊（如蓝牙）容器不激活；无底板胶囊激活时整体着色 */
const containerActive = computed(() => {
  if (props.editing) return false
  if (isSound.value && props.expanded) return false
  if (props.expanded && hasBadge.value) return false
  return isActive.value
})

/**
 * 图标像素尺寸。
 * 只有一级缩放：gridScale（宫格整体缩放）。格子 / 间距 / 图标 / 底板 / 内边距
 * 全部乘同一个 k，图标与底板因此始终同心——只放大格子不放大图标会让图标偏离底板中心。
 * 先乘以 iconFactor 再交给下游，这样各图标手调基准之间的相对差异
 * （wifi 26 / darkMode 40 / oneLeap 20…）能被完整保留。
 */
const iconSize = computed(() => {
  const k = control.iconFactor
  const scale = (v) => (v == null ? v : v * k)
  if (isSound.value) {
    const mode = control.soundMode
    return scale(control.getIconSize(`sound_${mode}_1x1`) || control.getIconSize('sound') || 24)
  }
  if (isFlashlight.value) {
    return scale(isActive.value
      ? (control.getIconSize('flashlight_on') || control.getIconSize('flashlight') || 32)
      : (control.getIconSize('flashlight_off') || control.getIconSize('flashlight') || 32))
  }
  // 关闭态图形（如晕动舒缓的斜杠版）沿用开关自身基准：两套图形的视觉比重是一致的
  return scale(control.getIconSize(props.item.id))
})

const stateStyle = computed(() => {
  if (props.editing) {
    return { background: 'rgba(255, 255, 255, 0.16)', color: '#fff' }
  }
  if (containerActive.value && !props.expanded) {
    let activeColor = props.item.activeColor || '#258FFF'
    if (isSound.value) {
      activeColor = control.soundMode === 'mute' ? '#FF3330' : '#0A99FF'
    }
    return { background: props.item.activeBg || '#fff', color: activeColor }
  }
  if (containerActive.value && props.expanded && !hasBadge.value) {
    return { background: props.item.activeBg || '#fff', color: props.item.activeColor || '#258FFF' }
  }
  return { background: 'rgba(255, 255, 255, 0.16)', color: '#fff' }
})

/* 监听规格变化，同步 controlStore 中的 soundItemSize 及选中的微调目标 */
watch(() => props.expanded, (expanded) => {
  if (isSound.value) {
    control.setSoundItemSize(expanded ? '2x1' : '1x1')
    if (control.selectedTarget && (control.selectedTarget.startsWith('sound_') || control.selectedTarget === 'sound')) {
      control.selectTarget(`sound_${control.soundMode}_${expanded ? '2x1' : '1x1'}`, 'icon')
    }
  }
}, { immediate: true })

const badgeStyle = computed(() => {
  // 底板与图标用同一个倍率，保证「图标与底板等比放大」
  const bgSize = (control.getBgSize(props.item.id) || 38) * control.iconFactor
  const sizeOverride = {
    width: `${bgSize}px`,
    height: `${bgSize}px`,
    flex: `0 0 ${bgSize}px`
  }

  // 1x1 不画底板（只定尺寸，背景透出砖块底色）
  if (!props.expanded) return sizeOverride
  // 1x1 拖成 2x1 后，除响铃（三段切换有独立滑块底）外都不加圆形底板，
  // 否则图标会被硬塞一个灰/白圆盘，跟其他 2x1 胶囊不是一个视觉语言
  if (!isSound.value) return sizeOverride
  if (props.editing) {
    return {
      background: 'rgba(255, 255, 255, 0.2)',
      boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
      color: '#fff',
      ...sizeOverride
    }
  }
  if (isActive.value) {
    return {
      background: props.item.activeBg || '#fff',
      boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
      color: props.item.activeColor || '#258FFF',
      ...sizeOverride
    }
  }
  return {
    background: 'rgba(255, 255, 255, 0.2)',
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
    color: '#fff',
    ...sizeOverride
  }
})

const blurStyle = computed(() => ({
  backdropFilter: (containerActive.value && !props.expanded && !props.editing) ? 'none' : 'blur(25px) saturate(180%)',
  WebkitBackdropFilter: (containerActive.value && !props.expanded && !props.editing) ? 'none' : 'blur(25px) saturate(180%)'
}))

/* ---- 响铃 2x1 ↔ 1x1 无缝位移与缩放计算 ---- */
/* 三个段图标（响铃/振动/静音）必须乘 iconFactor 跟随整体缩放，
   否则格子放大后它们显得偏小——之前只放大了普通开关的图标，漏了这三段。 */
const soundSegSizes2x1 = computed(() => {
  const k = control.iconFactor
  const s = (v) => (v == null ? v : v * k)
  return {
    ring: s(control.getIconSize('sound_ring_2x1') || control.getIconSize('sound_ring') || 20),
    vibrate: s(control.getIconSize('sound_vibrate_2x1') || control.getIconSize('sound_vibrate') || 20),
    mute: s(control.getIconSize('sound_mute_2x1') || control.getIconSize('sound_mute') || 20)
  }
})

const soundSegSizes1x1 = computed(() => {
  const k = control.iconFactor
  const s = (v) => (v == null ? v : v * k)
  return {
    ring: s(control.getIconSize('sound_ring_1x1') || control.getIconSize('sound') || 24),
    vibrate: s(control.getIconSize('sound_vibrate_1x1') || control.getIconSize('sound') || 24),
    mute: s(control.getIconSize('sound_mute_1x1') || control.getIconSize('sound') || 24)
  }
})

/* 响铃三段滑块的内部几何（42 / 6 / 4 / 24 / 32）都是按格子 62 量出来的，
   整体放大后必须等比换算，否则滑块会偏离圆心。 */
const SOUND_SEG = 42
const SOUND_LEFT = 6

const soundKnobStyle = computed(() => {
  const k = control.gridScale
  const seg = SOUND_SEG * k
  const i = { ring: 0, vibrate: 1, mute: 2 }[control.soundMode]
  if (props.expanded) {
    return {
      width: `${seg}px`,
      height: `${seg}px`,
      left: `${SOUND_LEFT * k}px`,
      transform: `translateX(${i * seg}px)`,
      opacity: 1
    }
  }
  // 1x1 状态下滑块淡隐，保持纯净圆形
  return {
    width: `${seg}px`,
    height: `${seg}px`,
    left: `${SOUND_LEFT * k}px`,
    transform: `translateX(${4 * k}px)`,
    opacity: 0
  }
})

function getSoundSegStyle(mode, index) {
  const k = control.gridScale
  const seg = SOUND_SEG * k
  const isCur = control.soundMode === mode
  const s2x1 = soundSegSizes2x1.value[mode] || 20
  const s1x1 = soundSegSizes1x1.value[mode] || 24
  const scaleRatio = s2x1 > 0 ? (s1x1 / s2x1) : 1.2

  if (props.expanded) {
    return {
      left: `${SOUND_LEFT * k}px`,
      transform: `translateX(${index * seg}px) scale(1)`,
      opacity: 1,
      pointerEvents: 'auto',
      transition: isFineTuning.value ? 'none' : undefined
    }
  }

  // 1x1 收起态：当前激活项无缝平移到圆心（left + tx + 段宽/2 = 格子中心）并缩放到 1x1 尺寸
  if (isCur) {
    return {
      left: `${SOUND_LEFT * k}px`,
      transform: `translateX(${4 * k}px) scale(${scaleRatio})`,
      opacity: 1,
      pointerEvents: 'auto',
      transition: isFineTuning.value ? 'none' : undefined
    }
  }

  // 非激活项向两侧微移并渐隐
  const offsetX = (index === 0 ? -24 : (index === 2 ? 32 : 4)) * k
  return {
    left: `${SOUND_LEFT * k}px`,
    transform: `translateX(${offsetX}px) scale(0.5)`,
    opacity: 0,
    pointerEvents: 'none',
    transition: isFineTuning.value ? 'none' : undefined
  }
}

function onSoundSegClick(mode, e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }

  if (!props.expanded) {
    // 1x1 收起态下的点击
    if (isFineTuning.value) {
      const cur1x1Target = `sound_${control.soundMode}_1x1`
      if (control.selectedTarget === cur1x1Target || control.selectedTarget === 'sound') {
        // 已经选中当前 1x1，再次点击轮换到下一个模式，方便连续微调
        control.cycleSoundMode()
        control.selectTarget(`sound_${control.soundMode}_1x1`, 'icon')
      } else {
        // 初次点击选中当前显示的 1x1 图标
        control.selectTarget(cur1x1Target, 'icon')
      }
    } else {
      if (!props.editing) {
        control.cycleSoundMode()
      }
    }
    return
  }

  // 2x1 展开态下的点击
  control.setSoundMode(mode)
  if (isFineTuning.value) {
    control.selectTarget(`sound_${mode}_2x1`, 'icon')
  }
}

function onClick(e) {
  if (e) {
    e.stopPropagation()
  }
  if (isFineTuning.value) {
    if (e) e.preventDefault()
    if (isSound.value) {
      if (props.expanded) {
        control.selectTarget(`sound_${control.soundMode}_2x1`, 'icon')
      } else {
        const cur1x1Target = `sound_${control.soundMode}_1x1`
        if (control.selectedTarget === cur1x1Target || control.selectedTarget === 'sound') {
          control.cycleSoundMode()
          control.selectTarget(`sound_${control.soundMode}_1x1`, 'icon')
        } else {
          control.selectTarget(cur1x1Target, 'icon')
        }
      }
      return
    }
    if (isFlashlight.value) {
      const curKey = isActive.value ? 'flashlight_on' : 'flashlight_off'
      if (control.selectedTarget === curKey || control.selectedTarget === 'flashlight') {
        control.toggle('flashlight')
        control.selectTarget(isActive.value ? 'flashlight_off' : 'flashlight_on', 'icon')
      } else {
        control.selectTarget(curKey, 'icon')
      }
      return
    }
    control.selectTarget(props.item.id, 'icon')
    return
  }
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
</script>

<template>
  <div
    class="gb-wrap"
    :class="{
      editing: editing && !resizing,
      'gb-wrap-expanded': expanded,
      'ft-selectable': isFineTuning,
      'ft-selected': isSelected
    }"
    :style="{ width: computedWidth + 'px', transition: resizing ? 'none' : 'width 350ms cubic-bezier(0.2, 0.8, 0.2, 1)' }"
    @click="onClick"
  >
    <div
      class="gb-body"
      :class="{ 'gb-editing': editing, 'gb-active': containerActive, 'gb-expanded': expanded }"
      :style="[stateStyle, blurStyle]"
    >
      <!-- 统一响应式矢量玻璃高光轮廓（无缝衔接 1x1 圆形 ↔ 2x1 胶囊，杜绝 SVG 闪烁） -->
      <svg class="gb-bg-svg" width="100%" height="100%" fill="none" style="overflow: visible;">
        <rect
          x="0.5"
          y="0.5"
          width="calc(100% - 1px)"
          :height="control.cellSize - 1"
          :rx="control.cellSize / 2 - 0.5"
          fill="rgba(255, 255, 255, 0.04)"
          :stroke="expanded ? 'url(#paint0_linear_331_95718)' : 'url(#paint0_linear_2860_1301)'"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <!-- 常规内容：图标 + 展开 label (非响铃开关) -->
      <div
        v-if="!isSound"
        class="gb-row"
        :class="{ 'gb-row-expanded': expanded }"
      >
        <div class="gb-icon-badge" :style="badgeStyle">
          <LIcon
            :name="iconName"
            :size="iconSize"
            :filled="!!(item.fillOnActive && containerActive)"
            :stroke-width="isLocation && isActive ? 2.5 : 2"
          />
        </div>
        <span
          class="gb-label"
          :style="{
            opacity: (expanded && !resizing) ? 1 : 0,
            transform: (expanded && !resizing) ? 'translateX(0px) scale(1)' : 'translateX(-8px) scale(0.85)',
            pointerEvents: expanded ? 'auto' : 'none',
            transition: resizing ? 'none' : 'opacity 0.25s ease-out 0.08s, transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)'
          }"
        >
          {{ i18n.ccLabel(item.id) }}
        </span>
      </div>

      <!-- 响铃三段：无缝位移与缩放容器 -->
      <div v-if="isSound" class="gb-sound">
        <div class="gb-sound-knob" :style="soundKnobStyle"></div>

        <!-- 响铃状态 -->
        <button
          class="gb-seg gb-seg-ring"
          :class="{
            on: control.soundMode === 'ring',
            'ft-seg-selectable': isFineTuning && expanded,
            'ft-seg-selected': isFineTuning && expanded && (control.selectedTarget === 'sound_ring_2x1' || (control.selectedTarget === 'sound' && control.soundMode === 'ring'))
          }"
          :style="getSoundSegStyle('ring', 0)"
          @click="onSoundSegClick('ring', $event)"
        >
          <LIcon name="bell" :size="soundSegSizes2x1.ring" />
        </button>

        <!-- 振动状态 -->
        <button
          class="gb-seg gb-seg-vibrate"
          :class="{
            on: control.soundMode === 'vibrate',
            'ft-seg-selectable': isFineTuning && expanded,
            'ft-seg-selected': isFineTuning && expanded && (control.selectedTarget === 'sound_vibrate_2x1' || (control.selectedTarget === 'sound' && control.soundMode === 'vibrate'))
          }"
          :style="getSoundSegStyle('vibrate', 1)"
          @click="onSoundSegClick('vibrate', $event)"
        >
          <LIcon name="vibrate" :size="soundSegSizes2x1.vibrate" />
        </button>

        <!-- 静音状态 -->
        <button
          class="gb-seg gb-seg-mute"
          :class="{
            on: control.soundMode === 'mute',
            'ft-seg-selectable': isFineTuning && expanded,
            'ft-seg-selected': isFineTuning && expanded && (control.selectedTarget === 'sound_mute_2x1' || (control.selectedTarget === 'sound' && control.soundMode === 'mute'))
          }"
          :style="getSoundSegStyle('mute', 2)"
          @click="onSoundSegClick('mute', $event)"
        >
          <LIcon name="bellOff" :size="soundSegSizes2x1.mute" />
        </button>
      </div>
    </div>

    <!-- 编辑模式：删除徽标 -->
    <div v-if="editing" class="gb-remove" @click.stop="emit('remove', item.id)">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" fill="rgba(255, 255, 255, 0.24)" stroke="url(#gb_del_stroke)" stroke-width="1"/>
        <rect x="6.3335" y="11" width="11.3333" height="2.33333" rx="1.16667" fill="white"/>
        <defs>
          <linearGradient id="gb_del_stroke" x1="6" y1="3" x2="18" y2="21" gradientUnits="userSpaceOnUse">
            <stop stop-color="white" stop-opacity="0.95"/>
            <stop offset="0.5" stop-color="white" stop-opacity="0.3"/>
            <stop offset="1" stop-color="white" stop-opacity="0.75"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <!-- 编辑模式：伸缩手柄（月牙图标） -->
    <div
      v-if="editing"
      class="gb-resize"
      @pointerdown="onResizeDown"
      @dragstart.prevent.stop
    >
      <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M14.9434 4.60134C14.9434 2.06009 16.9708 0 19.4717 0C21.9726 0 24 2.06009 24 4.60134C24 15.5287 15.2822 24.3871 4.5283 24.3871C2.02739 24.3871 0 22.327 0 19.7858C0 17.2445 2.02739 15.1844 4.5283 15.1844C10.2804 15.1844 14.9434 10.4462 14.9434 4.60134Z"
          fill="rgba(255, 255, 255, 0.22)"
          stroke="url(#gb_resize_stroke)"
          stroke-width="1.2"
        />
        <defs>
          <linearGradient id="gb_resize_stroke" x1="0" y1="0" x2="24" y2="25" gradientUnits="userSpaceOnUse">
            <stop stop-color="white" stop-opacity="0.95"/>
            <stop offset="0.5" stop-color="white" stop-opacity="0.3"/>
            <stop offset="1" stop-color="white" stop-opacity="0.8"/>
          </linearGradient>
        </defs>
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
.gb-editing {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35) !important;
}

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
  /* 12px 是按格子 62 量出来的（12 + 底板38 + 12 = 62 恰好居中）。
     整体放大后必须等比放大，否则底板不再居中，偏移 = 12 × (1 - k)。 */
  padding-left: calc(12px * var(--cc-k, 1));
  z-index: 1;
}
.gb-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(38px * var(--cc-k, 1));
  height: calc(38px * var(--cc-k, 1));
  border-radius: 50%;
  flex: none;
  transition: background 0.3s ease, color 0.3s ease;
}
.gb-label {
  font: 500 12.5px/1 var(--font-stack);
  letter-spacing: -0.1px;
  white-space: nowrap;
  color: #fff;
  margin-left: calc(8px * var(--cc-k, 1));
  transform-origin: left center;
}

/* 响铃三段无缝位移与缩放 */
.gb-sound {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  z-index: 1;
}
.gb-sound-knob {
  position: absolute;
  top: 50%;
  margin-top: calc(-21px * var(--cc-k, 1));
  background: #fff;
  border-radius: 999px;
  box-shadow: none;
  transition: transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1), width 350ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 280ms ease;
  z-index: 1;
}
.gb-seg {
  position: absolute;
  top: 50%;
  margin-top: calc(-21px * var(--cc-k, 1));
  width: calc(42px * var(--cc-k, 1));
  height: calc(42px * var(--cc-k, 1));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-radius: 999px;
  cursor: pointer;
  z-index: 2;
  transition: transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 280ms ease, color 0.25s ease;
}
.gb-seg:hover { background: rgba(255, 255, 255, 0.18); }
.gb-seg.on { color: #0A99FF; background: transparent; }
.gb-seg-vibrate.on { color: #0A99FF; }
.gb-seg-mute.on { color: #FF3330; }
.gb-seg.on:hover { background: transparent; }
/* 1x1 响铃常态（未激活/深色玻璃底）下，铃铛图标保持纯白高光 */
.gb-wrap:not(.gb-wrap-expanded) .gb-body:not(.gb-active) .gb-seg {
  color: #fff !important;
}
.gb-seg.ft-seg-selectable {
  cursor: pointer;
}
.gb-seg.ft-seg-selectable:hover {
  outline: 1.5px dashed rgba(37, 143, 255, 0.6);
  outline-offset: -2px;
}
.gb-seg.ft-seg-selected {
  /* 三段在格子内部，用负 offset 把框收进来，避免叠到相邻段上 */
  outline: var(--ft-select-width) solid var(--ft-select-color) !important;
  outline-offset: -2px !important;
  box-shadow: none !important;
}

/* 删除徽标 */
.gb-remove {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  overflow: visible;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
  transition: transform 0.15s ease, opacity 0.15s ease, filter 0.15s ease;
}
.gb-remove:hover {
  transform: scale(1.08);
}
.gb-remove:active {
  transform: scale(0.92);
}

/* 伸缩手柄 */
.gb-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 24px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  cursor: ew-resize;
  background: transparent;
  border: none;
  padding: 0;
  overflow: visible;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
  transition: transform 0.15s ease, opacity 0.15s ease, filter 0.15s ease;
  touch-action: none;
}
.gb-resize:hover {
  transform: scale(1.08);
}
.gb-resize:active {
  transform: scale(0.92);
}

/* 微调模式响应与高亮选框 */
.gb-wrap.ft-selectable {
  cursor: pointer;
}
.gb-wrap.ft-selectable:hover .gb-body {
  outline: 1.5px dashed rgba(37, 143, 255, 0.6);
  outline-offset: 1px;
}
.gb-wrap.ft-selected .gb-body {
  outline: var(--ft-select-width) solid var(--ft-select-color) !important;
  outline-offset: var(--ft-select-offset) !important;
  box-shadow: var(--ft-select-glow) !important;
  z-index: 10 !important;
}
</style>
