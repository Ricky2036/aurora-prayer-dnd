<script setup>
import { computed, ref } from 'vue'
import { useClock } from '../../../../composables/useClock'
import { usePrayerStore } from '../../../../stores/prayerStore'
import { CLOCK_ICONS } from '../clockIcons'

const emit = defineEmits(['open-subpage'])
const prayer = usePrayerStore()
const { timeShort, today } = useClock()

// 当前选中的礼拜卡片（默认当前激活的高亮项：晌礼 dhuhr）
const selectedPrayerId = ref('dhuhr')

// 6 个礼拜及日出时间节点（与截图 media_1789005381903.jpg 100% 对齐）
const PRAYER_SLOTS = [
  { id: 'fajr', name: '晨礼', time: '04:54', speakerPos: 'top', muted: false },
  { id: 'sunrise', name: '日出', time: '06:07', speakerPos: 'bottom', muted: true },
  { id: 'dhuhr', name: '晌礼', time: '12:21', speakerPos: 'top', muted: false },
  { id: 'asr', name: '哺礼', time: '15:48', speakerPos: 'bottom', muted: false },
  { id: 'maghrib', name: '昏礼', time: '18:34', speakerPos: 'top', muted: false },
  { id: 'isha', name: '宵礼', time: '19:45', speakerPos: 'bottom', muted: false }
]

// 喇叭静音状态映射
const speakerMuted = ref({
  fajr: false,
  sunrise: true,
  dhuhr: false,
  asr: false,
  maghrib: false,
  isha: false
})

function toggleSpeaker(id, event) {
  event?.stopPropagation()
  speakerMuted.value[id] = !speakerMuted.value[id]
}

function selectPrayer(id) {
  selectedPrayerId.value = id
  if (id !== 'sunrise') {
    prayer.setSimulatedPrayer(id)
  }
}

// 模拟截图日期（9月10日星期四，回历27日回历3月，深圳市）
const gregorianDate = '10'
const gregorianMonth = '九月'
const weekDayStr = '星期四'
const locationCity = '深圳市'
const hijriDate = '27'
const hijriMonth = '回历 3 月'
</script>

