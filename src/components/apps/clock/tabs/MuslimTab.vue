<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from "vue"
import { useClock } from "../../../../composables/useClock"
import { usePrayerStore } from "../../../../stores/prayerStore"

const emit = defineEmits(["open-subpage"])
const prayer = usePrayerStore()
const { timeShort } = useClock()

// 更多菜单弹窗显隐控制
const isMenuOpen = ref(false)

function toggleMenu(event) {
  event?.stopPropagation()
  isMenuOpen.value = !isMenuOpen.value
}

function closeMenu() {
  isMenuOpen.value = false
}

function handleMenuAction(subpageName) {
  closeMenu()
  emit("open-subpage", subpageName)
}

// 点击外部关闭弹窗
function onWindowClick(event) {
  if (isMenuOpen.value) {
    closeMenu()
  }
}

onMounted(() => {
  window.addEventListener("click", onWindowClick)
})

onBeforeUnmount(() => {
  window.removeEventListener("click", onWindowClick)
})

// 当前选中的礼拜卡片（默认当前激活的高亮项：晌礼 dhuhr）
const selectedPrayerId = ref("dhuhr")

// 6 个礼拜及日出时间节点（与实机截图 100% 像素级对齐）
const PRAYER_SLOTS = [
  { id: "fajr", name: "晨礼", time: "04:54", angle: 0, order: "icon-first" },
  { id: "sunrise", name: "日出", time: "06:07", angle: 60, order: "text-first", muted: true },
  { id: "dhuhr", name: "晌礼", time: "12:21", angle: 120, order: "icon-first", active: true },
  { id: "asr", name: "哺礼", time: "15:48", angle: 180, order: "text-first" },
  { id: "maghrib", name: "昏礼", time: "18:34", angle: 240, order: "icon-first" },
  { id: "isha", name: "宵礼", time: "19:45", angle: 300, order: "text-first" }
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
  if (id !== "sunrise") {
    prayer.setSimulatedPrayer(id)
  }
}

// 截图基准日期（9月10日星期四，回历27日回历3月，深圳市）
const gregorianDate = '10'
const gregorianMonth = '九月'
const weekDayStr = '星期四'
const locationCity = '深圳市'
const hijriDate = '27'
const hijriMonth = '回历 3 月'
</script>

