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
  /* 4.5px 外框 + 4px 内黑边，单边 8.5px，两侧合计 17px；屏幕严格等于 token 尺寸 */
  width: calc(var(--screen-w) + 17px);
  height: calc(var(--screen-h) + 17px);
  border-radius: calc(var(--screen-radius) + 8.5px);
  /* 原色/白钛金属拉丝与真实物理环境光映射 */
  background: linear-gradient(
    152deg,
    #f8fafc 0%,
    #e8edf3 10%,
    #d4dae3 22%,
    #bec5cf 38%,
    #a8afbc 52%,
    #c2c8d2 68%,
    #dce1e9 82%,
    #f4f6f9 94%,
    #e2e6ee 100%
  );
  box-shadow:
    /* 外边缘 CNC 抛光微弧倒角切光（外亮内影） */
    inset 0 1px 1.5px 0.5px rgba(255, 255, 255, 0.95),
    inset 1px 0 1.5px 0.5px rgba(255, 255, 255, 0.75),
    inset -1px 0 1.5px 0.5px rgba(150, 158, 170, 0.45),
    inset 0 -1px 1.5px 0.5px rgba(120, 128, 140, 0.55),
    /* 机身外轮廓超细高精度银钛边框线 */
    0 0 0 1px rgba(205, 211, 221, 0.85),
    0 0 0 1.5px rgba(145, 153, 165, 0.35),
    /* 内边缘与黑色面板接缝处的微倒角反光与深色保护胶圈 */
    inset 0 0 0 1px rgba(75, 80, 90, 0.35),
    /* 摄影级多阶平滑工作台悬浮柔和阴影 */
    0 36px 90px -15px rgba(15, 23, 42, 0.35),
    0 18px 40px -10px rgba(15, 23, 42, 0.22),
    0 6px 16px -4px rgba(0, 0, 0, 0.12);
  padding: 4.5px;
}

/* 4 处天线绝缘隔断条 */
.antenna-band {
  position: absolute;
  width: 4.5px;
  height: 2px;
  background: #a3abb9;
  box-shadow: 0 0.5px 1px rgba(0, 0, 0, 0.25);
  z-index: 2;
  pointer-events: none;
  opacity: 0.8;
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
  border-radius: calc(var(--screen-radius) + 4px);
  background: #000000;
  padding: 4px;
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.08),
    0 0 0 0.5px rgba(0, 0, 0, 0.7);
}

/* 顶部超窄微缝听筒 */
.speaker-slit {
  position: absolute;
  top: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 1.8px;
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
  left: -2.5px;
  width: 3.5px;
  border-radius: 2px 0 0 2px;
  background: linear-gradient(90deg, #9ca3af 0%, #e2e6eb 45%, #b4bac4 100%);
  box-shadow:
    inset 0 1px 0.5px rgba(255, 255, 255, 0.85),
    inset 0 -1px 0.5px rgba(100, 105, 115, 0.6),
    -1px 2px 4px rgba(0, 0, 0, 0.28);
}

.action-btn {
  top: 124px;
  height: 26px;
}

.volume-up {
  top: 166px;
  height: 48px;
}

.volume-down {
  top: 226px;
  height: 48px;
}

/* 右侧按键：电源键与相机控制键 */
.power {
  right: -2.5px;
  top: 178px;
  width: 3.5px;
  height: 70px;
  border-radius: 0 2px 2px 0;
  background: linear-gradient(270deg, #9ca3af 0%, #e2e6eb 45%, #b4bac4 100%);
  box-shadow:
    inset 0 1px 0.5px rgba(255, 255, 255, 0.85),
    inset 0 -1px 0.5px rgba(100, 105, 115, 0.6),
    1px 2px 4px rgba(0, 0, 0, 0.28);
}

/* 相机控制键（Camera Control）：蓝宝石轻触感与微凹金属切角 */
.camera-control {
  right: -1.5px;
  top: 540px;
  width: 2.5px;
  height: 50px;
  border-radius: 0 1.5px 1.5px 0;
  background: linear-gradient(270deg, #808692 0%, #c2c8d2 50%, #6c727e 100%);
  box-shadow:
    inset 0 0.5px 0.5px rgba(255, 255, 255, 0.75),
    inset 0 -0.5px 0.5px rgba(0, 0, 0, 0.55),
    0.5px 1px 2.5px rgba(0, 0, 0, 0.22);
}
</style>