<template>
  <div class="muslim-tab">
    <!-- 顶部 Header -->
    <header class="tab-header">
      <h1 class="header-title">穆斯林</h1>
      <button class="header-more-btn" title="更多设置" @click="emit('open-subpage', 'muslim-alarm')">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path :d="CLOCK_ICONS.moreVert" fill="#FFFFFF" />
        </svg>
      </button>
    </header>

    <!-- 顶部三栏日期定位信息 -->
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
            <path :d="CLOCK_ICONS.location" fill="#8E8E93" />
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

    <!-- 中心朝拜花瓣轮盘与罗盘整体容器 -->
    <div class="compass-wheel-container">
      <!-- 底层伊斯兰经典蔓藤花纹曼陀罗装饰 (Arabesque mandala) -->
      <div class="filigree-mandala-bg" aria-hidden="true">
        <svg class="mandala-svg" width="370" height="370" viewBox="0 0 370 370" fill="none">
          <circle cx="185" cy="185" r="172" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1.5" stroke-dasharray="3 3"/>
          <circle cx="185" cy="185" r="150" stroke="rgba(255, 255, 255, 0.06)" stroke-width="1"/>
          <!-- 12 瓣花叶蔓藤花纹 -->
          <g stroke="rgba(255, 255, 255, 0.08)" stroke-width="1.2" fill="none">
            <path d="M185 35 C175 65 155 85 185 115 C215 85 195 65 185 35 Z" />
            <path d="M185 335 C175 305 155 285 185 255 C215 285 195 305 185 335 Z" />
            <path d="M35 185 C65 175 85 155 115 185 C85 215 65 195 35 185 Z" />
            <path d="M335 185 C305 175 285 155 255 185 C285 215 305 195 335 185 Z" />
            <path d="M79 79 C105 95 115 115 135 135 C115 155 95 105 79 79 Z" />
            <path d="M291 79 C265 95 255 115 235 135 C255 155 275 105 291 79 Z" />
            <path d="M79 291 C105 275 115 255 135 235 C115 215 95 265 79 291 Z" />
            <path d="M291 291 C265 275 255 255 235 235 C255 215 275 265 291 291 Z" />
          </g>
          <!-- 蔓藤镂空精雕纹理 -->
          <g stroke="rgba(255, 255, 255, 0.05)" stroke-width="0.8" fill="none">
            <circle cx="185" cy="50" r="14"/>
            <circle cx="185" cy="320" r="14"/>
            <circle cx="50" cy="185" r="14"/>
            <circle cx="320" cy="185" r="14"/>
            <circle cx="90" cy="90" r="12"/>
            <circle cx="280" cy="90" r="12"/>
            <circle cx="90" cy="280" r="12"/>
            <circle cx="280" cy="280" r="12"/>
          </g>
        </svg>
      </div>

      <!-- 6 朵礼拜花瓣 -->
      <div class="petals-orbit">
        <!-- 1. 晨礼 04:54 (正顶 0°) -->
        <div
          class="petal-wrapper petal-fajr"
          :class="{ active: selectedPrayerId === 'fajr' }"
          @click="selectPrayer('fajr')"
        >
          <div class="petal-shape">
            <button
              class="speaker-btn top"
              :title="speakerMuted.fajr ? '已静音' : '已开启提醒'"
              @click="toggleSpeaker('fajr', $event)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.speaker" :fill="speakerMuted.fajr ? '#8E8E93' : '#FFFFFF'" />
              </svg>
            </button>
            <span class="petal-title">晨礼</span>
            <span class="petal-clock">04:54</span>
          </div>
        </div>

        <!-- 2. 日出 06:07 (东北 60°) -->
        <div
          class="petal-wrapper petal-sunrise"
          :class="{ active: selectedPrayerId === 'sunrise' }"
          @click="selectPrayer('sunrise')"
        >
          <div class="petal-shape">
            <span class="petal-title">日出</span>
            <span class="petal-clock">06:07</span>
            <button
              class="speaker-btn bottom"
              :title="speakerMuted.sunrise ? '已静音' : '已开启提醒'"
              @click="toggleSpeaker('sunrise', $event)"
            >
              <!-- 静音喇叭 (斜划线) -->
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="#8E8E93" />
                <path d="M16 9L21 14M21 9L16 14" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 3. 晌礼 12:21 (东南 120° - 截图当前激活项：橙色高光 + 卷曲叶尾 + 星芒) -->
        <div
          class="petal-wrapper petal-dhuhr"
          :class="{ active: selectedPrayerId === 'dhuhr' }"
          @click="selectPrayer('dhuhr')"
        >
          <div class="petal-shape orange-highlight">
            <button
              class="speaker-btn top"
              :title="speakerMuted.dhuhr ? '已静音' : '已开启提醒'"
              @click="toggleSpeaker('dhuhr', $event)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.speaker" fill="#FFFFFF" />
              </svg>
            </button>
            <span class="petal-title text-white">晌礼</span>
            <span class="petal-clock text-white">12:21</span>

            <!-- 装饰卷曲叶尾与星芒饰件 -->
            <div class="dhuhr-curled-tail" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path
                  d="M4 4C12 8 20 16 24 26C26 23 29 20 31 20C29 17 26 12 22 8C16 4 10 3 4 4Z"
                  fill="#FF9500"
                />
                <!-- 四角小星芒 -->
                <path
                  d="M27 24L28 26.5L30.5 27.5L28 28.5L27 31L26 28.5L23.5 27.5L26 26.5L27 24Z"
                  fill="#FFE382"
                />
              </svg>
            </div>
          </div>
        </div>

        <!-- 4. 哺礼 15:48 (正南 180°) -->
        <div
          class="petal-wrapper petal-asr"
          :class="{ active: selectedPrayerId === 'asr' }"
          @click="selectPrayer('asr')"
        >
          <div class="petal-shape">
            <span class="petal-title">哺礼</span>
            <span class="petal-clock">15:48</span>
            <button
              class="speaker-btn bottom"
              :title="speakerMuted.asr ? '已静音' : '已开启提醒'"
              @click="toggleSpeaker('asr', $event)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.speaker" :fill="speakerMuted.asr ? '#8E8E93' : '#FFFFFF'" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 5. 昏礼 18:34 (西南 240°) -->
        <div
          class="petal-wrapper petal-maghrib"
          :class="{ active: selectedPrayerId === 'maghrib' }"
          @click="selectPrayer('maghrib')"
        >
          <div class="petal-shape">
            <button
              class="speaker-btn top"
              :title="speakerMuted.maghrib ? '已静音' : '已开启提醒'"
              @click="toggleSpeaker('maghrib', $event)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.speaker" :fill="speakerMuted.maghrib ? '#8E8E93' : '#FFFFFF'" />
              </svg>
            </button>
            <span class="petal-title">昏礼</span>
            <span class="petal-clock">18:34</span>
          </div>
        </div>

        <!-- 6. 宵礼 19:45 (西北 300° - 带克尔白朝向标志) -->
        <div
          class="petal-wrapper petal-isha"
          :class="{ active: selectedPrayerId === 'isha' }"
          @click="selectPrayer('isha')"
        >
          <div class="petal-shape">
            <span class="petal-title">宵礼</span>
            <span class="petal-clock">19:45</span>
            <button
              class="speaker-btn bottom"
              :title="speakerMuted.isha ? '已静音' : '已开启提醒'"
              @click="toggleSpeaker('isha', $event)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path :d="CLOCK_ICONS.speaker" :fill="speakerMuted.isha ? '#8E8E93' : '#FFFFFF'" />
              </svg>
            </button>
          </div>

          <!-- 西北角克尔白 (Kaaba) 朝拜圆形金环标志 -->
          <div class="kaaba-badge-indicator" title="克尔白（天房）朝向">
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
              <!-- 金色光环 -->
              <circle cx="16" cy="16" r="14.5" fill="#1C1C1E" stroke="#FF9500" stroke-width="2"/>
              <!-- 天房立体黑金方石 -->
              <path d="M16 7L24 11V21L16 25L8 21V11L16 7Z" fill="#181818"/>
              <path d="M16 7L24 11L16 15L8 11L16 7Z" fill="#2E2E30"/>
              <path d="M8 11L16 15V25L8 21V11Z" fill="#0E0E10"/>
              <path d="M24 11L16 15V25L24 21V11Z" fill="#202022"/>
              <!-- 金色饰带 (Kiswa) -->
              <path d="M8.5 13L16 16.8L23.5 13" stroke="#FFD700" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M11 16L16 18.5L21 16" stroke="#FFD700" stroke-width="1" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- 中心十字罗盘与实时时间圆盘 -->
      <div class="center-compass-dial">
        <!-- 罗盘方位文字标记 -->
        <div class="compass-axes-labels">
          <span class="axis-n">N</span>
          <span class="axis-e">E</span>
          <span class="axis-s">S</span>
          <span class="axis-w">W</span>
        </div>

        <!-- 红色罗盘指北/朝向指针（指向西北天房位置） -->
        <div class="kaaba-compass-needle" aria-hidden="true">
          <div class="needle-tip-red"></div>
        </div>

        <!-- 内部多角花盘雕花内胆 (Floral rosette outline) -->
        <div class="rosette-inner-contour" aria-hidden="true">
          <svg width="112" height="112" viewBox="0 0 100 100" fill="none">
            <path
              d="M50 5 L56 18 L68 12 L70 26 L84 25 L81 39 L93 43 L85 55 L93 67 L81 71 L84 85 L70 84 L68 98 L56 92 L50 105 L44 92 L32 98 L30 84 L16 85 L19 71 L7 67 L15 55 L7 43 L19 39 L16 25 L30 26 L32 12 L44 18 Z"
              fill="#222225"
              stroke="rgba(255, 255, 255, 0.08)"
              stroke-width="1"
            />
          </svg>
        </div>

        <!-- 居中实时时间展示 -->
        <div class="center-time-display">
          {{ timeShort || '09:55' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.muslim-tab {
  width: 100%;
  height: 100%;
  background: #000000;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif;
  box-sizing: border-box;
}

/* 顶部导航 Header */
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
  color: #ffffff;
}

.header-more-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}

