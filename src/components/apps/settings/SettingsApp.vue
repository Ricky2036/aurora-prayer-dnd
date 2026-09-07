<script setup>
import { computed, ref, watch } from 'vue'
import { useControlStore } from '../../../stores/controlStore'
import { useClock } from '../../../composables/useClock'
import { useBackHandler } from '../../../composables/backRegistry'
import ListCell from '../../ui/ListCell.vue'
import ToggleSwitch from '../../ui/ToggleSwitch.vue'
import AppNavBar from '../../ui/AppNavBar.vue'
import SettingsNotifications from './SettingsNotifications.vue'
import SettingsSound from './SettingsSound.vue'
import SettingsDND from './SettingsDND.vue'
import SettingsPrayer from './SettingsPrayer.vue'
import { usePrayerStore } from '../../../stores/prayerStore'
import { useI18nStore } from '../../../stores/i18nStore'
import { GLYPHS } from '../../../assets/icons/glyphs'
import { clamp } from '../../../utils/math'

/**
 * 设置：分组列表首页 + 可点入二级页（无线局域网/显示与亮度/通用/通知/声音与振动/勿扰模式/朝拜勿扰）。
 * 开关与控制中心共享 controlStore，亮度二级页滑块真实联动屏幕亮度。
 * 通知二级页为 settingsprototype.tsx 的完整移植（含子页栈）。
 */
const props = defineProps({ app: Object })
const control = useControlStore()
const prayerStore = usePrayerStore()
const i18n = useI18nStore()
const { timeShort } = useClock()

/* 内部导航栈：若从礼拜卡片点入，则构建层级 [main, sound, prayer] */
const initialStack = prayerStore.targetView === 'prayer' ? ['main', 'sound', 'prayer'] : ['main']
if (prayerStore.targetView === 'prayer') {
  prayerStore.setTargetView('main')
}
const stack = ref(initialStack)
const view = computed(() => stack.value[stack.value.length - 1])
const isBack = ref(false)

watch(
  () => prayerStore.targetView,
  (newTarget) => {
    if (newTarget === 'prayer') {
      isBack.value = false
      stack.value = ['main', 'sound', 'prayer']
      prayerStore.setTargetView('main')
    }
  }
)

/* 蓝牙 / 蜂窝网络 / 墙纸 / 电池 四个二级页本原型未实现。
   原先它们被硬编码路由到 wifi / display 页（点「蓝牙」跳到 Wi-Fi 页），
   改为统一的占位页并显示正确标题，避免跳错页。 */
const placeholderKey = ref('')
function pushUnimplemented(v) {
  placeholderKey.value = v
  push('placeholder')
}

function push(v) {
  isBack.value = false
  stack.value.push(v)
}
function pop() {
  if (stack.value.length > 1) {
    isBack.value = true
    stack.value.pop()
  }
}

/* 全局侧滑返回：子页（通知/礼拜模式） → 首页（逐层消费），最后交还系统回桌面 */
const notifRef = ref(null)
const prayerRef = ref(null)
useBackHandler(() => {
  if (view.value === 'prayer' && prayerRef.value?.back()) return true
  if (view.value === 'notifications' && notifRef.value?.back()) return true
  if (stack.value.length > 1) { pop(); return true }
  return false
})

const viewTitles = computed(() => ({
  wifi: i18n.t('wifi'),
  display: i18n.t('displayAndBrightness'),
  general: i18n.t('general'),
  notifications: i18n.t('notifications'),
  sound: i18n.t('soundAndVibration'),
  dnd: i18n.t('dnd'),
  prayer: i18n.t('prayerDnd'),
  placeholder: i18n.t(placeholderKey.value) || i18n.t('general')
}))

/* 显示与亮度：横向亮度滑块 */
const sliderRef = ref(null)
let sliding = false
function setBrightness(e) {
  const r = sliderRef.value.getBoundingClientRect()
  control.setBrightness(clamp((e.clientX - r.left) / r.width, 0.25, 1))
}
function onSlideDown(e) {
  sliding = true
  e.currentTarget.setPointerCapture?.(e.pointerId)
  setBrightness(e)
}
function onSlideMove(e) { if (sliding) setBrightness(e) }
function onSlideUp() { sliding = false }

