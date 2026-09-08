<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useClock } from '../../../../composables/useClock'
import { usePrayerStore } from '../../../../stores/prayerStore'
import { CLOCK_ICONS } from '../clockIcons'

const emit = defineEmits(['open-subpage'])
const prayer = usePrayerStore()
const { timeShort, today } = useClock()

// 当前选中的礼拜卡片（默认当前活动的晌礼或当前礼拜）
const selectedPrayerId = ref('dhuhr')

// 6 个礼拜及日出时间节点（与参考视频 Clock.mp4 保持一致）
const PRAYER_SLOTS = [
  { id: 'fajr', name: '晨礼', time: '04:53', hasSpeaker: true, angle: 0 },
  { id: 'sunrise', name: '日出', time: '06:08', hasSpeaker: false, angle: 60 },
  { id: 'dhuhr', name: '晌礼', time: '12:22', hasSpeaker: true, angle: 120 },
  { id: 'asr', name: '晡礼', time: '15:48', hasSpeaker: true, angle: 180 },
  { id: 'maghrib', name: '昏礼', time: '18:35', hasSpeaker: true, angle: 240 },
  { id: 'isha', name: '宵礼', time: '19:47', hasSpeaker: true, angle: 300 }
]

// 喇叭静音状态映射
const speakerMuted = ref({
  fajr: false,
  dhuhr: false,
  asr: false,
  maghrib: false,
  isha: false
})

function toggleSpeaker(id, event) {
  event?.stopPropagation()
  speakerMuted.value[id] = !speakerMuted.value[id]
}

// 模拟回历日期
const hijriMonth = '回历3月'
const hijriDate = '25'
const gregorianMonth = '九月'
const gregorianDate = computed(() => today.value.date || '8')
const weekDayStr = '星期二'
const locationCity = '深圳市'
</script>

<template>
  <div class="muslim-tab">
    <!-- 顶部标题与更多 -->
    <header class="tab-header">
      <h1 class="header-title">穆斯林</h1>
      <button class="icon-action-btn" @click="emit('open-subpage', 'muslim-alarm')">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.moreVert" fill="#fff" />
        </svg>
      </button>
    </header>

    <!-- 日期与定位行 -->
    <div class="date-location-bar">
      <!-- 左侧：公历日与月 -->
      <div class="date-col left">
        <span class="date-number">{{ gregorianDate }}</span>
        <span class="date-label">{{ gregorianMonth }}</span>
      </div>

      <!-- 中间：星期与定位 -->
      <div class="date-col center">
        <span class="weekday-text">{{ weekDayStr }}</span>
        <div class="location-row">
          <svg width="12" height="12" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.location" fill="#8e8e93" />
          </svg>
          <span class="location-text">{{ locationCity }}</span>
        </div>
      </div>

      <!-- 右侧：回历日与月 -->
      <div class="date-col right">
        <span class="date-number">{{ hijriDate }}</span>
        <span class="date-label">{{ hijriMonth }}</span>
      </div>
    </div>

    <!-- 中心朝拜花瓣轮盘与罗盘 -->
    <div class="compass-wheel-container">
      <!-- 八角背景与叶脉装饰 -->
      <div class="compass-bg-ring"></div>

      <!-- 花瓣卡片环绕分布 -->
      <div class="petals-container">
        <!-- 1. 晨礼 (顶部 0度) -->
        <div
          class="petal-card petal-top"
          :class="{ active: selectedPrayerId === 'fajr' }"
          @click="selectedPrayerId = 'fajr'"
        >
          <div class="petal-speaker" @click="toggleSpeaker('fajr', $event)">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path :d="CLOCK_ICONS.speaker" :fill="speakerMuted.fajr ? '#666' : '#fff'" />
            </svg>
          </div>
          <span class="petal-name">晨礼</span>
          <span class="petal-time">04:53</span>
        </div>

        <!-- 2. 日出 (东北 60度) -->
        <div
          class="petal-card petal-ne"
          :class="{ active: selectedPrayerId === 'sunrise' }"
          @click="selectedPrayerId = 'sunrise'"
        >
          <span class="petal-name">日出</span>
          <span class="petal-time">06:08</span>
        </div>

        <!-- 3. 晌礼 (东南 120度 - 视频当前高亮橙色) -->
        <div
          class="petal-card petal-se highlight"
          :class="{ active: selectedPrayerId === 'dhuhr' }"
          @click="selectedPrayerId = 'dhuhr'"
        >
          <div class="petal-speaker" @click="toggleSpeaker('dhuhr', $event)">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path :d="CLOCK_ICONS.speaker" fill="#fff" />
            </svg>
          </div>
          <span class="petal-name">晌礼</span>
          <span class="petal-time">12:22</span>
        </div>

        <!-- 4. 晡礼 (南 180度) -->
        <div
          class="petal-card petal-bottom"
          :class="{ active: selectedPrayerId === 'asr' }"
          @click="selectedPrayerId = 'asr'"
        >
          <span class="petal-name">晡礼</span>
          <span class="petal-time">15:48</span>
          <div class="petal-speaker bottom" @click="toggleSpeaker('asr', $event)">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path :d="CLOCK_ICONS.speaker" :fill="speakerMuted.asr ? '#666' : '#8e8e93'" />
            </svg>
          </div>
        </div>

        <!-- 5. 昏礼 (西南 240度) -->
        <div
          class="petal-card petal-sw"
          :class="{ active: selectedPrayerId === 'maghrib' }"
          @click="selectedPrayerId = 'maghrib'"
        >
          <span class="petal-name">昏礼</span>
          <span class="petal-time">18:35</span>
          <div class="petal-speaker bottom" @click="toggleSpeaker('maghrib', $event)">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path :d="CLOCK_ICONS.speaker" :fill="speakerMuted.maghrib ? '#666' : '#8e8e93'" />
            </svg>
          </div>
        </div>

        <!-- 6. 宵礼 (西北 300度) -->
        <div
          class="petal-card petal-nw"
          :class="{ active: selectedPrayerId === 'isha' }"
          @click="selectedPrayerId = 'isha'"
        >
          <div class="petal-speaker" @click="toggleSpeaker('isha', $event)">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path :d="CLOCK_ICONS.speaker" :fill="speakerMuted.isha ? '#666' : '#8e8e93'" />
            </svg>
          </div>
          <span class="petal-name">宵礼</span>
          <span class="petal-time">19:47</span>
        </div>
      </div>

      <!-- 中心十字罗盘与实时时间 -->
      <div class="center-compass-dial">
        <div class="compass-axes">
          <span class="axis-point point-n">N</span>
          <span class="axis-point point-e">E</span>
          <span class="axis-point point-s">S</span>
          <span class="axis-point point-w">W</span>
        </div>
        <div class="center-time-text">{{ timeShort || '11:49' }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.muslim-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000;
  color: #fff;
  overflow: hidden;
  position: relative;
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

/* 顶部三栏日期信息 */
.date-location-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 28px 24px;
}

