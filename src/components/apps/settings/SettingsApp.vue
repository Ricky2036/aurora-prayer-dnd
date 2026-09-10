<script setup>
import { computed, ref, watch } from 'vue'
import { useControlStore } from '../../../stores/controlStore'
import { useClock } from '../../../composables/useClock'
import { useBackHandler } from '../../../composables/backRegistry'
import ListCell from '../../ui/ListCell.vue'
import ToggleSwitch from '../../ui/ToggleSwitch.vue'
import AppNavBar from '../../ui/AppNavBar.vue'
import SettingsSearchBar from '../../ui/SettingsSearchBar.vue'
import SettingsSystemIcon from '../../ui/SettingsSystemIcon.vue'
import SettingsNotifications from './SettingsNotifications.vue'
import SettingsSound from './SettingsSound.vue'
import SettingsDND from './SettingsDND.vue'
import SettingsPrayer from './SettingsPrayer.vue'
import { usePrayerStore } from '../../../stores/prayerStore'
import { useNotificationsStore } from '../../../stores/notificationsStore'
import { useI18nStore } from '../../../stores/i18nStore'
import { GLYPHS } from '../../../assets/icons/glyphs'
import { clamp } from '../../../utils/math'

/**
 * 设置：8组规范卡片 + 底部悬浮搜索控件 + 二级页完整导航。
 * 完全对齐 Infinix GT 50 Pro 最新录屏分组、文案、字号层级与圆角规范。
 */
const props = defineProps({ app: Object })
const control = useControlStore()
const prayerStore = usePrayerStore()
const notificationsStore = useNotificationsStore()
const i18n = useI18nStore()
const { timeShort } = useClock()