const networks = ['Office_5G', 'Tencent-Guest', 'CoffeeLab_2.4G', 'Neighbor_WiFi']
</script>

<template>
  <div class="settings-app">
    <Transition :name="isBack ? 'slide-back' : 'slide'" mode="out-in">
      <!-- ================= 首页 ================= -->
      <div v-if="view === 'main'" key="main" class="settings-page scrollable">
        <div class="large-title">{{ i18n.t('settings') }}</div>

        <!-- Apple ID 卡 -->
        <div class="apple-id-card" @click="push('general')">
          <div class="aid-avatar">R</div>
          <div class="aid-info">
            <div class="aid-name">{{ i18n.t('appleIdName') }}</div>
            <div class="aid-sub">{{ i18n.t('appleIdSub') }}</div>
          </div>
          <svg width="8" height="13" viewBox="0 0 8 13">
            <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>

        <div class="cell-group">
          <ListCell glyph="airplane" icon-bg="#FF9F0A" :title="i18n.t('airplaneMode')">
            <template #right><ToggleSwitch v-model="control.airplane" /></template>
          </ListCell>
          <ListCell glyph="wifi" icon-bg="#0A84FF" :title="i18n.t('wifi')" :value="control.wifi ? 'Aurora_5G' : i18n.t('off')" chevron @click="push('wifi')" />
          <ListCell glyph="bluetooth" icon-bg="#0A84FF" :title="i18n.t('bluetooth')" :value="control.bluetooth ? i18n.t('on') : i18n.t('off')" chevron @click="pushUnimplemented('bluetooth')" />
          <ListCell :icon-text="i18n.t('cellular').slice(0, 1)" icon-bg="#34C759" :title="i18n.t('cellular')" chevron last @click="pushUnimplemented('cellular')" />
        </div>

        <div class="cell-group">
          <ListCell glyph="bell" icon-bg="#FF3B30" :title="i18n.t('notifications')" chevron @click="push('notifications')" />
          <ListCell glyph="speaker" icon-bg="#FF2D55" :title="i18n.t('soundAndVibration')" chevron last @click="push('sound')" />
        </div>

        <div class="cell-group">
          <ListCell glyph="gear" icon-bg="#8E8E93" :title="i18n.t('general')" chevron @click="push('general')" />
          <ListCell glyph="sun" icon-bg="#0A84FF" :title="i18n.t('displayAndBrightness')" chevron @click="push('display')" />
          <ListCell glyph="image" icon-bg="#5AC8FA" :title="i18n.t('wallpaper')" chevron @click="pushUnimplemented('wallpaper')" />
          <ListCell glyph="battery" icon-bg="#34C759" :title="i18n.t('battery')" :value="Math.round(control.battery * 100) + '%'" chevron last @click="pushUnimplemented('battery')" />
        </div>

      </div>

      <!-- ================= 声音与振动 (图 1) ================= -->
      <div v-else-if="view === 'sound'" key="sound" class="settings-page">
        <SettingsSound @back="pop" @open-dnd="push('dnd')" @open-prayer="push('prayer')" />
      </div>

      <!-- ================= 勿扰模式 (图 2 + 礼拜模式入口) ================= -->
      <div v-else-if="view === 'dnd'" key="dnd" class="settings-page">
        <SettingsDND @back="pop" @open-prayer="push('prayer')" />
      </div>

      <!-- ================= 礼拜模式 ================= -->
      <div v-else-if="view === 'prayer'" key="prayer" class="settings-page">
        <SettingsPrayer ref="prayerRef" @back="pop" @back-to-dnd="pop" />
      </div>

      <!-- ================= 通知（settingsprototype.tsx 移植） ================= -->
      <div v-else-if="view === 'notifications'" key="notifications" class="settings-page">
        <SettingsNotifications ref="notifRef" @back-to-settings="pop" />
      </div>

      <!-- ================= 二级页 ================= -->
      <div v-else :key="view" class="settings-page">
        <AppNavBar :title="viewTitles[view]" :back-label="i18n.t('settings')" @back="pop" />

        <!-- 未实现页面的占位（蓝牙 / 蜂窝网络 / 墙纸 / 电池） -->
        <div v-if="view === 'placeholder'" class="scrollable detail-body">
          <div class="placeholder-note">{{ i18n.t('notImplemented') }}</div>
        </div>

        <!-- 无线局域网 -->
        <div v-else-if="view === 'wifi'" class="scrollable detail-body">
          <div class="cell-group">
            <ListCell glyph="wifi" icon-bg="#0A84FF" :title="i18n.t('wifi')" last>
              <template #right><ToggleSwitch v-model="control.wifi" /></template>
            </ListCell>
          </div>
          <template v-if="control.wifi">
            <div class="group-header">{{ i18n.t('currentNetwork') }}</div>
            <div class="cell-group">
              <ListCell title="Aurora_5G" last>
                <template #right>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path :d="GLYPHS.check" fill="#007AFF" /></svg>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path :d="GLYPHS.info" fill="#C7C7CC" /></svg>
                </template>
              </ListCell>
            </div>
            <div class="group-header">{{ i18n.t('otherNetworks') }}</div>
            <div class="cell-group">
              <ListCell v-for="(n, i) in networks" :key="n" :title="n" :last="i === networks.length - 1">
                <template #right>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path :d="GLYPHS.lock" fill="#C7C7CC" /></svg>
                </template>
              </ListCell>
            </div>
          </template>
          <div v-else class="empty-note">{{ i18n.t('wifiOffNote') }}</div>
        </div>

        <!-- 显示与亮度 -->
        <div v-else-if="view === 'display'" class="scrollable detail-body">
          <div class="group-header">{{ i18n.t('appearance') }}</div>
          <div class="appearance-row">
            <div class="appearance-card selected">
              <div class="appearance-preview light"></div>
              <span>{{ i18n.t('light') }}</span>
            </div>
            <div class="appearance-card">
              <div class="appearance-preview dark"></div>
              <span>{{ i18n.t('dark') }}</span>
            </div>
          </div>
          <div class="group-header">{{ i18n.t('brightnessLabel') }}</div>
          <div class="brightness-card">
            <svg width="16" height="16" viewBox="0 0 24 24"><path :d="GLYPHS.sun" fill="#8E8E93" /></svg>
            <div
              ref="sliderRef"
              class="h-slider"
              @pointerdown="onSlideDown"
              @pointermove="onSlideMove"
              @pointerup="onSlideUp"
              @pointercancel="onSlideUp"
            >
              <div class="h-slider-fill" :style="{ width: ((control.brightness - 0.25) / 0.75 * 100) + '%' }"></div>
            </div>
            <svg width="22" height="22" viewBox="0 0 24 24"><path :d="GLYPHS.sun" fill="#8E8E93" /></svg>
          </div>
          <div class="cell-group">
            <ListCell :title="i18n.t('trueTone')">
              <template #right><ToggleSwitch :model-value="true" /></template>
            </ListCell>
            <ListCell :title="i18n.t('nightShift')" :value="i18n.t('sunsetToSunrise')" chevron last />
          </div>
        </div>

        <!-- 通用 -->
        <div v-else class="scrollable detail-body">
          <div class="cell-group">
            <ListCell :title="i18n.t('about')" chevron />
            <ListCell :title="i18n.t('softwareUpdate')" :value="i18n.t('upToDate')" last />
          </div>
          <div class="group-header">{{ i18n.t('deviceInfo') }}</div>
          <div class="cell-group">
            <ListCell :title="i18n.t('deviceName')" value="Aurora One" />
            <ListCell :title="i18n.t('model')" value="Aurora Phone" />
            <ListCell :title="i18n.t('systemVersion')" value="26.0 (21A345)" last />
          </div>
          <div class="cell-group">
            <ListCell :title="i18n.t('storage')" value="214 GB / 256 GB" last />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.settings-app {
  height: 100%;
  background: var(--bg-grouped);
  overflow: hidden;
  position: relative;
}
.settings-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ================= 极速丝滑进退动画 (160ms 极速响应，无停滞) ================= */
.slide-enter-active,
.slide-back-enter-active {
  transition: transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.16s ease;
}
.slide-leave-active,
.slide-back-leave-active {
  transition: transform 0.12s cubic-bezier(0.4, 0, 1, 1), opacity 0.12s ease;
}

