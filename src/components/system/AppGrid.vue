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
  /* 纵向间距总预算：4 行图标 + 搜索胶囊（屏底 136px 处，顶边 626）必须互不重叠。
     原来是 26(下边距) + 26(行距)，最后一行底边落在 638，压住胶囊 12px。
     收 4 + 6 后最后一行底边 616，与胶囊留 10px 空隙。
     只改布局间距，不动 AppIcon / Hero 的 transform 动画，入场与开合动效不受影响。 */
  margin-bottom: 22px;
  width: 100%;
  box-sizing: border-box;
}
.icon-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: var(--grid-gap-x, 24px);
  row-gap: 20px;
  justify-items: center;
  width: 100%;
  box-sizing: border-box;
}
</style>