/* 内部导航栈：支持从礼拜卡片、通知灵动岛直接深链跳转 */
let initialStack = ['main']
if (prayerStore.targetView === 'prayer') {
  initialStack = ['main', 'sound', 'prayer']
  prayerStore.setTargetView('main')
} else if (notificationsStore.targetView === 'notifications') {
  initialStack = ['main', 'notifications']
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

watch(
  () => notificationsStore.targetView,
  (newTarget) => {
    if (newTarget === 'notifications') {
      isBack.value = false
      stack.value = ['main', 'notifications']
    }
  }
)

const placeholderTitle = ref('')
function pushUnimplemented(name) {
  placeholderTitle.value = name
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

/* 全局侧滑返回：子页 → 首页逐层消费 */
const notifRef = ref(null)
const prayerRef = ref(null)
useBackHandler(() => {
  if (view.value === 'prayer' && prayerRef.value?.back()) return true
  if (view.value === 'notifications' && notifRef.value?.back()) return true
  if (stack.value.length > 1) { pop(); return true }
  return false
})

const viewTitles = computed(() => ({
  wifi: i18n.t('wifi') || 'WLAN',
  display: i18n.t('displayAndBrightness') || '显示与亮度',
  general: '系统',
  notifications: i18n.t('notifications') || '通知与状态栏',
  sound: i18n.t('soundAndVibration') || '声音与振动',
  dnd: i18n.t('dnd') || '勿扰模式',
  prayer: i18n.t('prayerDnd') || '礼拜模式',
  placeholder: placeholderTitle.value || '设置'
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

const networks = ['Ricky_5G', 'Office_5G', 'Tencent-Guest', 'CoffeeLab_2.4G']

/* 搜索功能 */
const searchQuery = ref('')
const searchActive = ref(false)

const allSearchableItems = [
  { id: 'flight', title: '飞行模式', group: '网络与连接', action: () => {}, isToggle: true },
  { id: 'sim', title: 'SIM卡与网络设置', group: '网络与连接', action: () => pushUnimplemented('SIM卡与网络设置') },
  { id: 'wifi', title: 'WLAN', group: '网络与连接', value: 'Ricky_5G', action: () => push('wifi') },
  { id: 'bluetooth', title: '蓝牙', group: '网络与连接', action: () => pushUnimplemented('蓝牙') },
  { id: 'multiDevice', title: '多设备连接', group: '网络与连接', action: () => pushUnimplemented('多设备连接') },
  { id: 'infinixAi', title: 'Infinix AI', group: '特色功能', action: () => pushUnimplemented('Infinix AI') },
  { id: 'wallpaper', title: '壁纸与个性化', group: '个性化', action: () => pushUnimplemented('壁纸与个性化') },
  { id: 'display', title: '显示与亮度', group: '显示', action: () => push('display') },
  { id: 'sound', title: '声音与振动', group: '声音', action: () => push('sound') },
  { id: 'notifications', title: '通知与状态栏', group: '通知', action: () => push('notifications') },
  { id: 'security', title: '密码与安全', group: '安全与隐私', action: () => pushUnimplemented('密码与安全') },
  { id: 'privacy', title: '权限与隐私', group: '安全与隐私', action: () => pushUnimplemented('权限与隐私') },
  { id: 'appManage', title: '应用管理', group: '应用', action: () => pushUnimplemented('应用管理') },
  { id: 'location', title: '位置信息', group: '安全与隐私', action: () => pushUnimplemented('位置信息') },
  { id: 'gtZone', title: 'GT Zone', group: '特色功能', action: () => pushUnimplemented('GT Zone') },
  { id: 'accessibility', title: '辅助功能', group: '系统', action: () => pushUnimplemented('辅助功能') },
  { id: 'battery', title: '电池与省电', group: '电量', action: () => pushUnimplemented('电池与省电') },
  { id: 'storage', title: '存储', group: '系统', action: () => pushUnimplemented('存储') },
  { id: 'digitalHealth', title: '数字健康与家长控制', group: '数字健康', action: () => pushUnimplemented('数字健康与家长控制') },
  { id: 'emergency', title: '安全和紧急情况', group: '安全', action: () => pushUnimplemented('安全和紧急情况') },
  { id: 'account', title: '用户与账号', group: '账号', action: () => pushUnimplemented('用户与账号') },
  { id: 'google', title: 'Google', group: '服务', action: () => pushUnimplemented('Google') },
  { id: 'system', title: '系统', group: '系统', action: () => push('general') }
]

const filteredSearchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return allSearchableItems.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.group.toLowerCase().includes(q)
  )
})
</script>

<template>
  <div class="settings-app">
    <Transition :name="isBack ? 'slide-back' : 'slide'" mode="out-in">
      <!-- ================= 首页 ================= -->
      <div v-if="view === 'main'" key="main" class="settings-page">
        <div class="settings-scroll-container scrollable">
          <!-- 顶部大标题 -->
          <div class="large-title">设置</div>

          <!-- 搜索结果列表（当有输入时激活） -->
          <div v-if="searchQuery.trim()" class="search-results-wrap">
            <div class="search-results-header">
              搜索结果 ({{ filteredSearchResults.length }})
            </div>
            <div v-if="filteredSearchResults.length > 0" class="settings-card">
              <ListCell
                v-for="(item, idx) in filteredSearchResults"
                :key="item.id"
                :title="item.title"
                :subtitle="item.group"
                :value="item.value"
                :chevron="!item.isToggle"
                :last="idx === filteredSearchResults.length - 1"
                @click="item.action()"
              >
                <template v-if="item.isToggle" #right>
                  <ToggleSwitch v-model="control.airplane" />
                </template>
              </ListCell>
            </div>
            <div v-else class="search-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>未找到相关设置</span>
            </div>
          </div>

          <!-- 默认标准 8 组卡片列表 -->
          <template v-else>
            <!-- ================= 卡片 1: 个人账号卡 ================= -->
            <div class="settings-card account-card" @click="pushUnimplemented('Ricky 账号')">
              <div class="account-avatar">
                <svg width="34" height="34" viewBox="0 0 44 44" fill="none">
                  <path d="M16 6C26 12 30 28 20 40C34 38 42 26 36 12C31 3 20 4 16 6Z" fill="white" fill-opacity="0.32" />
                  <path d="M12 14C20 20 23 34 16 42C28 40 36 30 30 18C25 9 17 11 12 14Z" fill="white" fill-opacity="0.55" />
                </svg>
              </div>
              <div class="account-info">
                <div class="account-name">Ricky</div>
                <div class="account-sub">使用云服务、查找等</div>
              </div>
              <svg class="chevron-icon" width="8" height="13" viewBox="0 0 8 13">
                <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>

            <!-- ================= 卡片 2: 手机型号卡 ================= -->
            <div class="settings-card single-item-card" @click="push('general')">
              <div class="device-item">
                <div class="squircle-icon bg-device">
                  <SettingsSystemIcon name="device" :size="20" />
                </div>
                <span class="device-title">Infinix GT 50 Pro</span>
              </div>
              <svg class="chevron-icon" width="8" height="13" viewBox="0 0 8 13">
                <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>

            <!-- ================= 卡片 3: 网络与连接 (5项) ================= -->
            <div class="settings-card">
              <!-- 飞行模式 -->
              <ListCell title="飞行模式">
                <template #icon>
                  <div class="squircle-icon bg-airplane">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                      <path :d="GLYPHS.airplane" />
                    </svg>
                  </div>
                </template>
                <template #right>
                  <ToggleSwitch v-model="control.airplane" />
                </template>
              </ListCell>

              <!-- SIM卡与网络设置 -->
              <ListCell title="SIM卡与网络设置" chevron @click="pushUnimplemented('SIM卡与网络设置')">
                <template #icon>
                  <div class="squircle-icon bg-sim">
                    <SettingsSystemIcon name="sim" />
                  </div>
                </template>
              </ListCell>

              <!-- WLAN -->
              <ListCell title="WLAN" value="Ricky_5G" chevron @click="push('wifi')">
                <template #icon>
                  <div class="squircle-icon bg-wifi">
                    <SettingsSystemIcon name="wifi" />
                  </div>
                </template>
              </ListCell>

              <!-- 蓝牙 -->
              <ListCell title="蓝牙" chevron @click="pushUnimplemented('蓝牙')">
                <template #icon>
                  <div class="squircle-icon bg-bluetooth">
                    <SettingsSystemIcon name="bluetooth" />
                  </div>
                </template>
              </ListCell>

              <!-- 多设备连接 -->
              <ListCell title="多设备连接" chevron last @click="pushUnimplemented('多设备连接')">
                <template #icon>
                  <div class="squircle-icon bg-multidevice">
                    <SettingsSystemIcon name="multi-device" :size="19" />
                  </div>
                </template>
              </ListCell>
            </div>

            <!-- ================= 卡片 4: AI、个性化与视听通知 (5项) ================= -->
            <div class="settings-card">
              <!-- Infinix AI -->
              <ListCell title="Infinix AI" chevron @click="pushUnimplemented('Infinix AI')">
                <template #icon>
                  <div class="squircle-icon bg-infinix-ai">
                    <SettingsSystemIcon name="ai" :size="19" />
                  </div>
                </template>
              </ListCell>

              <!-- 壁纸与个性化 -->
              <ListCell title="壁纸与个性化" chevron @click="pushUnimplemented('壁纸与个性化')">
                <template #icon>
                  <div class="squircle-icon bg-wallpaper">
                    <SettingsSystemIcon name="wallpaper" :size="19" />
                  </div>
                </template>
              </ListCell>

              <!-- 显示与亮度 -->
              <ListCell title="显示与亮度" chevron @click="push('display')">
                <template #icon>
                  <div class="squircle-icon bg-display">
                    <SettingsSystemIcon name="display" />
                  </div>
                </template>
              </ListCell>

              <!-- 声音与振动 -->
              <ListCell title="声音与振动" chevron @click="push('sound')">
                <template #icon>
                  <div class="squircle-icon bg-sound">
                    <SettingsSystemIcon name="sound" />
                  </div>
                </template>
              </ListCell>

              <!-- 通知与状态栏 -->
              <ListCell title="通知与状态栏" chevron last @click="push('notifications')">
                <template #icon>
                  <div class="squircle-icon bg-notifications">
                    <div class="notif-bell-wrap">
                      <SettingsSystemIcon name="notifications" />
                      <span class="red-badge-dot"></span>
                    </div>
                  </div>
                </template>
              </ListCell>
            </div>

            <!-- ================= 卡片 5: 安全与隐私 (4项) ================= -->
            <div class="settings-card">
              <!-- 密码与安全 -->
              <ListCell title="密码与安全" chevron @click="pushUnimplemented('密码与安全')">
                <template #icon>
                  <div class="squircle-icon bg-security">
                    <SettingsSystemIcon name="security" />
                  </div>
                </template>
              </ListCell>

              <!-- 权限与隐私 -->
              <ListCell title="权限与隐私" chevron @click="pushUnimplemented('权限与隐私')">
                <template #icon>
                  <div class="squircle-icon bg-privacy">
                    <SettingsSystemIcon name="privacy" />
                  </div>
                </template>
              </ListCell>

              <!-- 应用管理 -->
              <ListCell title="应用管理" chevron @click="pushUnimplemented('应用管理')">
                <template #icon>
                  <div class="squircle-icon bg-apps">
                    <SettingsSystemIcon name="apps" />
                  </div>
                </template>
              </ListCell>

              <!-- 位置信息 -->
              <ListCell title="位置信息" chevron last @click="pushUnimplemented('位置信息')">
                <template #icon>
                  <div class="squircle-icon bg-location">
                    <SettingsSystemIcon name="location" />
                  </div>
                </template>
              </ListCell>
            </div>

            <!-- ================= 卡片 6: 系统特色与性能 (4项) ================= -->
            <div class="settings-card">
              <!-- GT Zone -->
              <ListCell title="GT Zone" chevron @click="pushUnimplemented('GT Zone')">
                <template #icon>
                  <div class="squircle-icon bg-gt">
                    <span class="gt-badge">GT</span>
                  </div>
                </template>
              </ListCell>

              <!-- 辅助功能 -->
              <ListCell title="辅助功能" chevron @click="pushUnimplemented('辅助功能')">
                <template #icon>
                  <div class="squircle-icon bg-accessibility">
                    <SettingsSystemIcon name="accessibility" />
                  </div>
                </template>
              </ListCell>

              <!-- 电池与省电 -->
              <ListCell title="电池与省电" chevron @click="pushUnimplemented('电池与省电')">
                <template #icon>
                  <div class="squircle-icon bg-battery">
                    <SettingsSystemIcon name="battery" :size="19" />
                  </div>
                </template>
              </ListCell>

              <!-- 存储 -->
              <ListCell title="存储" chevron last @click="pushUnimplemented('存储')">
                <template #icon>
                  <div class="squircle-icon bg-storage">
                    <SettingsSystemIcon name="storage" />
                  </div>
                </template>
              </ListCell>
            </div>

            <!-- ================= 卡片 7: 数字健康与账号 (4项) ================= -->
            <div class="settings-card">
              <!-- 数字健康与家长控制 -->
              <ListCell title="数字健康与家长控制" chevron @click="pushUnimplemented('数字健康与家长控制')">
                <template #icon>
                  <div class="squircle-icon bg-health">
                    <SettingsSystemIcon name="health" />
                  </div>
                </template>
              </ListCell>

              <!-- 安全和紧急情况 -->
              <ListCell title="安全和紧急情况" chevron @click="pushUnimplemented('安全和紧急情况')">
                <template #icon>
                  <div class="squircle-icon bg-emergency">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">
                      <line x1="12" y1="3" x2="12" y2="21" />
                      <line x1="4.2" y1="7.5" x2="19.8" y2="16.5" />
                      <line x1="4.2" y1="16.5" x2="19.8" y2="7.5" />
                    </svg>
                  </div>
                </template>
              </ListCell>

              <!-- 用户与账号 -->
              <ListCell title="用户与账号" chevron @click="pushUnimplemented('用户与账号')">
                <template #icon>
                  <div class="squircle-icon bg-user">
                    <SettingsSystemIcon name="user" />
                  </div>
                </template>
              </ListCell>

              <!-- Google -->
              <ListCell title="Google" chevron last @click="pushUnimplemented('Google')">
                <template #icon>
                  <div class="squircle-icon bg-google">
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                </template>
              </ListCell>
            </div>

            <!-- ================= 卡片 8: 系统 (1项) ================= -->
            <div class="settings-card single-item-card" @click="push('general')">
              <div class="device-item">
                <div class="squircle-icon bg-system">
                  <SettingsSystemIcon name="system" :size="19" />
                </div>
                <span class="device-title">系统</span>
              </div>
              <svg class="chevron-icon" width="8" height="13" viewBox="0 0 8 13">
                <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
          </template>

          <!-- 列表底部安全留白（让最后一项可滚到浮动搜索栏上方） -->
          <div class="scroll-bottom-spacer"></div>
        </div>

        <!-- ================= 底部悬浮搜索栏控件 ================= -->
        <div class="settings-floating-search">
          <SettingsSearchBar
            v-model="searchQuery"
            placeholder="搜索"
            @focus="searchActive = true"
            @blur="searchActive = false"
            @clear="searchQuery = ''"
          />
        </div>
      </div>

      <!-- ================= 声音与振动 ================= -->
      <div v-else-if="view === 'sound'" key="sound" class="settings-page">
        <SettingsSound @back="pop" @open-dnd="push('dnd')" @open-prayer="push('prayer')" />
      </div>

      <!-- ================= 勿扰模式 (含礼拜模式入口) ================= -->
      <div v-else-if="view === 'dnd'" key="dnd" class="settings-page">
        <SettingsDND @back="pop" @open-prayer="push('prayer')" />
      </div>

      <!-- ================= 礼拜模式 ================= -->
      <div v-else-if="view === 'prayer'" key="prayer" class="settings-page">
        <SettingsPrayer ref="prayerRef" @back="pop" @back-to-dnd="pop" />
      </div>

      <!-- ================= 通知与状态栏 (含礼拜灵动岛与闹钟联动设置) ================= -->
      <div v-else-if="view === 'notifications'" key="notifications" class="settings-page">
        <SettingsNotifications ref="notifRef" @back-to-settings="pop" />
      </div>

      <!-- ================= 其他二级页 ================= -->
      <div v-else :key="view" class="settings-page">
        <AppNavBar :title="viewTitles[view]" :back-label="'设置'" @back="pop" />

        <!-- 未实现页面的优雅占位 -->
        <div v-if="view === 'placeholder'" class="scrollable detail-body">
          <div class="placeholder-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2.5" />
            </svg>
          </div>
          <div class="placeholder-title">{{ placeholderTitle }}</div>
          <div class="placeholder-note">该功能在当前原型版本中已收录，正在接入系统底层服务。</div>
        </div>

        <!-- 无线局域网 -->
        <div v-else-if="view === 'wifi'" class="scrollable detail-body">
          <div class="settings-card">
            <ListCell glyph="wifi" icon-bg="#0088FF" title="WLAN" last>
              <template #right><ToggleSwitch v-model="control.wifi" /></template>
            </ListCell>
          </div>
          <template v-if="control.wifi">
            <div class="group-header">当前网络</div>
            <div class="settings-card">
              <ListCell title="Ricky_5G" last>
                <template #right>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path :d="GLYPHS.check" fill="#007AFF" /></svg>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path :d="GLYPHS.info" fill="#C7C7CC" /></svg>
                </template>
              </ListCell>
            </div>
            <div class="group-header">其他网络</div>
            <div class="settings-card">
              <ListCell v-for="(n, i) in networks.slice(1)" :key="n" :title="n" :last="i === networks.length - 2">
                <template #right>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path :d="GLYPHS.lock" fill="#C7C7CC" /></svg>
                </template>
              </ListCell>
            </div>
          </template>
          <div v-else class="empty-note">已关闭 WLAN</div>
        </div>

        <!-- 显示与亮度 -->
        <div v-else-if="view === 'display'" class="scrollable detail-body">
          <div class="group-header">外观</div>
          <div class="appearance-row">
            <div class="appearance-card selected">
              <div class="appearance-preview light"></div>
              <span>浅色模式</span>
            </div>
            <div class="appearance-card">
              <div class="appearance-preview dark"></div>
              <span>深色模式</span>
            </div>
          </div>
          <div class="group-header">亮度</div>
          <div class="settings-card brightness-card">
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
          <div class="settings-card">
            <ListCell title="护眼模式">
              <template #right><ToggleSwitch :model-value="true" /></template>
            </ListCell>
            <ListCell title="自适应刷新率" value="144Hz" chevron last />
          </div>
        </div>

        <!-- 系统与关于手机 -->
        <div v-else class="scrollable detail-body">
          <div class="settings-card">
            <ListCell title="关于手机" value="Infinix GT 50 Pro" chevron />
            <ListCell title="系统更新" value="tOS 16.0 最新版" last />
          </div>
          <div class="group-header">硬件与规格</div>
          <div class="settings-card">
            <ListCell title="处理器" value="Dimensity 9300+" />
            <ListCell title="运行内存" value="16 GB + 12 GB 扩展" />
            <ListCell title="机身存储" value="184 GB / 512 GB" last />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.settings-app {
  height: 100%;
  background: #F4F5F7;
  overflow: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.settings-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.settings-scroll-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

/* ================= 顶层大标题 ================= */
.large-title {
  font-size: 28px;
  font-weight: 700;
  color: #111111;
  padding: calc(var(--safe-top, 20px) + 16px) 20px 14px 20px;
  letter-spacing: -0.5px;
}

/* ================= 统一卡片规范 ================= */
.settings-card {
  margin: 0 16px 12px 16px;
  background: #FFFFFF;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

/* 个人账号卡 */
.account-card {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.account-card:active {
  background: #F2F2F7;
}

.account-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00D2FF 0%, #0076FF 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  box-shadow: 0 3px 10px rgba(0, 118, 255, 0.25);
}

.account-info {
  flex: 1;
  min-width: 0;
}

.account-name {
  font-size: 17px;
  font-weight: 600;
  color: #111111;
  line-height: 1.3;
}

.account-sub {
  font-size: 13px;
  color: #8E8E93;
  margin-top: 3px;
  line-height: 1.2;
}

/* 单项卡（机型卡与系统卡） */
.single-item-card {
  padding: 13px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  min-height: 58px;
  box-sizing: border-box;
}
.single-item-card:active {
  background: #F2F2F7;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 14px;
}

.device-title {
  font-size: 15.5px;
  font-weight: 450;
  color: #111111;
}

.chevron-icon {
  flex: none;
}

/* ================= 统一 Squircle 图标规范 ================= */
.squircle-icon {
  width: 36px;
  height: 36px;
  border-radius: 10.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin-right: 14px;
}

.bg-device { background: #00C853; }
.bg-airplane { background: #FFA000; }
.bg-sim { background: #22C55E; }
.bg-wifi { background: #0088FF; }
.bg-bluetooth { background: #0088FF; }
.bg-multidevice { background: #10B981; }

.bg-infinix-ai { background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #EC4899 100%); }
.bg-wallpaper { background: #F43F5E; }
.bg-display { background: #F59E0B; }
.bg-sound { background: #EF4444; }
.bg-notifications { background: #8E9AA8; }

.bg-security { background: #8E95A5; }
.bg-privacy { background: #2563EB; }
.bg-apps { background: #8E95A5; }
.bg-location { background: #0EA5E9; }

.bg-gt { background: #222226; }
.gt-badge {
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: -0.5px;
}

.bg-accessibility { background: #EF4444; }
.bg-battery { background: #22C55E; }
.bg-storage { background: #3B82F6; }

.bg-health { background: #4ADE80; }
.bg-emergency { background: #EF4444; }
.bg-user { background: #22C55E; }
.bg-google {
  background: #FFFFFF;
  border: 0.5px solid #E5E7EB;
  box-sizing: border-box;
}

.bg-system { background: #6B7280; }

.notif-bell-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.red-badge-dot {
  position: absolute;
  top: -1px;
  right: -2px;
  width: 6.5px;
  height: 6.5px;
  border-radius: 50%;
  background: #FF3B30;
  border: 1px solid #8E9AA8;
}

/* ================= 底部悬浮搜索栏 ================= */
.settings-floating-search {
  position: absolute;
  bottom: 20px;
  left: 16px;
  right: 16px;
  z-index: 10;
  pointer-events: auto;
}

.scroll-bottom-spacer {
  height: 86px;
  width: 100%;
  flex: none;
}

/* ================= 搜索结果面板 ================= */
.search-results-wrap {
  margin-top: 4px;
}
.search-results-header {
  font-size: 13px;
  color: #8E8E93;
  margin: 0 20px 8px;
  font-weight: 500;
}
.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: #8E8E93;
  font-size: 14px;
}

/* ================= 极速丝滑进退动画 ================= */
.slide-enter-active,
.slide-back-enter-active {
  transition: transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.16s ease;
}
.slide-leave-active,
.slide-back-leave-active {
  transition: transform 0.12s cubic-bezier(0.4, 0, 1, 1), opacity 0.12s ease;
}

.slide-enter-from {
  transform: translateX(36px);
  opacity: 0;
}
.slide-enter-to {
  transform: translateX(0);
  opacity: 1;
}
.slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}
.slide-leave-to {
  transform: translateX(-24px);
  opacity: 0;
}

.slide-back-enter-from {
  transform: translateX(-24px);
  opacity: 0;
}
.slide-back-enter-to {
  transform: translateX(0);
  opacity: 1;
}
.slide-back-leave-from {
  transform: translateX(0);
  opacity: 1;
}
.slide-back-leave-to {
  transform: translateX(36px);
  opacity: 0;
}

/* ================= 二级页通用样式 ================= */
.group-header {
  font-size: 13px;
  color: #8E8E93;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin: 14px 20px 7px;
  font-weight: 500;
}
.detail-body {
  flex: 1;
  padding-top: 10px;
}
.empty-note {
  text-align: center;
  color: #8E8E93;
  font-size: 14px;
  margin-top: 40px;
}

.placeholder-icon {
  display: flex;
  justify-content: center;
  margin-top: 60px;
  margin-bottom: 16px;
}
.placeholder-title {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: #111111;
  margin-bottom: 8px;
}
.placeholder-note {
  text-align: center;
  color: #8E8E93;
  font-size: 14px;
  padding: 0 40px;
  line-height: 1.6;
}

/* 外观模式 */
.appearance-row {
  display: flex;
  gap: 14px;
  margin: 0 16px 12px;
}
.appearance-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: #111111;
}
.appearance-preview {
  width: 100%;
  height: 100px;
  border-radius: 14px;
  border: 2.5px solid transparent;
}
.appearance-preview.light {
  background: linear-gradient(180deg, #FFFFFF 60%, #E9E9EB 60%);
}
.appearance-preview.dark {
  background: linear-gradient(180deg, #1C1C1E 60%, #3A3A3C 60%);
}
.appearance-card.selected .appearance-preview {
  border-color: #007AFF;
  box-shadow: 0 2px 10px rgba(0, 122, 255, 0.25);
}

/* 亮度滑块 */
.brightness-card {
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
  background: #FFFFFF;
  border-radius: 14px;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.1);
}
</style>
