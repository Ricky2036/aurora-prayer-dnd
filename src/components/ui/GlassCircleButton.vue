<script setup>
/**
 * 毛玻璃圆形按钮 —— 通知中心「清空通知」与最近任务「清空后台」共用的同一样式。
 *
 * 视觉来源：NotificationCenter 原本的 .nc-clear-fab（Ricky 2026-09-12 要求
 * 最近任务的删除按钮「改为与通知中心相同的按钮样式」→ 抽成共享组件，两处同一份实现）。
 *
 * 只负责「圆形磨砂按钮本体」，不负责定位 —— 摆放交给父级（position / flex 均可），
 * 这样按钮内部可以安全地使用 scale 做按压反馈，不用为了居中去写 translateX。
 */
defineProps({
  label: { type: String, default: '' }
})
</script>

<template>
  <button class="glass-circle-btn" type="button" :title="label || undefined" :aria-label="label || undefined">
    <slot />
  </button>
</template>

<style scoped>
.glass-circle-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  padding: 0;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}
.glass-circle-btn:hover {
  background: rgba(255, 59, 48, 0.5);
}
.glass-circle-btn:active {
  transform: scale(0.88);
}
</style>