<template>
  <div class="muslim-tab">
    <!-- 顶部极简透明 Bar：右侧 44px 垂直三点圆形胶囊按钮 -->
    <div class="tab-top-bar">
      <button
        class="more-menu-btn"
        title="更多"
        aria-label="更多"
        @click="toggleMenu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="5" r="2.2" fill="#FFFFFF" />
          <circle cx="12" cy="12" r="2.2" fill="#FFFFFF" />
          <circle cx="12" cy="19" r="2.2" fill="#FFFFFF" />
        </svg>
      </button>

      <!-- 点击出现弹窗菜单 (Popover Menu)：严格对齐截图覆于右上角 -->
      <Transition name="popover-fade">
        <div v-if="isMenuOpen" class="popover-menu" @click.stop>
          <button class="popover-item" @click="handleMenuAction('muslim-alarm')">
            <span class="popover-item-text">穆斯林闹钟</span>
          </button>
          <button class="popover-item" @click="handleMenuAction('general-settings')">
            <span class="popover-item-text">设置</span>
          </button>
        </div>
      </Transition>
    </div>

    <!-- 原生大标题规范 (Large Title)：位于顶栏下方，粗体，呼吸间距对齐 -->
    <div class="large-title-section">
      <h1 class="page-title">穆斯林</h1>
    </div>

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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z"
              fill="#8E8E93"
            />
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

    <!-- 中心朝拜花瓣轮盘与罗盘整体容器 (紧跟日期栏，距离约 32px，像素级对齐) -->
    <div class="compass-wheel-container">
      <svg
        class="prayer-wheel-svg"
        viewBox="0 0 380 380"
        width="346"
        height="346"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <!-- 红色罗盘指针光晕 -->
          <radialGradient id="needleGlow" cx="0%" cy="50%" r="100%">
            <stop offset="0%" stop-color="#FF3B30" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#C62828" stop-opacity="0.2" />
          </radialGradient>

          <!-- 晌礼激活金橙渐变 -->
          <linearGradient id="orangePetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFA000" />
            <stop offset="100%" stop-color="#FF9100" />
          </linearGradient>

          <!-- 花瓣微阴影滤镜 -->
          <filter id="petalShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.45" />
          </filter>

          <!-- 中心轮盘深色质感渐变 -->
          <radialGradient id="centerDialGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#48484B" />
            <stop offset="70%" stop-color="#3A3A3D" />
            <stop offset="100%" stop-color="#28282A" />
          </radialGradient>
        </defs>

        <!-- 1. 底层伊斯兰经典蔓藤花纹镂空蕾丝 (Arabesque Filigree) -->
        <g class="arabesque-lace-group filigree-mandala-bg">
          <g v-for="angle in [30, 90, 150, 210, 270, 330]" :key="'lace-' + angle" :transform="`rotate(${angle} 190 190)`">
            <g stroke="rgba(255, 255, 255, 0.22)" stroke-width="1.3" fill="none">
              <!-- 对称蔓藤卷叶花纹 -->
              <path d="M 190 92 C 178 66 162 58 150 48 C 162 40 176 48 181 60 C 185 48 199 40 211 48 C 199 58 183 66 190 92 Z" fill="rgba(255, 255, 255, 0.04)" />
              <path d="M 170 54 C 158 60 153 74 158 86 C 162 98 174 104 183 107" />
              <path d="M 210 54 C 222 60 227 74 222 86 C 218 98 206 104 197 107" />
              <!-- 侧向卷草小饰钩 -->
              <path d="M 163 70 C 154 72 147 79 150 86 C 153 91 160 88 163 81" />
              <path d="M 217 70 C 226 72 233 79 230 86 C 227 91 220 88 217 81" />
              <!-- 核心蔓藤小花环 -->
              <circle cx="190" cy="56" r="4" fill="rgba(255, 255, 255, 0.1)" stroke="rgba(255, 255, 255, 0.28)" stroke-width="0.9" />
            </g>
          </g>
        </g>

        <!-- 2. 6 朵礼拜花瓣 (SVG 几何矢量完全重构：饱满花盘 + 优美双角郁金香内弧月牙冠) -->
        <g class="petals-group">
          <!-- 晨礼 (0°) -->
          <g
            class="petal-svg-item"
            :class="{ active: selectedPrayerId === 'fajr' }"
            cursor="pointer"
            @click="selectPrayer('fajr')"
          >
            <!-- 双角郁金香月牙外冠 (内弧造型，尖端向内收拢) -->
            <path
              d="M 166 32 C 168 18 174 6 183 0 C 182 12 185 20 190 25 C 195 20 198 12 197 0 C 206 6 212 18 214 32 Z"
              fill="#7A7A7D"
            />
            <!-- 饱满圆形花盘 (r = 55) -->
            <circle cx="190" cy="82" r="55" fill="#7A7A7D" filter="url(#petalShadow)" />
          </g>

          <!-- 日出 (60°) -->
          <g
            class="petal-svg-item"
            :class="{ active: selectedPrayerId === 'sunrise' }"
            cursor="pointer"
            @click="selectPrayer('sunrise')"
          >
            <g transform="rotate(60 190 190)">
              <path
                d="M 166 32 C 168 18 174 6 183 0 C 182 12 185 20 190 25 C 195 20 198 12 197 0 C 206 6 212 18 214 32 Z"
                fill="#7A7A7D"
              />
              <circle cx="190" cy="82" r="55" fill="#7A7A7D" filter="url(#petalShadow)" />
            </g>
          </g>

          <!-- 晌礼 (120° - 激活高亮鲜艳金橙 + 尾端四角星芒饰件) -->
          <g
            class="petal-svg-item is-active orange-highlight"
            :class="{ active: selectedPrayerId === 'dhuhr' }"
            cursor="pointer"
            @click="selectPrayer('dhuhr')"
          >
            <g transform="rotate(120 190 190)">
              <!-- 金橙双角外冠 -->
              <path
                d="M 166 32 C 168 18 174 6 183 0 C 182 12 185 20 190 25 C 195 20 198 12 197 0 C 206 6 212 18 214 32 Z"
                fill="#FF9500"
              />
              <!-- 尾端四角金星小饰件 (附于凹槽尖端) -->
              <g class="dhuhr-curled-tail">
                <path
                  d="M 190 -8 L 193 -2 L 199 0 L 193 2 L 190 8 L 187 2 L 181 0 L 187 -2 Z"
                  fill="#FFE082"
                />
              </g>
              <!-- 金橙主体圆盘 -->
              <circle cx="190" cy="82" r="55" fill="url(#orangePetalGrad)" filter="url(#petalShadow)" />
            </g>
          </g>

          <!-- 哺礼 (180°) -->
          <g
            class="petal-svg-item"
            :class="{ active: selectedPrayerId === 'asr' }"
            cursor="pointer"
            @click="selectPrayer('asr')"
          >
            <g transform="rotate(180 190 190)">
              <path
                d="M 166 32 C 168 18 174 6 183 0 C 182 12 185 20 190 25 C 195 20 198 12 197 0 C 206 6 212 18 214 32 Z"
                fill="#7A7A7D"
              />
              <circle cx="190" cy="82" r="55" fill="#7A7A7D" filter="url(#petalShadow)" />
            </g>
          </g>

          <!-- 昏礼 (240°) -->
          <g
            class="petal-svg-item"
            :class="{ active: selectedPrayerId === 'maghrib' }"
            cursor="pointer"
            @click="selectPrayer('maghrib')"
          >
            <g transform="rotate(240 190 190)">
              <path
                d="M 166 32 C 168 18 174 6 183 0 C 182 12 185 20 190 25 C 195 20 198 12 197 0 C 206 6 212 18 214 32 Z"
                fill="#7A7A7D"
              />
              <circle cx="190" cy="82" r="55" fill="#7A7A7D" filter="url(#petalShadow)" />
            </g>
          </g>

          <!-- 宵礼 (300°) -->
          <g
            class="petal-svg-item"
            :class="{ active: selectedPrayerId === 'isha' }"
            cursor="pointer"
            @click="selectPrayer('isha')"
          >
            <g transform="rotate(300 190 190)">
              <path
                d="M 166 32 C 168 18 174 6 183 0 C 182 12 185 20 190 25 C 195 20 198 12 197 0 C 206 6 212 18 214 32 Z"
                fill="#7A7A7D"
              />
              <circle cx="190" cy="82" r="55" fill="#7A7A7D" filter="url(#petalShadow)" />
            </g>
          </g>
        </g>

        <!-- 3. 中心罗盘大圆盘与卡齿 (Center Compass Dial) -->
        <g class="center-dial-group center-compass-dial">
          <!-- 6 枚外伸尖角三角形卡齿 (位于 30°, 90°, 150°, 210°, 270°, 330° 花瓣接缝处) -->
          <g v-for="angle in [30, 90, 150, 210, 270, 330]" :key="'tooth-' + angle" :transform="`rotate(${angle} 190 190)`">
            <polygon points="186,105 194,105 190,96" fill="#3D3D40" />
          </g>

          <!-- 中心暗灰圆盘 (r = 86) -->
          <circle cx="190" cy="190" r="86" fill="url(#centerDialGrad)" filter="url(#petalShadow)" />

          <!-- 罗盘方位标记文字 (斜体白字 N, E, S, W) -->
          <text x="220" y="125" fill="#FFFFFF" font-size="14" font-weight="700" font-style="italic" text-anchor="middle">N</text>
          <text x="266" y="222" fill="#FFFFFF" font-size="14" font-weight="700" font-style="italic" text-anchor="middle">E</text>
          <text x="160" y="270" fill="#FFFFFF" font-size="14" font-weight="700" font-style="italic" text-anchor="middle">S</text>
          <text x="114" y="172" fill="#FFFFFF" font-size="14" font-weight="700" font-style="italic" text-anchor="middle">W</text>

          <!-- 红色罗盘指针 (朝向西北麦加天房位置，约 305° 方向) -->
          <g class="kaaba-compass-needle" transform="rotate(305 190 190)">
            <polygon points="185,142 195,142 190,116" fill="#E53935" />
            <polygon points="186,140 194,140 190,118" fill="#FF5252" />
          </g>

          <!-- 内部 12 瓣花形星盘 (12-point Rosette) -->
          <path
            d="
              M 190 138
              L 194 146 L 202 142 L 203 151 L 212 149 L 210 158 L 219 160 L 213 168 L 221 174 L 213 180 L 219 188 L 210 190
              L 212 199 L 203 197 L 202 206 L 194 202 L 190 210
              L 186 202 L 178 206 L 177 197 L 168 199 L 170 190 L 161 188 L 167 180 L 159 174 L 167 168 L 161 160 L 170 158
              L 168 149 L 177 151 L 178 142 L 186 146 Z
            "
            fill="#222224"
            stroke="rgba(255, 255, 255, 0.12)"
            stroke-width="1.3"
          />

          <!-- 核心数字时钟 (实时显示，如 10:13) -->
          <text
            x="190"
            y="199"
            fill="#FFFFFF"
            font-size="28"
            font-weight="500"
            font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
            text-anchor="middle"
            letter-spacing="0.5"
          >
            {{ timeShort || '10:13' }}
          </text>
        </g>

        <!-- 4. 西北角克尔白立体天房金环标志 (位于宵礼 300° 花瓣左上缘，三维等距天房黑石) -->
        <g class="kaaba-badge-group kaaba-badge-indicator" transform="translate(68, 62)">
          <!-- 外层金环 -->
          <circle cx="17" cy="17" r="15" fill="#1C1C1E" stroke="#FF9500" stroke-width="2.2" />
          <!-- 立体等距克尔白黑石 (Top/Left/Right 三面受光投影) -->
          <path d="M 17 6.5 L 25 11 L 17 15.5 L 9 11 Z" fill="#38383C" />
          <path d="M 9 11 L 17 15.5 V 25.5 L 9 21 Z" fill="#101012" />
          <path d="M 25 11 L 17 15.5 V 25.5 L 25 21 Z" fill="#242428" />
          <!-- 标志性黄色/金色饰带 (Kiswa 双层金色锦缎与右侧金门) -->
          <path d="M 9.5 13.5 L 17 17.8 L 24.5 13.5" stroke="#FFD700" stroke-width="1.8" stroke-linecap="round" fill="none" />
          <path d="M 11.5 16.2 L 17 19.5 L 22.5 16.2" stroke="#FFD700" stroke-width="1" stroke-linecap="round" fill="none" />
          <!-- 金门 (Bab al-Tawba) -->
          <path d="M 20 18.5 V 22.5" stroke="#FFD700" stroke-width="1.5" stroke-linecap="round" />
        </g>
      </svg>

      <!-- HTML 图标与文字覆盖层 (确保字体清晰与喇叭交互响应) -->
      <div class="petals-html-overlay" aria-hidden="false">
        <!-- 1. 晨礼 (上喇叭、中名称、下时间) -->
        <div class="petal-content-anchor fajr-pos" @click="selectPrayer('fajr')">
          <button class="icon-touch-btn" @click="toggleSpeaker('fajr', $event)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M11 5L6 9H2V15H6L11 19V5Z" :fill="speakerMuted.fajr ? '#8E8E93' : '#FFFFFF'" />
              <path v-if="!speakerMuted.fajr" d="M15.54 8.46C16.48 9.4 17 10.67 17 12C17 13.33 16.48 14.6 15.54 15.54" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
          <span class="prayer-name-text">晨礼</span>
          <span class="prayer-time-text">04:54</span>
        </div>

        <!-- 2. 日出 (上名称、中时间、下静音喇叭) -->
        <div class="petal-content-anchor sunrise-pos" @click="selectPrayer('sunrise')">
          <span class="prayer-name-text">日出</span>
          <span class="prayer-time-text">06:07</span>
          <button class="icon-touch-btn" @click="toggleSpeaker('sunrise', $event)">
            <!-- 静音喇叭 (斜划线) -->
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="#8E8E93" />
              <path d="M16 9L21 14M21 9L16 14" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <!-- 3. 晌礼 (上喇叭、中名称、下时间 - 高亮金橙) -->
        <div class="petal-content-anchor dhuhr-pos" @click="selectPrayer('dhuhr')">
          <button class="icon-touch-btn" @click="toggleSpeaker('dhuhr', $event)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="#FFFFFF" />
              <path d="M15.54 8.46C16.48 9.4 17 10.67 17 12C17 13.33 16.48 14.6 15.54 15.54" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
          <span class="prayer-name-text active-white">晌礼</span>
          <span class="prayer-time-text active-white">12:21</span>
        </div>

        <!-- 4. 哺礼 (上名称、中时间、下喇叭) -->
        <div class="petal-content-anchor asr-pos" @click="selectPrayer('asr')">
          <span class="prayer-name-text">哺礼</span>
          <span class="prayer-time-text">15:48</span>
          <button class="icon-touch-btn" @click="toggleSpeaker('asr', $event)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M11 5L6 9H2V15H6L11 19V5Z" :fill="speakerMuted.asr ? '#8E8E93' : '#FFFFFF'" />
              <path v-if="!speakerMuted.asr" d="M15.54 8.46C16.48 9.4 17 10.67 17 12C17 13.33 16.48 14.6 15.54 15.54" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <!-- 5. 昏礼 (上喇叭、中名称、下时间) -->
        <div class="petal-content-anchor maghrib-pos" @click="selectPrayer('maghrib')">
          <button class="icon-touch-btn" @click="toggleSpeaker('maghrib', $event)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M11 5L6 9H2V15H6L11 19V5Z" :fill="speakerMuted.maghrib ? '#8E8E93' : '#FFFFFF'" />
              <path v-if="!speakerMuted.maghrib" d="M15.54 8.46C16.48 9.4 17 10.67 17 12C17 13.33 16.48 14.6 15.54 15.54" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
          <span class="prayer-name-text">昏礼</span>
          <span class="prayer-time-text">18:34</span>
        </div>

        <!-- 6. 宵礼 (上名称、中时间、下喇叭) -->
        <div class="petal-content-anchor isha-pos" @click="selectPrayer('isha')">
          <span class="prayer-name-text">宵礼</span>
          <span class="prayer-time-text">19:45</span>
          <button class="icon-touch-btn" @click="toggleSpeaker('isha', $event)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M11 5L6 9H2V15H6L11 19V5Z" :fill="speakerMuted.isha ? '#8E8E93' : '#FFFFFF'" />
              <path v-if="!speakerMuted.isha" d="M15.54 8.46C16.48 9.4 17 10.67 17 12C17 13.33 16.48 14.6 15.54 15.54" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
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

