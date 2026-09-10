<script setup>
import { computed, onMounted, ref } from 'vue'
import { useClock } from '../../../../composables/useClock'
import { useClockStore } from '../../../../stores/clockStore'
import { CLOCK_ICONS } from '../clockIcons'

const emit = defineEmits(['open-subpage'])
const clock = useClockStore()
const { hourDeg, minuteDeg, secondDeg, today, timeShort } = useClock()

// 视频中的底部文字：“9月8日周二 中国标准时间”
const dateDesc = computed(() => {
  const t = today.value
  return `${t.month + 1}月${t.date}日周二 中国标准时间`
})

// 计算世界城市时间与时差
function getCityData(c) {
  const now = new Date()
  let formattedTime = '00:00'
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: c.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    formattedTime = formatter.format(now)
  } catch (e) {
    const utcHours = now.getUTCHours()
    const targetH = (utcHours + c.offset + 24) % 24
    formattedTime = `${String(targetH).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  }

  // 计算时差
  const localOffset = 8 // 默认北京时间 +8
  const diffHours = c.offset - localOffset

  let diffText = '本地时间'
  if (diffHours < 0) {
    diffText = `比本地慢 ${Math.abs(diffHours)} 小时`
  } else if (diffHours > 0) {
    diffText = `比本地快 ${diffHours} 小时`
  }

  return {
    ...c,
    formattedTime,
    diffText
  }
}

const displayCities = computed(() => {
  return clock.worldClocks.filter((c) => !c.isLocal).map(getCityData)
})
</script>

<template>
  <div class="world-clock-tab">
    <!-- 顶部 Header -->
    <header class="tab-header">
      <h1 class="header-title">世界时钟</h1>
      <div class="header-actions">
        <button class="icon-action-btn" title="添加城市">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.plus" fill="#fff" />
          </svg>
        </button>
        <button class="icon-action-btn" title="更多" @click="emit('open-subpage', 'general-settings')">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.moreVert" fill="#fff" />
          </svg>
        </button>
      </div>
    </header>

    <!-- 滚动内容区 -->
    <div class="world-clock-content">
      <!-- 拟物大表盘 -->
      <div class="analog-clock-container">
        <div class="analog-clock-dial">
          <!-- 刻度与数字 -->
          <span
            v-for="num in 12"
            :key="num"
            class="dial-number"
            :style="{
              transform: `rotate(${num * 30}deg) translate(0, -96px) rotate(-${num * 30}deg)`
            }"
          >
            {{ num }}
          </span>

          <!-- 60 细刻度线 -->
          <div
            v-for="tick in 60"
            :key="`t_${tick}`"
            class="dial-tick"
            :class="{ major: tick % 5 === 0 }"
            :style="{ transform: `rotate(${tick * 6}deg)` }"
          ></div>

          <!-- 时针 -->
          <div
            class="clock-hand hand-hour"
            :style="{ transform: `rotate(${hourDeg}deg)` }"
          ></div>

          <!-- 分针 -->
          <div
            class="clock-hand hand-minute"
            :style="{ transform: `rotate(${minuteDeg}deg)` }"
          ></div>

          <!-- 橙色秒针 -->
          <div
            class="clock-hand hand-second"
            :style="{ transform: `rotate(${secondDeg}deg)` }"
          >
            <div class="second-tail"></div>
          </div>

          <!-- 表盘中心同心轴 -->
          <div class="clock-pin"></div>
        </div>

        <!-- 表盘下方当前日期与时区 -->
        <div class="dial-footer-text">{{ dateDesc }}</div>
      </div>

      <!-- 世界各城市时钟卡片列表 -->
      <div class="city-list">
        <div v-for="city in displayCities" :key="city.id" class="city-card">
          <div class="city-left">
            <span class="city-diff">{{ city.diffText }}</span>
            <span class="city-name">{{ city.city }}</span>
          </div>
          <div class="city-time">{{ city.formattedTime }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.world-clock-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000;
  color: #fff;
  overflow: hidden;
}

.tab-header {
  height: 56px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-action-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.world-clock-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 16px 110px;
  display: flex;
  flex-direction: column;
  align-items: center;
  -webkit-mask-image: linear-gradient(
    to bottom,
    black 0%,
    black calc(100% - 92px),
    rgba(0, 0, 0, 0.45) calc(100% - 55px),
    transparent calc(100% - 22px)
  );
  mask-image: linear-gradient(
    to bottom,
    black 0%,
    black calc(100% - 92px),
    rgba(0, 0, 0, 0.45) calc(100% - 55px),
    transparent calc(100% - 22px)
  );
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.world-clock-content::-webkit-scrollbar {
  display: none;
}

/* 拟物表盘 */
.analog-clock-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 12px 0 28px;
}

.analog-clock-dial {
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, #2a2a2c 0%, #151517 80%, #0d0d0e 100%);
  border: 4px solid #333336;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8), inset 0 2px 4px rgba(255, 255, 255, 0.15);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dial-number {
  position: absolute;
  font-size: 17px;
  font-weight: 500;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  user-select: none;
}

.dial-tick {
  position: absolute;
  top: 6px;
  left: calc(50% - 0.5px);
  width: 1px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  transform-origin: 50% 114px;
}

.dial-tick.major {
  width: 2px;
  left: calc(50% - 1px);
  height: 8px;
  background: rgba(255, 255, 255, 0.5);
}

/* 指针 */
.clock-hand {
  position: absolute;
  transform-origin: 50% 100%;
}

.hand-hour {
  width: 6px;
  height: 54px;
  background: #ffffff;
  border-radius: 4px;
  top: calc(50% - 54px);
  left: calc(50% - 3px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  z-index: 2;
}

.hand-minute {
  width: 4px;
  height: 78px;
  background: #ffffff;
  border-radius: 3px;
  top: calc(50% - 78px);
  left: calc(50% - 2px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  z-index: 3;
}

.hand-second {
  width: 2px;
  height: 94px;
  background: #ff9500;
  border-radius: 2px;
  top: calc(50% - 94px);
  left: calc(50% - 1px);
  z-index: 4;
}

.second-tail {
  position: absolute;
  top: 94px;
  left: 0;
  width: 2px;
  height: 20px;
  background: #ff9500;
}

.clock-pin {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff9500;
  border: 2px solid #fff;
  z-index: 5;
}

.dial-footer-text {
  font-size: 14px;
  color: #8e8e93;
  margin-top: 16px;
}

/* 城市列表 */
.city-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.city-card {
  padding: 16px 20px;
  background: #1c1c1e;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.city-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.city-diff {
  font-size: 13px;
  color: #8e8e93;
}

.city-name {
  font-size: 20px;
  font-weight: 500;
  color: #fff;
}

.city-time {
  font-size: 38px;
  font-weight: 300;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  color: #fff;
}
</style>