/* 进入：新页从右滑入 */
.slide-enter-from {
  transform: translateX(36px);
  opacity: 0;
}
.slide-enter-to {
  transform: translateX(0);
  opacity: 1;
}
/* 离开：旧页向左微移退出 */
.slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}
.slide-leave-to {
  transform: translateX(-24px);
  opacity: 0;
}

/* 返回进入：旧页从左侧滑回 */
.slide-back-enter-from {
  transform: translateX(-24px);
  opacity: 0;
}
.slide-back-enter-to {
  transform: translateX(0);
  opacity: 1;
}
/* 返回离开：顶页向右滑出 */
.slide-back-leave-from {
  transform: translateX(0);
  opacity: 1;
}
.slide-back-leave-to {
  transform: translateX(36px);
  opacity: 0;
}

.large-title {
  font: var(--text-large-title);
  color: var(--label);
  padding: calc(var(--safe-top) + 18px) 20px 12px;
  flex: none;
}

.apple-id-card {
  margin: 0 16px 22px;
  background: var(--bg-cell);
  border-radius: var(--radius-cell-group);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
}
.apple-id-card:active { background: #E9E9EB; }
.aid-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5AC8FA, #0A84FF);
  color: #fff;
  font: 600 22px/1 var(--font-stack);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.aid-info { flex: 1; min-width: 0; }
.aid-name { font: var(--text-headline); color: var(--label); }
.aid-sub { font: var(--text-footnote); color: var(--label-secondary); margin-top: 2px; }

.cell-group {
  margin: 0 16px 22px;
  border-radius: var(--radius-cell-group);
  overflow: hidden;
}
.group-header {
  font: var(--text-footnote);
  color: var(--label-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin: 0 20px 7px;
}
.detail-body { flex: 1; padding-top: 14px; }
.empty-note {
  text-align: center;
  color: var(--label-secondary);
  font: var(--text-subhead);
  margin-top: 40px;
}

/* 未实现二级页的占位空状态 */
.placeholder-note {
  text-align: center;
  color: var(--label-tertiary, var(--label-secondary));
  font: var(--text-subhead);
  margin-top: 120px;
  padding: 0 40px;
  line-height: 1.6;
}
.settings-footer {
  text-align: center;
  font: var(--text-caption);
  color: var(--label-tertiary);
  padding-bottom: 30px;
}

/* 外观选择 */
.appearance-row {
  display: flex;
  gap: 14px;
  margin: 0 16px 22px;
}
.appearance-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  font: var(--text-subhead);
  color: var(--label);
}
.appearance-preview {
  width: 100%;
  height: 110px;
  border-radius: 14px;
  border: 2.5px solid transparent;
}
.appearance-preview.light {
  background: linear-gradient(180deg, #fff 60%, #E9E9EB 60%);
}
.appearance-preview.dark {
  background: linear-gradient(180deg, #1c1c1e 60%, #3a3a3c 60%);
}
.appearance-card.selected .appearance-preview {
  border-color: var(--ios-blue);
  box-shadow: 0 2px 10px rgba(0, 122, 255, 0.25);
}

/* 横向亮度滑块 */
.brightness-card {
  margin: 0 16px 22px;
  background: var(--bg-cell);
  border-radius: var(--radius-cell-group);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.h-slider {
  flex: 1;
  height: 28px;
  border-radius: 14px;
  background: #E9E9EB;
  overflow: hidden;
  touch-action: none;
  cursor: pointer;
  position: relative;
}
.h-slider-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.1);
}
</style>
