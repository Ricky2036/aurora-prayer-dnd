<script setup>
/**
 * 高级材质模糊组件
 * 提供对底层（通常是桌面壁纸与图标）的动态高斯模糊效果，
 * 并支持使用多重混合模式 (mix-blend-mode) 进行色彩调和，
 * 防止高光溢出并保证上层文字的可读性。
 */
</script>

<template>
  <div class="material-blur">
    <!-- 混合层1：增加底层亮度与对比度 -->
    <div class="mb-overlay"></div>
    <!-- 混合层2：调整色调/压暗 -->
    <div class="mb-color-burn"></div>
    <!-- 混合层3：基础底色，确保文字可读性 -->
    <div class="mb-base"></div>
  </div>
</template>

<style scoped>
.material-blur {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  /* 基础的高斯模糊与高饱和提色 */
  backdrop-filter: blur(60px) saturate(250%);
  -webkit-backdrop-filter: blur(60px) saturate(250%);
  background: rgba(15, 15, 20, 0.15); /* 默认带一点深灰色底 */
}

.material-blur > div {
  position: absolute;
  inset: 0;
}

/* Overlay 混合模式：提亮暗部，增加环境颜色的对比层次感 */
.mb-overlay {
  mix-blend-mode: overlay;
  background: rgba(255, 255, 255, 0.08);
}

/* Color Burn 混合模式：色调加深，压住由于高饱和度带来的高光刺眼问题 */
.mb-color-burn {
  mix-blend-mode: color-burn;
  background: rgba(10, 10, 20, 0.05);
}

.mb-base {
  /* 最后一层纯色蒙版，确保极端亮色壁纸下的深色模式 UI 依然清晰 */
  background: rgba(0, 0, 0, 0.1);
}

/* 兼容性降级 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .material-blur {
    background: rgba(20, 20, 25, 0.95);
  }
}
</style>
