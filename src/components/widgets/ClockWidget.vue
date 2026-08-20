<script setup>
import { useClock } from '../../composables/useClock'

/** 时钟 Widget（2×2）：白底实时指针表盘，表盘放大居中显示 */
const { hourDeg, minuteDeg, secondDeg } = useClock()
</script>

<template>
  <div class="widget clock-widget">
    <svg class="cw-face" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="57" fill="#fff" />
      <!-- 刻度 -->
      <g>
        <line v-for="i in 60" :key="i"
          x1="60" y1="6" :x2="60" :y2="(i - 1) % 5 === 0 ? 12 : 9"
          :stroke="(i - 1) % 5 === 0 ? '#1c1c1e' : '#c7c7cc'"
          :stroke-width="(i - 1) % 5 === 0 ? 2 : 1"
          :transform="`rotate(${(i - 1) * 6} 60 60)`" />
      </g>
      <!-- 数字 12/3/6/9 -->
      <text x="60" y="26" text-anchor="middle" class="cw-num">12</text>
      <text x="98" y="65" text-anchor="middle" class="cw-num">3</text>
      <text x="60" y="106" text-anchor="middle" class="cw-num">6</text>
      <text x="22" y="65" text-anchor="middle" class="cw-num">9</text>
      <!-- 指针 -->
      <line x1="60" y1="60" x2="60" y2="34" stroke="#1c1c1e" stroke-width="5" stroke-linecap="round"
        :transform="`rotate(${hourDeg} 60 60)`" />
      <line x1="60" y1="60" x2="60" y2="20" stroke="#1c1c1e" stroke-width="3.2" stroke-linecap="round"
        :transform="`rotate(${minuteDeg} 60 60)`" />
      <line x1="60" y1="66" x2="60" y2="18" stroke="#FF9500" stroke-width="1.6" stroke-linecap="round"
        :transform="`rotate(${secondDeg} 60 60)`" />
      <circle cx="60" cy="60" r="3" fill="#1c1c1e" />
      <circle cx="60" cy="60" r="1.2" fill="#FF9500" />
    </svg>
  </div>
</template>

<style scoped>
.widget {
  width: 155px;
  height: 155px;
  border-radius: var(--radius-widget);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  overflow: hidden;
}
.just-unlocked .widget {
  animation: icon-enter 0.5s cubic-bezier(0.25, 0.9, 0.3, 1.2) backwards;
}
@keyframes icon-enter {
  from { opacity: 0; transform: scale(1.25); }
  to { opacity: 1; transform: scale(1); }
}
.clock-widget {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
}
/* 表盘放大至容器可用空间（155 - 2×10 内边距），居中显示 */
.cw-face { width: 135px; height: 135px; }
.cw-num {
  font: 600 12px var(--font-stack);
  fill: #1c1c1e;
}
</style>
