<script setup>
/** 应用内导航栏：返回箭头 + 当前菜单名称左对齐（不显示上一级菜单名称） */
const props = defineProps({
  title: { type: String, default: '' },
  backLabel: { type: String, default: '' },
  showBack: { type: Boolean, default: true }
})
const emit = defineEmits(['back'])
</script>

<template>
  <div class="app-nav-bar">
    <button v-if="showBack" class="anb-back-btn" @click="emit('back')">
      <!-- 极简返回箭头（不显示上级文字，参考图 1/图 2 样式） -->
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M20 12H4M4 12L11 5M4 12L11 19" stroke="#1C1C1E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <!-- 当前菜单名称，左对齐 -->
    <div class="anb-title">{{ title }}</div>
    <div class="anb-right"><slot name="right"></slot></div>
  </div>
</template>

<style scoped>
.app-nav-bar {
  position: relative;
  height: calc(var(--safe-top) + 48px);
  padding: var(--safe-top) 8px 0 12px;
  display: flex;
  align-items: center;
  background: rgba(248, 248, 250, 0.92);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.1);
  flex: none;
  z-index: 5;
  gap: 8px;
}

.anb-back-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
  transition: background 0.15s ease;
}

.anb-back-btn:active {
  background: rgba(0, 0, 0, 0.06);
}

.anb-title {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;
  font-size: 19px;
  font-weight: 600;
  color: #1C1C1E;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
  flex: 1;
}

.anb-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  color: #007AFF;
  font-size: 15px;
  padding-right: 8px;
}
</style>
