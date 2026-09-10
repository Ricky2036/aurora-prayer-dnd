<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    required: true
  },
  tabs: {
    type: Array,
    default: () => []
  },
  height: {
    type: [String, Number],
    default: 62
  },
  bottom: {
    type: [String, Number],
    default: '22px'
  },
  accentColor: {
    type: String,
    default: '#FF9500'
  },
  dark: {
    type: Boolean,
    default: true
  },
  glass: {
    type: Boolean,
    default: true
  },
  ariaLabel: {
    type: String,
    default: '底部悬浮导航'
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const tabsCount = computed(() => props.tabs.length || 1)

const activeIndex = computed(() => {
  const idx = props.tabs.findIndex((t) => t.id === props.modelValue)
  return idx >= 0 ? idx : 0
})

const formattedHeight = computed(() => {
  return typeof props.height === 'number' ? `${props.height}px` : props.height
})

const formattedBottom = computed(() => {
  return typeof props.bottom === 'number' ? `${props.bottom}px` : props.bottom
})

function selectTab(tab) {
  if (tab.id !== props.modelValue) {
    emit('update:modelValue', tab.id)
    emit('change', tab.id, tab)
  }
}
</script>

<template>
  <nav
    class="floating-tab-bar"
    :class="{ 'theme-dark': dark, 'glass-effect': glass }"
    :style="{
      height: formattedHeight,
      bottom: formattedBottom,
      '--tab-accent': accentColor
    }"
    :aria-label="ariaLabel"
  >
    <!-- 滑动高亮底托胶囊 -->
    <div
      v-if="tabs.length > 0"
      class="nav-sliding-pill-track"
      :style="{
        width: `calc((100% - 8px) / ${tabsCount})`,
        transform: `translateX(${activeIndex * 100}%)`
      }"
      aria-hidden="true"
    >
      <div class="nav-highlight-pill"></div>
    </div>

    <!-- Tab 列表 -->
    <div
      v-for="(tab, index) in tabs"
      :key="tab.id"
      class="floating-tab-item"
      :class="{ active: modelValue === tab.id }"
      role="tab"
      :aria-selected="modelValue === tab.id"
      :tabindex="modelValue === tab.id ? 0 : -1"
      @click="selectTab(tab)"
    >
      <slot name="tab" :tab="tab" :active="modelValue === tab.id" :index="index">
        <!-- 图标区域 -->
        <div class="tab-icon-wrap">
          <slot name="icon" :tab="tab" :active="modelValue === tab.id" :index="index">
            <svg
              v-if="tab.icon"
              class="tab-icon-svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
            >
              <path
                :d="tab.icon"
                :fill="modelValue === tab.id ? accentColor : '#FFFFFF'"
              />
            </svg>
          </slot>
          <!-- 徽标支持 -->
          <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
        </div>

        <!-- 标签文本 -->
        <slot name="label" :tab="tab" :active="modelValue === tab.id" :index="index">
          <span class="tab-label-text">{{ tab.name }}</span>
        </slot>
      </slot>
    </div>
  </nav>
</template>

<style scoped>
.floating-tab-bar {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 44px);
  max-width: 420px;
  background: rgba(24, 26, 26, 0.88);
  border-radius: 9999px;
  border: 0.5px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px;
  box-sizing: border-box;
  z-index: 25;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;
}

.floating-tab-bar.glass-effect {
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
}

.floating-tab-bar:not(.theme-dark) {
  background: rgba(245, 245, 247, 0.88);
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 滑动胶囊底托轨道 */
.nav-sliding-pill-track {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: transform 0.32s cubic-bezier(0.25, 1, 0.5, 1);
  will-change: transform;
  z-index: 1;
}

/* 激活态高亮半透胶囊底块 */
.nav-highlight-pill {
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.1);
}

.theme-dark .nav-highlight-pill {
  background: rgba(255, 255, 255, 0.16);
}

.floating-tab-bar:not(.theme-dark) .nav-highlight-pill {
  background: rgba(0, 0, 0, 0.08);
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.05);
}

/* Tab 选项 */
.floating-tab-item {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  z-index: 2;
  -webkit-tap-highlight-color: transparent;
  outline: none;
  transition: transform 0.12s ease;
}

.floating-tab-item:active {
  transform: scale(0.96);
}

.tab-icon-wrap {
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon-svg {
  position: relative;
  z-index: 2;
  transition: fill 0.2s ease, transform 0.2s ease;
}

.floating-tab-item.active .tab-icon-svg {
  transform: scale(1.02);
}

.tab-label-text {
  font-size: 10.5px;
  color: #8e8e93;
  font-weight: 500;
  letter-spacing: -0.1px;
  transition: color 0.2s ease;
  line-height: 1;
}

.floating-tab-item.active .tab-label-text {
  color: var(--tab-accent, #ff9500);
  font-weight: 600;
}

.floating-tab-bar:not(.theme-dark) .tab-icon-svg path {
  fill: #3c3c43;
}

.floating-tab-bar:not(.theme-dark) .floating-tab-item.active .tab-icon-svg path {
  fill: var(--tab-accent, #ff9500);
}

.floating-tab-bar:not(.theme-dark) .tab-label-text {
  color: #8a8a8e;
}

.floating-tab-bar:not(.theme-dark) .floating-tab-item.active .tab-label-text {
  color: var(--tab-accent, #ff9500);
}

/* 徽标 */
.tab-badge {
  position: absolute;
  top: -2px;
  right: -6px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: #ff3b30;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
