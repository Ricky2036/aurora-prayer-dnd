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

          <!-- 指向麦加天房花瓣红晕渐变 -->
          <radialGradient id="meccaPetalGrad" cx="50%" cy="10%" r="90%">
            <stop offset="0%" stop-color="#FF3B30" stop-opacity="0.9" />
            <stop offset="50%" stop-color="#C62828" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#202022" stop-opacity="0" />
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

        <!-- 2. 6 朵礼拜花瓣 (SVG 几何矢量：饱满花盘 + 双瓣外展优雅月牙花冠，严格像素级对齐图1原图) -->
        <g class="petals-group">
          <!-- 晨礼 (0°) -->
          <g
            class="petal-svg-item"
            :class="{ active: selectedPrayerId === 'fajr' }"
            cursor="pointer"
            @click="selectPrayer('fajr')"
          >
            <!-- 双瓣外展优雅月牙花冠 (两瓣优美外展，中间轻触收腰，内嵌暗弧镂空，严格对齐图1原图) -->
            <path
              d="M 166 6 C 172 8, 184 12, 190 17.5 C 196 12, 208 8, 214 6 C 210 11, 206 15, 206 18.5 C 206 24.5, 212 30.5, 220 36 C 214 32, 208 29, 203 28 C 198 25, 194 20.5, 190 18 C 186 20.5, 182 25, 177 28 C 172 29, 166 32, 160 36 C 168 30.5, 174 24.5, 174 18.5 C 174 15, 170 11, 166 6 Z"
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
                d="M 166 6 C 172 8, 184 12, 190 17.5 C 196 12, 208 8, 214 6 C 210 11, 206 15, 206 18.5 C 206 24.5, 212 30.5, 220 36 C 214 32, 208 29, 203 28 C 198 25, 194 20.5, 190 18 C 186 20.5, 182 25, 177 28 C 172 29, 166 32, 160 36 C 168 30.5, 174 24.5, 174 18.5 C 174 15, 170 11, 166 6 Z"
                fill="#7A7A7D"
              />
              <circle cx="190" cy="82" r="55" fill="#7A7A7D" filter="url(#petalShadow)" />
            </g>
          </g>

          <!-- 晌礼 (120° - 激活高亮鲜艳金橙 + 外冠开口内嵌四角金星) -->
          <g
            class="petal-svg-item is-active orange-highlight"
            :class="{ active: selectedPrayerId === 'dhuhr' }"
            cursor="pointer"
            @click="selectPrayer('dhuhr')"
          >
            <g transform="rotate(120 190 190)">
              <!-- 金橙经典双瓣外展月牙花冠 -->
              <path
                d="M 166 6 C 172 8, 184 12, 190 17.5 C 196 12, 208 8, 214 6 C 210 11, 206 15, 206 18.5 C 206 24.5, 212 30.5, 220 36 C 214 32, 208 29, 203 28 C 198 25, 194 20.5, 190 18 C 186 20.5, 182 25, 177 28 C 172 29, 166 32, 160 36 C 168 30.5, 174 24.5, 174 18.5 C 174 15, 170 11, 166 6 Z"
                fill="#FF9500"
              />
              <!-- 尾端四角金星小饰件 (嵌套于月牙外展口中央，严格对齐图1原图) -->
              <g class="dhuhr-curled-tail">
                <path
                  d="M 190 7 L 192.5 13 L 198.5 14.5 L 192.5 16 L 190 22 L 187.5 16 L 181.5 14.5 L 187.5 13 Z"
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
                d="M 166 6 C 172 8, 184 12, 190 17.5 C 196 12, 208 8, 214 6 C 210 11, 206 15, 206 18.5 C 206 24.5, 212 30.5, 220 36 C 214 32, 208 29, 203 28 C 198 25, 194 20.5, 190 18 C 186 20.5, 182 25, 177 28 C 172 29, 166 32, 160 36 C 168 30.5, 174 24.5, 174 18.5 C 174 15, 170 11, 166 6 Z"
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
                d="M 166 6 C 172 8, 184 12, 190 17.5 C 196 12, 208 8, 214 6 C 210 11, 206 15, 206 18.5 C 206 24.5, 212 30.5, 220 36 C 214 32, 208 29, 203 28 C 198 25, 194 20.5, 190 18 C 186 20.5, 182 25, 177 28 C 172 29, 166 32, 160 36 C 168 30.5, 174 24.5, 174 18.5 C 174 15, 170 11, 166 6 Z"
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
                d="M 166 6 C 172 8, 184 12, 190 17.5 C 196 12, 208 8, 214 6 C 210 11, 206 15, 206 18.5 C 206 24.5, 212 30.5, 220 36 C 214 32, 208 29, 203 28 C 198 25, 194 20.5, 190 18 C 186 20.5, 182 25, 177 28 C 172 29, 166 32, 160 36 C 168 30.5, 174 24.5, 174 18.5 C 174 15, 170 11, 166 6 Z"
                fill="#7A7A7D"
              />
              <circle cx="190" cy="82" r="55" fill="#7A7A7D" filter="url(#petalShadow)" />
            </g>
          </g>
        </g>

        <!-- 3. 中心罗盘大圆盘与卡齿 (Center Compass Dial) -->
        <g class="center-dial-group center-compass-dial">
          <!-- 8 枚外伸三角形罗盘卡齿 (与 4 主轴 26°, 116°, 206°, 296° 及 4 间轴 71°, 161°, 251°, 341° 严格同轴对齐) -->
          <g v-for="angle in [26, 116, 206, 296]" :key="'tooth-cardinal-' + angle" :transform="`rotate(${angle} 190 190)`">
            <polygon points="184,106 196,106 190,95" fill="#3D3D40" />
          </g>
          <g v-for="angle in [71, 161, 251, 341]" :key="'tooth-sec-' + angle" :transform="`rotate(${angle} 190 190)`">
            <polygon points="185,106 195,106 190,98" fill="#3D3D40" />
          </g>

          <!-- 中心暗灰圆盘 (r = 86) -->
          <circle cx="190" cy="190" r="86" fill="url(#centerDialGrad)" filter="url(#petalShadow)" />

          <!-- 4 个主方位文字 (N, E, S, W)，与对应箭头严格同轴同径旋转，精准对齐 -->
          <g transform="rotate(26 190 190)">
            <text x="190" y="124" fill="#FFFFFF" font-size="14" font-weight="700" font-style="italic" text-anchor="middle">N</text>
          </g>
          <g transform="rotate(116 190 190)">
            <text x="190" y="124" fill="#FFFFFF" font-size="14" font-weight="700" font-style="italic" text-anchor="middle">E</text>
          </g>
          <g transform="rotate(206 190 190)">
            <text x="190" y="124" fill="#FFFFFF" font-size="14" font-weight="700" font-style="italic" text-anchor="middle">S</text>
          </g>
          <g transform="rotate(296 190 190)">
            <text x="190" y="124" fill="#FFFFFF" font-size="14" font-weight="700" font-style="italic" text-anchor="middle">W</text>
          </g>

          <!-- 内部大号 12 瓣饱满伊斯兰莲花星盘 (与罗盘 26° 严格同步：N, E, S, W 精准穿过花瓣尖顶；含双线精细内轮廓) -->
          <g transform="rotate(26 190 190)">
            <path
              class="center-rosette-bg"
              d="M 176.5 139.8 C 177.6 135.0, 181.8 127.5, 190.0 122.0 C 192.6 124.1, 198.2 127.5, 203.5 139.8 C 206.8 136.1, 214.1 131.8, 224.0 131.1 C 225.3 134.2, 228.4 140.0, 226.8 153.2 C 231.4 151.7, 240.0 151.6, 248.9 156.0 C 248.4 159.3, 248.2 165.9, 240.2 176.5 C 245.0 177.6, 252.5 181.8, 258.0 190.0 C 255.9 192.6, 252.5 198.2, 240.2 203.5 C 243.9 206.8, 248.2 214.1, 248.9 224.0 C 245.8 225.3, 240.0 228.4, 226.8 226.8 C 228.3 231.4, 228.4 240.0, 224.0 248.9 C 220.7 248.4, 214.1 248.2, 203.5 240.2 C 202.4 245.0, 198.2 252.5, 190.0 258.0 C 187.4 255.9, 181.8 252.5, 176.5 240.2 C 173.2 243.9, 165.9 248.2, 156.0 248.9 C 154.7 245.8, 151.6 240.0, 153.2 226.8 C 148.6 228.3, 140.0 228.4, 131.1 224.0 C 131.6 220.7, 131.8 214.1, 139.8 203.5 C 135.0 202.4, 127.5 198.2, 122.0 190.0 C 124.1 187.4, 127.5 181.8, 139.8 176.5 C 136.1 173.2, 131.8 165.9, 131.1 156.0 C 134.2 154.7, 140.0 151.6, 153.2 153.2 C 151.7 148.6, 151.6 140.0, 156.0 131.1 C 159.3 131.6, 165.9 131.8, 176.5 139.8 Z"
              fill="#202022"
            />

            <!-- 指向天房方向的花瓣暗红高光晕染 (星盘内部相对 300°，绝对 326° 指向西北天房) -->
            <g class="kaaba-compass-needle" transform="rotate(300 190 190)">
              <path
                d="M 176.5 139.8 C 177.6 135.0, 181.8 127.5, 190.0 122.0 C 192.6 124.1, 198.2 127.5, 203.5 139.8 Z"
                fill="url(#meccaPetalGrad)"
              />
              <polygon points="186,128 194,128 190,122" fill="#FF5252" opacity="0.9" />
            </g>

            <!-- 花形星盘内侧精细双轮廓线 -->
            <path
              class="center-rosette-inner-contour"
              d="M 177.2 142.2 C 178.1 137.4, 182.1 130.0, 190.0 124.5 C 192.5 126.6, 197.9 130.0, 202.8 142.2 C 206.0 138.5, 213.2 134.1, 222.8 133.3 C 223.9 136.3, 226.8 142.0, 225.0 155.0 C 229.6 153.4, 238.0 153.2, 246.7 157.3 C 246.2 160.5, 245.9 166.8, 237.8 177.2 C 242.6 178.1, 250.0 182.1, 255.5 190.0 C 253.4 192.5, 250.0 197.9, 237.8 202.8 C 241.5 206.0, 245.9 213.2, 246.7 222.8 C 243.7 223.9, 238.0 226.8, 225.0 225.0 C 226.6 229.6, 226.8 238.0, 222.8 246.7 C 219.5 246.2, 213.2 245.9, 202.8 237.8 C 201.9 242.6, 197.9 250.0, 190.0 255.5 C 187.5 253.4, 182.1 250.0, 177.2 237.8 C 174.0 241.5, 166.8 245.9, 157.3 246.7 C 156.1 243.7, 153.2 238.0, 155.0 225.0 C 150.4 226.6, 142.0 226.8, 133.3 222.8 C 133.8 219.5, 134.1 213.2, 142.2 202.8 C 137.4 201.9, 130.0 197.9, 124.5 190.0 C 126.6 187.5, 130.0 182.1, 142.2 177.2 C 138.5 174.0, 134.1 166.8, 133.3 157.3 C 136.3 156.1, 142.0 153.2, 155.0 155.0 C 153.4 150.4, 153.2 142.0, 157.2 133.3 C 160.5 133.8, 166.8 134.1, 177.2 142.2 Z"
              fill="none"
              stroke="rgba(255, 255, 255, 0.26)"
              stroke-width="1.2"
            />
          </g>

          <!-- 核心数字时钟 (实时显示，如 10:13) -->
          <text
            x="190"
            y="199"
            fill="#FFFFFF"
            font-size="28"
            font-weight="400"
            font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
            text-anchor="middle"
            letter-spacing="0.5"
          >
            {{ timeShort || '10:13' }}
          </text>
        </g>

        <!-- 4. 西北角克尔白立体天房金环徽标 (图3：白底金环 + 3D等距天房黑石 + 标志性金色锦缎与金门) -->
        <g class="kaaba-badge-group kaaba-badge-indicator" transform="translate(72, 64)">
          <!-- 外层金环与白底纯净圆盘 (消除暗底，彻底告别乱码礼物盒) -->
          <circle cx="17" cy="17" r="16" fill="#FFFFFF" stroke="#E6981A" stroke-width="2.2" />
          
          <!-- 立体等距克尔白天房主体 (三面体受光正射投影) -->
          <!-- 顶面 (平坦屋顶，暗炭灰) -->
          <polygon points="17,7.5 25,11.8 17,16.2 9,11.8" fill="#3A3A3E" />
          <!-- 左墙面 (深黑纯暗部) -->
          <polygon points="9,11.8 17,16.2 17,26.2 9,21.8" fill="#141416" />
          <!-- 右墙面 (略受微光暗石墨) -->
          <polygon points="17,16.2 25,11.8 25,21.8 17,26.2" fill="#242428" />

          <!-- 标志性黄色/金色锦缎 (Kiswa 圣幕金线环绕带) -->
          <!-- 左侧金带 -->
          <polygon points="9,14 17,18.4 17,20.4 9,16" fill="#F5A623" />
          <!-- 右侧金带 -->
          <polygon points="17,18.4 25,14 25,16 17,20.4" fill="#E6981A" />

          <!-- 克尔白天房金门 (Bab al-Kaaba，位于右墙面的纯金大门) -->
          <polygon points="19.5,18.8 22.8,17.0 22.8,22.8 19.5,24.6" fill="#F5A623" />
          <!-- 金门边框微细线 -->
          <polyline points="19.5,18.8 22.8,17.0 22.8,22.8 19.5,24.6" stroke="#D48812" stroke-width="0.5" fill="none" />

          <!-- 下层锦缎细金线装饰 (Hizam) -->
          <polyline points="9,18 17,22.4 25,18" stroke="#FFC107" stroke-width="0.8" stroke-linecap="round" fill="none" />
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

/* 6 瓣各中心锚点坐标 (基于 346x346 容器，中心 173,173，r = 116 避开中心罗盘圆盘遮挡) */
/* 1. 晨礼 (0°): x=173, y=173-116 = 57 */
.fajr-pos {
  left: 173px;
  top: 57px;
}

/* 2. 日出 (60°): x=173 + 116*0.866 = 273.5, y=173 - 116*0.5 = 115 */
.sunrise-pos {
  left: 274px;
  top: 115px;
}

/* 3. 晌礼 (120°): x=173 + 116*0.866 = 273.5, y=173 + 116*0.5 = 231 */
.dhuhr-pos {
  left: 274px;
  top: 231px;
}

/* 4. 哺礼 (180°): x=173, y=173+116 = 289 */
.asr-pos {
  left: 173px;
  top: 289px;
}

/* 5. 昏礼 (240°): x=173 - 116*0.866 = 72.5, y=173 + 116*0.5 = 231 */
.maghrib-pos {
  left: 72px;
  top: 231px;
}

/* 6. 宵礼 (300°): x=173 - 116*0.866 = 72.5, y=173 - 116*0.5 = 115 */
.isha-pos {
  left: 72px;
  top: 115px;
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