.date-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.date-number {
  font-size: 22px;
  font-weight: 500;
  color: #fff;
}

.date-label {
  font-size: 13px;
  color: #8e8e93;
}

.weekday-text {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.location-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.location-text {
  font-size: 12px;
  color: #8e8e93;
}

/* 中心罗盘与花瓣容器 */
.compass-wheel-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 70px;
}

.compass-bg-ring {
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  pointer-events: none;
}

/* 花瓣卡片整体排布 */
.petals-container {
  position: absolute;
  width: 330px;
  height: 330px;
  pointer-events: auto;
}

.petal-card {
  position: absolute;
  width: 90px;
  height: 72px;
  background: rgba(36, 36, 38, 0.85);
  backdrop-filter: blur(12px);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  border: 0.5px solid rgba(255, 255, 255, 0.06);
}

.petal-card:active {
  transform: scale(0.96);
}

/* 视频中的高亮响铃卡片 (晌礼 12:22) */
.petal-card.highlight {
  background: linear-gradient(135deg, #ff9f0a 0%, #f37d00 100%);
  box-shadow: 0 6px 24px rgba(255, 159, 10, 0.4);
  border-color: rgba(255, 255, 255, 0.2);
}

.petal-card.highlight .petal-name,
.petal-card.highlight .petal-time {
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.petal-name {
  font-size: 13px;
  font-weight: 500;
  color: #c7c7cc;
  margin-bottom: 2px;
}

.petal-time {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
}

.petal-speaker {
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.petal-speaker.bottom {
  margin-top: 2px;
  margin-bottom: 0;
}

/* 六大方位坐标绝对定位 */
.petal-top {
  top: 0px;
  left: 120px;
}

.petal-ne {
  top: 45px;
  right: 10px;
}

.petal-se {
  bottom: 45px;
  right: 10px;
}

.petal-bottom {
  bottom: 0px;
  left: 120px;
}

.petal-sw {
  bottom: 45px;
  left: 10px;
}

.petal-nw {
  top: 45px;
  left: 10px;
}

/* 中心时钟与十字罗盘 */
.center-compass-dial {
  width: 140px;
  height: 140px;
  background: radial-gradient(circle, #1a1a1c 0%, #111112 100%);
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7), inset 0 1px 2px rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 5;
}

.compass-axes {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.axis-point {
  position: absolute;
  font-size: 11px;
  font-weight: 700;
  color: #636366;
}

.point-n {
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  color: #8e8e93;
}

.point-s {
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
}

.point-w {
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
}

.point-e {
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
}

.center-time-text {
  font-size: 26px;
  font-weight: 600;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  letter-spacing: -0.5px;
}
</style>