.header-more-btn:active {
  background: rgba(255, 255, 255, 0.2);
}

/* 顶部三栏日期信息 */
.date-location-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 32px 14px;
  flex-shrink: 0;
}

.date-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.date-number {
  font-size: 24px;
  font-weight: 500;
  color: #ffffff;
  line-height: 1.1;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
}

.date-label {
  font-size: 13px;
  color: #8e8e93;
  margin-top: 4px;
  font-weight: 400;
}

.weekday-text {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.2;
}

.location-row {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
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
  margin-bottom: 74px; /* 为底部 62px 悬浮 Tab 预留空间 */
}

/* 蔓藤曼陀罗底纹 */
.filigree-mandala-bg {
  position: absolute;
  width: 370px;
  height: 370px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0.9;
}

/* 6 瓣花环轨道 */
.petals-orbit {
  position: absolute;
  width: 340px;
  height: 340px;
  pointer-events: auto;
}

.petal-wrapper {
  position: absolute;
  width: 96px;
  height: 82px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.22s cubic-bezier(0.25, 1, 0.5, 1);
}

.petal-wrapper:active {
  transform: scale(0.96);
}

/* 花瓣主体样式：圆润鹅卵石/莲花瓣形态 */
.petal-shape {
  width: 100%;
  height: 100%;
  background: #737376;
  border-radius: 46px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  position: relative;
  transition: background 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease;
  border: 0.5px solid rgba(255, 255, 255, 0.15);
}

