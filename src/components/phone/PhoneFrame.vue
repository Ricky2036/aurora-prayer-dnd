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
  /* 5px 钛金属立体弧面外框 + 5px 内侧深邃纯黑边，单边 10px，两侧合计 20px；与参考图 1:1 等宽黄金比例像素级匹配 */
  width: calc(var(--screen-w) + 20px);
  height: calc(var(--screen-h) + 20px);
  border-radius: calc(var(--screen-radius) + 10px);
  /* 钛金属底色与柔和漫反射基底 */
  background: #9ca3af;
  box-shadow:
    /* 外边缘立体轮廓线 */
    0 0 0 0.5px rgba(90, 96, 108, 0.45),
    0 0 0 1px rgba(50, 55, 65, 0.2),
    /* 3D 圆柱形金属弧面（柔和同心漫反射） */
    inset 0 0 0.5px 0.5px #747b88,
    inset 0 0 1px 1.5px #9ca3af,
    inset 0 0 1.5px 2.5px #dce1ea,
    inset 0 0 1px 3.2px #eef2f7,
    inset 0 0 1.5px 4.2px #6b7280,
    inset 0 0 0.5px 5px #14161a,
    /* 顶部与左侧微妙环境光入射 */
    inset 0 1px 1px rgba(255, 255, 255, 0.6),
    inset 1px 0 1px rgba(255, 255, 255, 0.4),
    /* 底部与右侧环境光吸收 */
    inset 0 -1px 1px rgba(0, 0, 0, 0.25),
    /* 摄影级多层自然投影 */
    0 32px 80px -15px rgba(15, 23, 42, 0.42),
    0 14px 32px -8px rgba(15, 23, 42, 0.26),
    0 4px 12px -2px rgba(0, 0, 0, 0.16);
  padding: 5px;
}

/* 4 处天线绝缘隔断条 */
.antenna-band {
  position: absolute;
  width: 5px;
  height: 2px;
  background: #828896;
  box-shadow: 0 0.5px 0.5px rgba(0, 0, 0, 0.3);
  z-index: 2;
  pointer-events: none;
  opacity: 0.9;
}
.antenna-tl { left: 0; top: 100px; }
.antenna-tr { right: 0; top: 100px; }
.antenna-bl { left: 0; bottom: 100px; }
.antenna-br { right: 0; bottom: 100px; }

/* 屏幕超窄等宽纯黑边框（BM区 + 保护圈） */
.frame-inner {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: calc(var(--screen-radius) + 5px);
  background: #000000;
  padding: 5px;
  box-shadow:
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.05),
    0 0 0 0.5px rgba(0, 0, 0, 0.9);
}

/* 顶部超窄微缝听筒 */
.speaker-slit {
  position: absolute;
  top: 1.2px;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 1.6px;
  border-radius: 1px;
  background: #0d0d10;
  box-shadow:
    inset 0 0.5px 0.5px rgba(0, 0, 0, 0.95),
    0 0.5px 0.5px rgba(255, 255, 255, 0.08);
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
  width: 3px;
  border-radius: 2px 0 0 2px;
  background: linear-gradient(90deg, #949ba7 0%, #e2e6eb 50%, #afb5bf 100%);
  box-shadow:
    inset 0 0.5px 0.5px rgba(255, 255, 255, 0.85),
    inset 0 -0.5px 0.5px rgba(80, 85, 95, 0.6),
    -1px 1.5px 3px rgba(0, 0, 0, 0.35);
}

.action-btn {
  top: 124px;
  height: 28px;
}

.volume-up {
  top: 168px;
  height: 52px;
}

.volume-down {
  top: 230px;
  height: 52px;
}

/* 右侧按键：电源键与相机控制键 */
.power {
  right: -2.5px;
  top: 180px;
  width: 3px;
  height: 72px;
  border-radius: 0 2px 2px 0;
  background: linear-gradient(270deg, #949ba7 0%, #e2e6eb 50%, #afb5bf 100%);
  box-shadow:
    inset 0 0.5px 0.5px rgba(255, 255, 255, 0.85),
    inset 0 -0.5px 0.5px rgba(80, 85, 95, 0.6),
    1px 1.5px 3px rgba(0, 0, 0, 0.35);
}

/* 相机控制键（Camera Control）：蓝宝石轻触感与微凹金属切角 */
.camera-control {
  right: -1.5px;
  top: 540px;
  width: 2px;
  height: 52px;
  border-radius: 0 1px 1px 0;
  background: linear-gradient(270deg, #747a86 0%, #b2b8c2 50%, #606672 100%);
  box-shadow:
    inset 0 0.5px 0.5px rgba(255, 255, 255, 0.7),
    inset 0 -0.5px 0.5px rgba(0, 0, 0, 0.5),
    0.5px 1px 2px rgba(0, 0, 0, 0.25);
}
</style>
