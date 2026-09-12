<script setup>
/**
 * 旗舰原色/白钛金属机身外框（Natural / Silver Titanium）：
 * - 像素级白钛金属拉丝外框、CNC 微弧双倒角高光与细腻金属质感
 * - 4 处微细注塑天线隔断条（Antenna Bands）
 * - 5 颗金属侧键：左侧动作键（Action Button）、音量+、音量-；右侧侧边电源键、相机控制键（Camera Control）
 * - 4px 超窄等宽黑边（BM 区）+ 50px 大圆角精准同心几何
 * - 顶部微缝听筒孔（Speaker Slit）
 * - 居中打孔摄像头（保持 .punch-hole 节点兼容避让测试）
 * 屏幕内容通过默认 slot 注入 ScreenView。
 */
</script>

<template>
  <div class="phone-frame">
    <!-- 4 处天线绝缘隔断条 -->
    <div class="antenna-band antenna-tl"></div>
    <div class="antenna-band antenna-tr"></div>
    <div class="antenna-band antenna-bl"></div>
    <div class="antenna-band antenna-br"></div>

    <!-- 左侧按键：动作键、音量+、音量- -->
    <div class="side-btn action-btn"></div>
    <div class="side-btn volume-up"></div>
    <div class="side-btn volume-down"></div>

    <!-- 右侧按键：侧边电源键、相机控制键 -->
    <div class="side-btn power"></div>
    <div class="side-btn camera-control"></div>

    <div class="frame-inner">
      <!-- 顶部超窄微缝听筒孔 -->
      <div class="speaker-slit"></div>

      <div class="screen">
        <!-- 居中打孔摄像头 -->
        <div class="punch-hole"></div>
        <!-- 屏幕表面超细微玻璃微光 -->
        <div class="glass-sheen"></div>
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.phone-frame {
  position: relative;
  /* 2px 极细钛金属微倒角外框 + 3px 内黑边，单边 5px，两侧合计 10px；屏幕严格等于 token 尺寸 */
  width: calc(var(--screen-w) + 10px);
  height: calc(var(--screen-h) + 10px);
  border-radius: calc(var(--screen-radius) + 5px);
  /* 真实钛金属微细前倒角：精细银钛拉丝与微切角 */
  background: linear-gradient(
    150deg,
    #f1f3f6 0%,
    #dbe0e8 25%,
    #b0b6c2 50%,
    #959ba7 68%,
    #bcc2cc 85%,
    #e4e8ef 100%
  );
  box-shadow:
    /* 外边缘 0.5px 精密高光倒角（CNC Chamfer Specular Highlight） */
    inset 0 0.5px 0.5px rgba(255, 255, 255, 0.95),
    inset 0.5px 0 0.5px rgba(255, 255, 255, 0.8),
    inset -0.5px 0 0.5px rgba(130, 138, 150, 0.5),
    inset 0 -0.5px 0.5px rgba(100, 108, 120, 0.6),
    /* 侧边极细银钛边框线 */
    0 0 0 0.5px rgba(160, 168, 180, 0.6),
    /* 屏幕黑边内侧深色缓冲胶圈 */
    inset 0 0 0 0.5px rgba(15, 15, 18, 0.85),
    /* 摄影级柔和工作台自然投影 */
    0 28px 70px -12px rgba(15, 23, 42, 0.36),
    0 12px 28px -8px rgba(15, 23, 42, 0.22),
    0 4px 10px -2px rgba(0, 0, 0, 0.12);
  padding: 2px;
}

/* 4 处天线绝缘隔断条 */
.antenna-band {
  position: absolute;
  width: 2px;
  height: 1.5px;
  background: #8b92a0;
  box-shadow: 0 0.5px 0.5px rgba(0, 0, 0, 0.3);
  z-index: 2;
  pointer-events: none;
  opacity: 0.85;
}
.antenna-tl { left: 0; top: 96px; }
.antenna-tr { right: 0; top: 96px; }
.antenna-bl { left: 0; bottom: 96px; }
.antenna-br { right: 0; bottom: 96px; }