/* 橙色高光花瓣（晌礼或选中的礼拜） */
.petal-shape.orange-highlight,
.petal-wrapper.active .petal-shape {
  background: #ff9500 !important;
  box-shadow: 0 6px 24px rgba(255, 149, 0, 0.45), 0 2px 8px rgba(255, 149, 0, 0.3);
  border-color: rgba(255, 255, 255, 0.25);
}

.petal-shape.orange-highlight .petal-title,
.petal-shape.orange-highlight .petal-clock,
.petal-wrapper.active .petal-title,
.petal-wrapper.active .petal-clock {
  color: #ffffff !important;
}

.dhuhr-curled-tail {
  position: absolute;
  bottom: -14px;
  right: -14px;
  pointer-events: none;
  z-index: 4;
}

.petal-title {
  font-size: 13px;
  font-weight: 500;
  color: #e5e5ea;
  line-height: 1.1;
  margin: 1px 0;
}

.petal-clock {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  letter-spacing: -0.2px;
  line-height: 1.2;
}

.speaker-btn {
  border: none;
  background: transparent;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  -webkit-tap-highlight-color: transparent;
}

.speaker-btn.top {
  margin-bottom: 2px;
}

.speaker-btn.bottom {
  margin-top: 2px;
}

/* 6 瓣绝对坐标布局 */
/* 1. 晨礼 04:54 (顶部) */
.petal-fajr {
  top: 6px;
  left: 122px;
}

/* 2. 日出 06:07 (东北 60°) */
.petal-sunrise {
  top: 56px;
  right: 14px;
}

/* 3. 晌礼 12:21 (东南 120°) */
.petal-dhuhr {
  bottom: 56px;
  right: 14px;
}

/* 4. 哺礼 15:48 (正南 180°) */
.petal-asr {
  bottom: 6px;
  left: 122px;
}

/* 5. 昏礼 18:34 (西南 240°) */
.petal-maghrib {
  bottom: 56px;
  left: 14px;
}

/* 6. 宵礼 19:45 (西北 300°) */
.petal-isha {
  top: 56px;
  left: 14px;
}

/* 克尔白（天房）朝拜金色圆形徽章 */
.kaaba-badge-indicator {
  position: absolute;
  top: -6px;
  left: -6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6));
}

/* 中心十字罗盘与实时时间 */
.center-compass-dial {
  width: 154px;
  height: 154px;
  border-radius: 50%;
  background: radial-gradient(circle, #38383a 0%, #242426 80%, #1c1c1e 100%);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.75), inset 0 1px 2px rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.12);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 8;
}

/* 罗盘方位标记 */
.compass-axes-labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.compass-axes-labels span {
  position: absolute;
  font-size: 11px;
  font-weight: 800;
  color: #c7c7cc;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
}

.axis-n {
  top: 7px;
  left: 50%;
  transform: translateX(-50%);
}

.axis-s {
  bottom: 7px;
  left: 50%;
  transform: translateX(-50%);
}

.axis-w {
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
}

.axis-e {
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
}

/* 红色天房指针 */
.kaaba-compass-needle {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
  transform: rotate(-55deg); /* 指向西北方向的克尔白天房 */
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.needle-tip-red {
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 15px solid #ff3b30;
  margin-top: 18px;
  filter: drop-shadow(0 0 4px rgba(255, 59, 48, 0.6));
}

/* 内部多角花盘雕花内胆 */
.rosette-inner-contour {
  position: absolute;
  width: 108px;
  height: 108px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 1;
}

/* 居中实时时间 */
.center-time-display {
  position: relative;
  z-index: 3;
  font-size: 28px;
  font-weight: 600;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  letter-spacing: -0.5px;
}
</style>