/* 顶部透明极简 Bar */
.tab-top-bar {
  height: 44px;
  margin-top: 6px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  z-index: 60;
  flex-shrink: 0;
}

/* 44px 垂直三点胶囊按钮 */
.more-menu-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 0.5px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}

.more-menu-btn:active {
  background: rgba(255, 255, 255, 0.24);
  transform: scale(0.95);
}

/* 弹窗菜单 (Popover Menu)：深灰毛玻璃圆角卡片，严格匹配截图覆于右上角 */
.popover-menu {
  position: absolute;
  top: 0px;
  right: 12px;
  width: 180px;
  background: rgba(36, 36, 38, 0.96);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border-radius: 20px;
  border: 0.5px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.7), 0 2px 8px rgba(0, 0, 0, 0.5);
  padding: 6px 0;
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.popover-item {
  width: 100%;
  padding: 15px 22px;
  background: transparent;
  border: none;
  text-align: left;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.popover-item:active {
  background: rgba(255, 255, 255, 0.09);
}

.popover-item-text {
  font-size: 16px;
  font-weight: 400;
  color: #ffffff;
  letter-spacing: -0.2px;
}

/* 弹窗动画 */
.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.18s cubic-bezier(0.2, 0, 0.25, 1), transform 0.18s cubic-bezier(0.2, 0, 0.25, 1);
  transform-origin: top right;
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

/* 原生大标题 (Large Title) */
.large-title-section {
  padding: 0 24px 8px 24px;
  flex-shrink: 0;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  line-height: 1.15;
  letter-spacing: -0.5px;
}

/* 顶部三栏日期信息 */
.date-location-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 28px 10px;
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
  font-size: 13px;
  color: #8e8e93;
}

