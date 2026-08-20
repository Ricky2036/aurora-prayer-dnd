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
  padding: 66px 24px 0;
}
.widget-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30px;
}
.icon-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  row-gap: 28px;
  justify-items: center;
}
</style>
