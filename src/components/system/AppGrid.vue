<script setup>
import { gridApps } from '../../config/apps'
import AppIcon from '../ui/AppIcon.vue'
import ClockWidget from '../widgets/ClockWidget.vue'
import SmartSuggestionWidget from '../widgets/SmartSuggestionWidget.vue'

/**
 * 桌面单页网格：2×2 Widget 行 + 图标行。
 * 4 列 × 60px，列间距 35px（iOS 规格）。
 */
</script>

<template>
  <div class="app-grid">
    <div class="widget-row">
      <ClockWidget />
      <SmartSuggestionWidget />
    </div>
    <div class="icon-grid">
      <AppIcon
        v-for="(app, i) in gridApps"
        :key="app.id"
        :app="app"
        :enter-delay="120 + i * 40"
        home-anchor
      />
    </div>
  </div>
</template>

<style scoped>
.app-grid {
  padding: calc(var(--safe-top, 54px) + 12px) 24px 0;
  width: 100%;
  box-sizing: border-box;
}
.widget-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--grid-gap-x, 24px);
  margin-bottom: 26px;
  width: 100%;
  box-sizing: border-box;
}
.icon-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: var(--grid-gap-x, 24px);
  row-gap: 26px;
  justify-items: center;
  width: 100%;
  box-sizing: border-box;
}
</style>
