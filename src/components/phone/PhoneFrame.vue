<script setup>
/**
 * 安卓打孔屏机身外壳：深色金属边框、电源/音量键、居中打孔摄像头。
 * 屏幕内容通过默认 slot 注入 ScreenView。
 */
</script>

<template>
  <div class="phone-frame">
    <!-- 左侧音量键 -->
    <div class="side-btn volume-up"></div>
    <div class="side-btn volume-down"></div>
    <!-- 右侧电源键 -->
    <div class="side-btn power"></div>

    <div class="frame-inner">
      <div class="screen">
        <!-- 居中打孔摄像头 -->
        <div class="punch-hole"></div>
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.phone-frame {
  position: relative;
  /* 9px 外框 + 2px 内框，两侧合计 22px；屏幕内容区严格等于 token 尺寸。 */
  width: calc(var(--screen-w) + 22px);
  height: calc(var(--screen-h) + 22px);
  border-radius: calc(var(--screen-radius) + 9px);
  background: linear-gradient(145deg, #4a4a52 0%, #2b2b31 30%, #1a1a1f 55%, #33333a 100%);
  box-shadow:
    inset 0 0 0 1.5px rgba(255, 255, 255, 0.12),
    inset 0 0 4px rgba(0, 0, 0, 0.6),
    0 30px 80px rgba(20, 20, 35, 0.45),
    0 8px 24px rgba(20, 20, 35, 0.25);
  padding: 9px;
}

.frame-inner {
  width: 100%;
  height: 100%;
  border-radius: calc(var(--screen-radius) + 2px);
  background: #000;
  padding: 2px;
}

.screen {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--screen-radius);
  overflow: hidden;
  background: #000;
  /* 屏幕内容锚点：hero 动画/坐标换算以此为基准 */
  container-type: size;
}

/* 居中打孔摄像头：加大并下移（中心 y = 15 + 7.5 = 22.5，与状态栏图标行中心对齐） */
.punch-hole {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #2a2a30 0%, #0a0a0c 70%);
  box-shadow:
    inset 0 0 2px rgba(0, 0, 0, 0.9),
    0 0 0 1.5px rgba(60, 60, 70, 0.35),
    inset 1px 1px 1px rgba(120, 140, 180, 0.25);
  z-index: 96;
  pointer-events: none;
}

/* 侧键 */
.side-btn {
  position: absolute;
  width: 3.5px;
  border-radius: 2px;
  background: linear-gradient(90deg, #3a3a42, #55555e 50%, #2a2a31);
}
.volume-up { left: -2px; top: 190px; height: 56px; }
.volume-down { left: -2px; top: 258px; height: 56px; }
.power { right: -2px; top: 220px; height: 88px; }
</style>