/* 中心朝拜轮盘整体容器：顶部紧邻日期栏，底边留出充足呼吸空间 */
.compass-wheel-container {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-top: 14px;
  margin-bottom: auto;
}

.prayer-wheel-svg {
  display: block;
  user-select: none;
}

/* HTML 图标与文字覆盖层 (绝对定位与 SVG 严格对应) */
.petals-html-overlay {
  position: absolute;
  width: 346px;
  height: 346px;
  pointer-events: none;
}

.petal-content-anchor {
  position: absolute;
  width: 82px;
  height: 82px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: pointer;
  transform: translate(-50%, -50%);
}

/* 6 瓣各中心锚点坐标 (基于 346x346 容器，中心 173,173，r = 98) */
/* 1. 晨礼 (0°): x=173, y=173-98 = 75 */
.fajr-pos {
  left: 173px;
  top: 75px;
}

/* 2. 日出 (60°): x=173 + 98*0.866 = 257.8, y=173 - 98*0.5 = 124 */
.sunrise-pos {
  left: 257.8px;
  top: 124px;
}

/* 3. 晌礼 (120°): x=173 + 98*0.866 = 257.8, y=173 + 98*0.5 = 222 */
.dhuhr-pos {
  left: 257.8px;
  top: 222px;
}

/* 4. 哺礼 (180°): x=173, y=173+98 = 271 */
.asr-pos {
  left: 173px;
  top: 271px;
}

/* 5. 昏礼 (240°): x=173 - 98*0.866 = 88.2, y=173 + 98*0.5 = 222 */
.maghrib-pos {
  left: 88.2px;
  top: 222px;
}

/* 6. 宵礼 (300°): x=173 - 98*0.866 = 88.2, y=173 - 98*0.5 = 124 */
.isha-pos {
  left: 88.2px;
  top: 124px;
}

/* 花瓣内文字排版 */
.prayer-name-text {
  font-size: 13px;
  font-weight: 500;
  color: #e5e5ea;
  line-height: 1.1;
  margin: 1px 0;
}

.prayer-time-text {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  letter-spacing: -0.2px;
  line-height: 1.15;
}

.active-white {
  color: #ffffff !important;
}

/* 喇叭触控按钮 */
.icon-touch-btn {
  border: none;
  background: transparent;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
</style>