/* 屏幕超窄等宽纯黑边框（BM区 + 保护圈） */
.frame-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: calc(var(--screen-radius) + 3px);
  background: #000000;
  padding: 3px;
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.06),
    0 0 0 0.5px rgba(0, 0, 0, 0.8);
}

/* 顶部超窄微缝听筒 */
.speaker-slit {
  position: absolute;
  top: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 44px;
  height: 1.4px;
  border-radius: 1px;
  background: #111114;
  box-shadow:
    inset 0 0.5px 0.5px rgba(0, 0, 0, 0.95),
    0 0.5px 0.5px rgba(255, 255, 255, 0.06);
  z-index: 10;
  pointer-events: none;
}

.screen {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--screen-radius);
  overflow: hidden;
  background: #000000;
  /* 屏幕内容锚点：hero 动画/坐标换算以此为基准 */
  container-type: size;
}

/* 屏幕玻璃超浅微光 */
.glass-sheen {
  position: absolute;
  inset: 0;
  border-radius: var(--screen-radius);
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.035) 0%,
    rgba(255, 255, 255, 0.01) 22%,
    transparent 45%
  );
  pointer-events: none;
  z-index: 95;
}

/* 居中打孔摄像头（保留类名与居中锚点兼容状态栏避让检测） */
.punch-hole {
  position: absolute;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: radial-gradient(circle at 36% 36%, #1e2433 0%, #0e1118 45%, #050608 80%);
  box-shadow:
    inset 0 0 2px 1px rgba(0, 0, 0, 0.9),
    0 0 0 1px rgba(35, 40, 50, 0.6),
    inset 1px 1px 1.5px rgba(70, 110, 180, 0.35);
  z-index: 96;
  pointer-events: none;
}

/* ================= 侧边高质感钛金属按键 ================= */
.side-btn {
  position: absolute;
  pointer-events: none;
}

/* 左侧按键：动作键、音量+、音量- */
.action-btn,
.volume-up,
.volume-down {
  left: -1.5px;
  width: 2.5px;
  border-radius: 1.5px 0 0 1.5px;
  background: linear-gradient(90deg, #9ca3af 0%, #e2e6eb 50%, #b4bac4 100%);
  box-shadow:
    inset 0 0.5px 0.5px rgba(255, 255, 255, 0.85),
    inset 0 -0.5px 0.5px rgba(100, 105, 115, 0.6),
    -1px 1.5px 3px rgba(0, 0, 0, 0.3);
}

.action-btn {
  top: 124px;
  height: 24px;
}

.volume-up {
  top: 164px;
  height: 46px;
}

.volume-down {
  top: 222px;
  height: 46px;
}

/* 右侧按键：电源键与相机控制键 */
.power {
  right: -1.5px;
  top: 176px;
  width: 2.5px;
  height: 64px;
  border-radius: 0 1.5px 1.5px 0;
  background: linear-gradient(270deg, #9ca3af 0%, #e2e6eb 50%, #b4bac4 100%);
  box-shadow:
    inset 0 0.5px 0.5px rgba(255, 255, 255, 0.85),
    inset 0 -0.5px 0.5px rgba(100, 105, 115, 0.6),
    1px 1.5px 3px rgba(0, 0, 0, 0.3);
}

/* 相机控制键（Camera Control）：蓝宝石轻触感与微凹金属切角 */
.camera-control {
  right: -1px;
  top: 540px;
  width: 2px;
  height: 46px;
  border-radius: 0 1px 1px 0;
  background: linear-gradient(270deg, #7c828e 0%, #b6bcc6 50%, #686e7a 100%);
  box-shadow:
    inset 0 0.5px 0.5px rgba(255, 255, 255, 0.7),
    inset 0 -0.5px 0.5px rgba(0, 0, 0, 0.5),
    0.5px 1px 2px rgba(0, 0, 0, 0.2);
}
</style>
