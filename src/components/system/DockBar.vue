<script setup>
import { dockApps } from '../../config/apps'
import AppIcon from '../ui/AppIcon.vue'

/** Dock 栏：毛玻璃底板 + 固定图标（无标签） */
</script>

<template>
  <div class="dock-bar">
    <AppIcon
      v-for="(app, i) in dockApps"
      :key="app.id"
      :app="app"
      :show-label="false"
      :enter-delay="260 + i * 40"
      home-anchor
    />
  </div>
</template>

<style scoped>
.dock-bar {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 28px;
  height: 92px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  border: 0.5px solid rgba(255, 255, 255, 0.28);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 8px;
  z-index: var(--z-dock);
}
</style>
