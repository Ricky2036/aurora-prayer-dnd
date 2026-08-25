<script setup>
import { computed, ref } from 'vue'
import { APPS } from '../../config/apps'
import { useSystemStore } from '../../stores/systemStore'
import { useSwipeGesture } from '../../composables/useSwipeGesture'
import { getDriver } from '../../composables/driverRegistry'
import AppIcon from '../ui/AppIcon.vue'
import SearchBar from '../ui/SearchBar.vue'
import { clamp } from '../../utils/math'

import { useI18nStore } from '../../stores/i18nStore'

/**
 * App 资源库：搜索实时过滤 + 分类网格。
 * 打开：桌面左滑越界 / 点搜索胶囊；关闭：右滑 / 点空白 / Home 条。
 * 反向手势通过 driverRegistry 接管 ScreenView 的同一个 spring。
 */
const system = useSystemStore()
const i18n = useI18nStore()

const overlay = computed(() => system.overlays.appLibrary)
const visible = computed(() => overlay.value.status !== 'closed')

const layerStyle = computed(() => ({
  transform: `translateX(${(1 - overlay.value.progress) * 100}%)`
}))
const blurStyle = computed(() => ({ opacity: clamp(overlay.value.progress * 1.2, 0, 1) }))

/* 分类分组 */
const CATEGORIES = [
  { key: 'social', ids: ['phone', 'messages'] },
  { key: 'productivity', ids: ['settings', 'calendar', 'clock'] },
  { key: 'creativity', ids: ['photos', 'camera'] },
  { key: 'utilities', ids: ['safari'] }
]

const query = ref('')

const filteredCategories = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    return CATEGORIES.map((c) => ({
      name: i18n.categoryName(c.key),
      apps: c.ids.map(getAppById)
    }))
  }
  const matched = APPS.filter((a) => {
    const locName = i18n.appName(a.id)?.toLowerCase() || ''
    return a.name.toLowerCase().includes(q) || locName.includes(q) || a.id.toLowerCase().includes(q)
  })
  return matched.length ? [{ name: i18n.categoryName('searchResults'), apps: matched }] : []
})

function getAppById(id) {
  return APPS.find((a) => a.id === id)
}

/* 右滑关闭（反向手势，接管共享 spring） */
const rootRef = ref(null)
const CLOSE_SPAN = 320

useSwipeGesture(rootRef, {
  axis: 'x',
  direction: 1, // 右滑
  span: CLOSE_SPAN,
  canStart: () =>
    overlay.value.status === 'open' ||
    (overlay.value.status === 'settling' && overlay.value.progress > 0.5),
  onStart() {
    getDriver('appLibrary')?.snapTo(overlay.value.progress)
  },
  onProgress(p) {
    const remain = clamp(1 - p, 0, 1)
    getDriver('appLibrary')?.snapTo(remain)
    system.setOverlayProgress('appLibrary', remain)
  },
  onRelease(p, velocity) {
    const driver = getDriver('appLibrary')
    const close = p > 0.32 || velocity > 0.5
    if (close) {
      system.beginSettle('appLibrary', clamp(1 - p, 0, 1))
      driver?.animateTo(0, {
        initialVelocity: -velocity,
        onDone: () => system.settleOverlay('appLibrary', false)
      })
    } else {
      system.beginSettle('appLibrary', clamp(1 - p, 0, 1))
      driver?.animateTo(1, {
        initialVelocity: -velocity,
        onDone: () => system.settleOverlay('appLibrary', true)
      })
    }
    return close ? 1 : 0
  }
})

function onBackdropClick(e) {
  if (e.target === e.currentTarget) system.requestCloseOverlay('appLibrary')
}

function onCancelSearch() {
  query.value = ''
  system.requestCloseOverlay('appLibrary')
}
</script>

<template>
  <!-- v-show 而非 v-if：反向手势在组件挂载时绑定，元素需始终存在；关闭时 display:none 不影响布局 -->
  <div v-show="visible" ref="rootRef" class="app-library" :style="layerStyle" @click="onBackdropClick">
    <div class="al-backdrop" :style="blurStyle"></div>

    <div class="al-content">
      <div class="al-header" @click.stop>
        <div class="al-title">App 资源库</div>
        <SearchBar v-model="query" placeholder="搜索 App" @cancel="onCancelSearch" />
      </div>

      <div class="al-body scrollable" @click="onBackdropClick">
        <template v-if="filteredCategories.length">
          <div v-for="cat in filteredCategories" :key="cat.name" class="al-category" @click.stop>
            <div class="al-cat-name">{{ cat.name }}</div>
            <div class="al-cat-grid">
              <AppIcon
                v-for="app in cat.apps"
                :key="app.id"
                :app="app"
              />
            </div>
          </div>
        </template>
        <div v-else class="al-empty" @click.stop>无匹配结果</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-library {
  position: absolute;
  inset: 0;
  z-index: var(--z-app-library);
  will-change: transform;
}
.al-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(238, 238, 244, 0.55);
  backdrop-filter: blur(26px) saturate(180%);
  -webkit-backdrop-filter: blur(26px) saturate(180%);
}
@supports not (backdrop-filter: blur(1px)) {
  .al-backdrop { background: rgba(238, 238, 244, 0.94); }
}

.al-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}
.al-content > * { pointer-events: auto; }

.al-header {
  padding: calc(var(--safe-top) + 8px) 16px 10px;
  flex: none;
}
.al-title {
  font: 700 26px/1.2 var(--font-stack);
  color: var(--label);
  margin-bottom: 10px;
}

.al-body {
  flex: 1;
  padding: 4px 16px 60px;
}
.al-category { margin-bottom: 22px; }
.al-cat-name {
  font: var(--text-headline);
  color: var(--label);
  margin: 0 4px 10px;
}
.al-cat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px 0;
  justify-items: center;
}
/* 资源库背景为浅色，图标标签改深色 */
.al-cat-grid :deep(.icon-label) {
  color: var(--label);
  text-shadow: none;
}
.al-empty {
  text-align: center;
  color: var(--label-secondary);
  font: var(--text-subhead);
  margin-top: 80px;
}
</style>
