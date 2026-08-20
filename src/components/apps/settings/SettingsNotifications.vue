<script setup>
import { ref } from 'vue'
import ToggleSwitch from '../../ui/ToggleSwitch.vue'
import SettingsAppIcon from '../../ui/SettingsAppIcon.vue'
import AppIcon from '../../ui/AppIcon.vue'
import { getApp } from '../../../config/apps'

/**
 * 通知设置页（完整移植自 settingsprototype.tsx）：
 * 主视图（状态栏/控制中心/Dynamic Bar、通知类型三卡片、锁屏隐藏内容/智能提醒/轻打扰、
 * 按发送时间排序、10 个应用开关列表）+ 锁屏通知子页（堆叠/数量样式）+ 悬浮通知子页 + 应用详情子页。
 * 内部独立子栈，通过 expose().back 支持全局侧滑返回逐层退出。
 *
 * 应用图标：完全继承 settingsprototype.tsx 原 AppIcon（SettingsAppIcon），保持与原代码一致。
 */

/* ---------- 子视图栈 ---------- */
const subView = ref('main')
function go(v) { subView.value = v }
function back() {
  if (subView.value !== 'main') { subView.value = 'main'; return true }
  return false
}
defineExpose({ back })

/* ---------- 状态（照搬 TSX） ---------- */
const globalHideLockContent = ref(false)
const localHideLockContent = ref(false)
const smartReminder = ref(true)
const adaptiveNotif = ref(true)
const lockScreenStyle = ref('stacked')
const onlyNewOnLock = ref(false)
const conciseFloating = ref(true)
const antiPeepFloating = ref(true)

const appStates = ref({
  transsioner: true, clock: true, google: true, phone: true, sms: true,
  bilibili: true, map: true, dingdong: true, douyin1: true, douyin2: true,
  amap: true, switcher: true, notepad: true, search: true
})
function toggleAppState(id) { appStates.value[id] = !appStates.value[id] }

const appToggles = ref({ allow: true, badge: true, floating: true, lockScreen: true, ring: true, vibrate: true })
function toggleAppSetting(key) { appToggles.value[key] = !appToggles.value[key] }

const appListData = [
  { id: 'transsioner', name: 'Transsioner', time: '65分钟前', type: 'transsioner' },
  { id: 'clock', name: '时钟', time: '3小时前', type: 'clock' },
  { id: 'google', name: 'Google', time: '11小时前', type: 'google' },
  { id: 'phone', name: '电话', time: '24小时前', type: 'phone' },
  { id: 'sms', name: '短信', time: '43小时前', type: 'sms' },
  { id: 'bilibili', name: '哔哩哔哩', time: '昨天', type: 'bilibili' },
  { id: 'map', name: '地图', time: '昨天', type: 'map' },
  { id: 'dingdong', name: '叮咚买菜', time: '星期二', type: 'dingdong' },
  { id: 'douyin1', name: '抖音', time: '星期二', type: 'douyin' },
  { id: 'douyin2', name: '抖音精选', time: '星期一', type: 'douyin' }
]
const lockScreenAppListData = appListData.slice(5)
const floatingAppListData = [
  { id: 'bilibili', name: '哔哩哔哩', type: 'bilibili' },
  { id: 'map', name: '地图', type: 'map' },
  { id: 'dingdong', name: '叮咚买菜', type: 'dingdong' },
  { id: 'douyin1', name: '抖音', type: 'douyin' },
  { id: 'douyin2', name: '抖音精选', type: 'douyin' },
  { id: 'sms', name: '短信', type: 'sms' },
  { id: 'amap', name: '高德地图', type: 'map' },
  { id: 'switcher', name: '换机助手', type: 'transsioner' },
  { id: 'notepad', name: '记事本', type: 'transsioner' },
  { id: 'search', name: '搜索', type: 'transsioner' }
]

const appIdMap = {
  sms: 'messages'
}
function getDesktopApp(id) {
  const realId = appIdMap[id] || id
  return getApp(realId)
}

const emit = defineEmits(['back-to-settings'])
</script>

<template>
  <div class="notif-settings">
    <!-- ============ 主视图 ============ -->
    <Transition name="fade" mode="out-in">
      <div v-if="subView === 'main'" key="main" class="ns-page scrollable">
        <div class="ns-sticky">
          <button class="ns-back" @click="emit('back-to-settings')">
            <svg width="13" height="20" viewBox="0 0 8 13"><path d="M6.5 0.5 1 6.5l5.5 6" fill="none" stroke="#007AFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <span>通知</span>
          </button>
        </div>

        <div class="ns-section mt-first">
          <div class="ns-row" :arrow="true"><span class="ns-row-title">状态栏</span><svg class="chev" width="8" height="13" viewBox="0 0 8 13"><path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" /></svg></div>
          <div class="ns-row"><span class="ns-row-title">控制中心</span><svg class="chev" width="8" height="13" viewBox="0 0 8 13"><path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" /></svg></div>
          <div class="ns-row last"><span class="ns-row-title">Dynamic Bar</span><svg class="chev" width="8" height="13" viewBox="0 0 8 13"><path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" /></svg></div>
        </div>

        <div class="ns-group-label">通知类型</div>
        <div class="ns-type-cards">
          <div class="ns-type-card" @click="go('lockScreen')">
            <div class="phone-mini">
              <span class="pm-time">09:26</span>
              <div class="pm-bars"><i class="pm-bg"></i><i class="pm-green"></i></div>
            </div>
            <span class="pm-label">锁屏通知</span>
          </div>
          <div class="ns-type-card" @click="go('floatingScreen')">
            <div class="phone-mini">
              <span class="pm-green pm-top"></span>
            </div>
            <span class="pm-label">悬浮通知</span>
          </div>
          <div class="ns-type-card">
            <div class="phone-mini pm-grid-wrap">
              <div class="pm-grid">
                <i v-for="i in 16" :key="i" class="pm-cell" :class="{ badge: i === 3 }"></i>
              </div>
            </div>
            <span class="pm-label">桌面角标</span>
          </div>
        </div>

        <div class="ns-section">
          <div class="ns-row">
            <div class="ns-row-text">
              <span class="ns-row-title">锁屏隐藏通知内容</span>
              <span class="ns-row-sub">未解锁时收到通知，隐藏通知内容。</span>
            </div>
            <ToggleSwitch v-model="globalHideLockContent" />
          </div>
          <div class="ns-row">
            <div class="ns-row-text">
              <div class="ns-row-title-wrap"><span class="ns-row-title">智能提醒</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01" stroke-linecap="round"/></svg></div>
              <span class="ns-row-sub">开启后，将自动把不重要通知设为静音。</span>
            </div>
            <ToggleSwitch v-model="smartReminder" />
          </div>
          <div class="ns-row last">
            <div class="ns-row-text">
              <div class="ns-row-title-wrap"><span class="ns-row-title">通知轻打扰</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01" stroke-linecap="round"/></svg></div>
              <span class="ns-row-sub">全屏或短时间收到多条通知时自动降低音量。</span>
            </div>
            <ToggleSwitch v-model="adaptiveNotif" />
          </div>
        </div>

        <div class="ns-group-label">按发送时间排序
          <span class="ns-sort"><i></i><i></i></span>
        </div>
        <div class="ns-section">
          <div
            v-for="(app, index) in appListData"
            :key="app.id"
            class="ns-row app-row"
            :class="{ last: index === appListData.length - 1, tappable: app.id === 'transsioner' }"
            @click="app.id === 'transsioner' && go('appDetail')"
          >
            <div class="ns-app">
              <!-- 应用图标：优先映射桌面对应图标 -->
              <AppIcon v-if="getDesktopApp(app.id)" :app="getDesktopApp(app.id)" :size="36" :show-label="false" />
              <SettingsAppIcon v-else :type="app.type" :size="36" />
              <div class="ns-app-info">
                <span class="ns-app-name">{{ app.name }}</span>
                <span class="ns-app-time">{{ app.time }}</span>
              </div>
            </div>
            <ToggleSwitch :model-value="appStates[app.id]" @update:modelValue="toggleAppState(app.id)" />
          </div>
        </div>
      </div>

      <!-- ============ 锁屏通知子页 ============ -->
      <div v-else-if="subView === 'lockScreen'" key="lock" class="ns-page scrollable">
        <div class="ns-sticky">
          <button class="ns-back" @click="back()">
            <svg width="13" height="20" viewBox="0 0 8 13"><path d="M6.5 0.5 1 6.5l5.5 6" fill="none" stroke="#007AFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <span>返回</span>
          </button>
        </div>

        <div class="ns-group-label">锁屏通知样式</div>
        <div class="ns-style-cards">
          <div class="ns-style-card" :class="{ active: lockScreenStyle === 'stacked' }" @click="lockScreenStyle = 'stacked'">
            <div class="phone-big">
              <span class="pb-time">09:26</span>
              <div class="pb-bars"><i class="pb-bg"></i><i class="pb-green"></i></div>
            </div>
            <span class="pb-label">堆叠</span>
            <span class="pb-radio" :class="{ on: lockScreenStyle === 'stacked' }"></span>
          </div>
          <div class="ns-style-card" :class="{ active: lockScreenStyle === 'number' }" @click="lockScreenStyle = 'number'">
            <div class="phone-big">
              <span class="pb-time">09:26</span>
              <span class="pb-count"><svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>4 条通知</span>
            </div>
            <span class="pb-label">数量</span>
            <span class="pb-radio" :class="{ on: lockScreenStyle === 'number' }"></span>
          </div>
        </div>

        <div class="ns-section">
          <div class="ns-row">
            <div class="ns-row-text">
              <span class="ns-row-title">通知亮屏提醒</span>
              <span class="ns-row-sub">息屏状态下，收到允许在锁屏显示的新通知时自动亮屏。</span>
            </div>
            <span class="ns-value">已开启</span>
          </div>
          <div class="ns-row last">
            <div class="ns-row-text">
              <span class="ns-row-title">锁屏仅显示新通知</span>
              <span class="ns-row-sub">看过的通知将不在锁屏显示。</span>
            </div>
            <ToggleSwitch v-model="onlyNewOnLock" />
          </div>
        </div>

        <div class="ns-group-label">已开启锁屏通知</div>
        <div class="ns-section">
          <div v-for="(app, index) in lockScreenAppListData" :key="app.id" class="ns-row app-row" :class="{ last: index === lockScreenAppListData.length - 1 }">
            <div class="ns-app">
              <AppIcon v-if="getDesktopApp(app.id)" :app="getDesktopApp(app.id)" :size="36" :show-label="false" />
              <SettingsAppIcon v-else :type="app.type" :size="36" />
              <span class="ns-app-name">{{ app.name }}</span>
            </div>
            <ToggleSwitch :model-value="appStates[app.id]" @update:modelValue="toggleAppState(app.id)" />
          </div>
        </div>
      </div>

      <!-- ============ 悬浮通知子页 ============ -->
      <div v-else-if="subView === 'floatingScreen'" key="float" class="ns-page scrollable">
        <div class="ns-sticky">
          <button class="ns-back" @click="back()">
            <svg width="13" height="20" viewBox="0 0 8 13"><path d="M6.5 0.5 1 6.5l5.5 6" fill="none" stroke="#007AFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <span>返回</span>
          </button>
          <span class="ns-page-title">悬浮通知</span>
        </div>

        <div class="ns-section mt4">
          <div class="ns-row"><span class="ns-row-title">悬浮通知样式</span><span class="ns-value gray">详细</span><svg class="chev" width="8" height="13" viewBox="0 0 8 13"><path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" /></svg></div>
          <div class="ns-row">
            <div class="ns-row-text"><span class="ns-row-title">全屏时使用简洁样式</span></div>
            <ToggleSwitch v-model="conciseFloating" />
          </div>
          <div class="ns-row last">
            <div class="ns-row-text">
              <span class="ns-row-title">悬浮通知防偷窥</span>
              <span class="ns-row-sub">检测到有人偷窥屏幕时自动隐藏通知内容。</span>
            </div>
            <ToggleSwitch v-model="antiPeepFloating" />
          </div>
        </div>

        <div class="ns-group-label">已开启悬浮通知权限</div>
        <div class="ns-section">
          <div v-for="(app, index) in floatingAppListData" :key="app.id" class="ns-row app-row" :class="{ last: index === floatingAppListData.length - 1 }">
            <div class="ns-app">
              <AppIcon v-if="getDesktopApp(app.id)" :app="getDesktopApp(app.id)" :size="36" :show-label="false" />
              <SettingsAppIcon v-else :type="app.type" :size="36" />
              <span class="ns-app-name">{{ app.name }}</span>
            </div>
            <div class="ns-app-right"><i class="ns-divider"></i><ToggleSwitch :model-value="appStates[app.id]" @update:modelValue="toggleAppState(app.id)" /></div>
          </div>
        </div>
      </div>

      <!-- ============ 应用详情子页 ============ -->
      <div v-else key="detail" class="ns-page scrollable">
        <div class="ns-sticky">
          <button class="ns-back" @click="back()">
            <svg width="13" height="20" viewBox="0 0 8 13"><path d="M6.5 0.5 1 6.5l5.5 6" fill="none" stroke="#007AFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
        </div>

        <div class="ns-app-hero">
          <SettingsAppIcon type="transsioner" :size="64" />
          <h1 class="ns-hero-title">Transsioner</h1>
        </div>

        <div class="ns-section">
          <div class="ns-row">
            <div class="ns-row-text"><span class="ns-row-title">允许通知</span></div>
            <ToggleSwitch v-model="appToggles.allow" />
          </div>
        </div>

        <template v-if="appToggles.allow">
          <div class="ns-section">
            <div class="ns-row"><span class="ns-row-title">提醒强度</span><span class="ns-value gray">智能提醒</span><svg class="chev" width="8" height="13" viewBox="0 0 8 13"><path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" /></svg></div>
            <div class="ns-row" :class="{ last: !globalHideLockContent }"><span class="ns-row-title">通知分组</span><span class="ns-value gray">自动</span><svg class="chev" width="8" height="13" viewBox="0 0 8 13"><path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2" stroke-linecap="round" /></svg></div>
            <div v-if="!globalHideLockContent" class="ns-row last">
              <div class="ns-row-text">
                <span class="ns-row-title">锁屏隐藏通知内容</span>
                <span class="ns-row-sub">未解锁时收到通知，隐藏通知内容。</span>
              </div>
              <ToggleSwitch v-model="localHideLockContent" />
            </div>
          </div>

          <div class="ns-group-label">提醒方式</div>
          <div class="ns-style-cards remind">
            <div class="ns-remind-card" :class="{ on: appToggles.lockScreen }" @click="toggleAppSetting('lockScreen')">
              <div class="phone-mini"><span class="pm-time">09:26</span><div class="pm-bars"><i class="pm-bg"></i><i class="pm-green"></i></div></div>
              <span class="pm-label">锁屏通知</span>
              <span class="pm-check" :class="{ on: appToggles.lockScreen }"><svg v-if="appToggles.lockScreen" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
            </div>
            <div class="ns-remind-card" :class="{ on: appToggles.floating }" @click="toggleAppSetting('floating')">
              <div class="phone-mini"><span class="pm-green pm-top"></span></div>
              <span class="pm-label">悬浮通知</span>
              <span class="pm-check" :class="{ on: appToggles.floating }"><svg v-if="appToggles.floating" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
            </div>
            <div class="ns-remind-card" :class="{ on: appToggles.badge }" @click="toggleAppSetting('badge')">
              <div class="phone-mini pm-grid-wrap"><div class="pm-grid"><i v-for="i in 16" :key="i" class="pm-cell" :class="{ badge: i === 3 }"></i></div></div>
              <span class="pm-label">桌面角标</span>
              <span class="pm-check" :class="{ on: appToggles.badge }"><svg v-if="appToggles.badge" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
            </div>
          </div>

          <div class="ns-section">
            <div class="ns-row">
              <div class="ns-row-text"><span class="ns-row-title">允许响铃</span></div>
              <ToggleSwitch v-model="appToggles.ring" />
            </div>
            <div class="ns-row last">
              <div class="ns-row-text"><span class="ns-row-title">振动</span></div>
              <ToggleSwitch v-model="appToggles.vibrate" />
            </div>
          </div>

          <div class="ns-group-label">通知类型</div>
          <div class="ns-section">
            <div class="ns-row last"><span class="ns-row-title">消息通知</span><span class="ns-value gray">重要</span></div>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notif-settings {
  height: 100%;
  background: #F2F2F7;
  overflow: hidden;
}
.ns-page {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 28px;
}
.ns-page::-webkit-scrollbar { display: none; }
.ns-page { scrollbar-width: none; }

/* 子页切换 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* 顶部返回条：sticky 吸顶覆盖整个顶部（含状态栏区），
   高度包含状态栏安全区，内容底部对齐，避免与状态栏重叠。 */
.ns-sticky {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(242, 242, 247, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  height: calc(var(--safe-top) + 44px);
  display: flex;
  align-items: flex-end;
  padding: 0 12px 6px;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12);
  gap: 4px;
}
.ns-back {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #007AFF;
  font: 500 17px/1 var(--font-stack);
  padding: 6px 6px;
  cursor: pointer;
}
.ns-back:active { opacity: 0.6; }
.ns-page-title {
  font: 600 17px/1 var(--font-stack);
  color: #1c1c1e;
  margin-left: 8px;
}

/* 分组标题 */
.ns-group-label {
  font: 400 13px/1.4 var(--font-stack);
  color: #8e8e93;
  padding: 20px 16px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ns-sort { display: flex; flex-direction: column; gap: 2px; margin-left: 4px; }
.ns-sort i {
  width: 0; height: 0;
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
}
.ns-sort i:first-child { border-bottom: 4px solid #8e8e93; opacity: 0.6; }
.ns-sort i:last-child { border-top: 4px solid #8e8e93; opacity: 0.6; }

/* 白卡片 */
.ns-section {
  margin: 0 16px 18px;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 0.5px 1px rgba(0, 0, 0, 0.05);
  padding: 4px 0;
}
.mt4 { margin-top: 14px; }
.mt-first { margin-top: 24px; }

/* 行：略紧凑，文字与开关统一缩小 */
.ns-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  padding: 0 16px;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.1);
  cursor: default;
}
.ns-row.last { border-bottom: none; }
.ns-row-title {
  font: 400 15px/1.25 var(--font-stack);
  color: #1c1c1e;
  letter-spacing: 0.1px;
}
.ns-row-sub {
  font: 400 12px/1.4 var(--font-stack);
  color: #8e8e93;
  margin-top: 3px;
  display: block;
}
.ns-row-title-wrap { display: flex; align-items: center; gap: 5px; }
.ns-value { font: 400 14px/1 var(--font-stack); color: #8e8e93; flex: none; }
.ns-value.gray { color: #c7c7cc; margin-right: 3px; }
.chev { flex: none; }
.tappable { cursor: pointer; }
.tappable:active { background: #f2f2f7; }

/* 应用行 */
.app-row { min-height: 52px; padding: 0 16px; cursor: default; }
.ns-app { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ns-app-info { display: flex; flex-direction: column; min-width: 0; }
.ns-app-name { font: 400 15px/1.2 var(--font-stack); color: #1c1c1e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ns-app-time { font: 400 12px/1.3 var(--font-stack); color: #8e8e93; margin-top: 2px; }
.ns-app-right { display: flex; align-items: center; }
.ns-divider { width: 1px; height: 20px; background: rgba(60, 60, 67, 0.12); margin-right: 16px; border-radius: 1px; }

/* 通知设置内开关缩小为紧凑尺寸（44×26） */
.notif-settings :deep(.toggle-switch) {
  width: 44px;
  height: 26px;
  border-radius: 13px;
}
.notif-settings :deep(.toggle-switch .knob) {
  width: 22px;
  height: 22px;
}
.notif-settings :deep(.toggle-switch.on .knob) {
  transform: translateX(18px);
}
.notif-settings :deep(.toggle-switch:active .knob) { width: 24px; }
.notif-settings :deep(.toggle-switch.on:active .knob) { transform: translateX(16px); }

/* 通知类型三卡片：增加边距与内部留白，避免拥挤 */
.ns-type-cards {
  display: flex;
  gap: 16px;
  padding: 0 16px 16px;
}
.ns-type-card {
  flex: 1;
  background: #fff;
  border-radius: 20px;
  padding: 20px 12px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-shadow: 0 0.5px 1px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: transform 0.12s ease;
}
.ns-type-card:active { transform: scale(0.96); background: #fafafa; }

/* 迷你手机预览 */
.phone-mini {
  width: 58px;
  height: 122px;
  border-radius: 14px;
  border: 3px solid #e5e5ea;
  background: #f8f9fa;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 14px;
}
.pm-time { font: 500 11px/1 var(--font-stack); color: #8e8e93; letter-spacing: 1px; margin-bottom: 10px; }
.pm-bars { position: absolute; bottom: 10px; display: flex; flex-direction: column; align-items: center; width: 100%; }
.pm-bg { position: absolute; bottom: -2.5px; width: 36px; height: 12px; background: #d1d1d6; border-radius: 3px; z-index: 0; }
.pm-green { position: relative; z-index: 1; width: 42px; height: 16px; background: #00D166; border-radius: 4px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); }
.pm-top { position: absolute; top: 8px; }
.pm-grid-wrap { justify-content: center; padding-top: 10px; }
.pm-grid { display: grid; grid-template-columns: repeat(4, 8px); gap: 3px; align-content: start; }
.pm-cell { width: 8px; height: 8px; background: #e5e5ea; border-radius: 2.5px; position: relative; }
.pm-cell.badge::after {
  content: '';
  position: absolute;
  top: -1.5px; right: -1.5px;
  width: 4px; height: 4px;
  background: #FF453A;
  border-radius: 50%;
  border: 1px solid #fff;
}
.pm-label { font: 400 13px/1 var(--font-stack); color: #3a3a3c; }

/* 锁屏样式选择 */
.ns-style-cards {
  display: flex;
  justify-content: center;
  gap: 48px;
  background: #fff;
  margin: 0 16px 24px;
  border-radius: 22px;
  padding: 24px 16px 20px;
  box-shadow: 0 0.5px 1px rgba(0, 0, 0, 0.05);
}
.ns-style-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.phone-big {
  width: 76px;
  height: 160px;
  border-radius: 16px;
  border: 4px solid #e5e5ea;
  background: #f8f9fa;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 16px;
  transition: transform 0.12s ease;
}
.ns-style-card:active .phone-big { transform: scale(0.95); }
.pb-time { font: 500 12px/1 var(--font-stack); color: #8e8e93; letter-spacing: 1px; margin-bottom: 8px; }
.pb-bars { position: absolute; bottom: 14px; display: flex; flex-direction: column; align-items: center; width: 100%; }
.pb-bg { position: absolute; bottom: -2.5px; width: 44px; height: 12px; background: #d1d1d6; border-radius: 3px; z-index: 0; }
.pb-green { position: relative; z-index: 1; width: 52px; height: 18px; background: #00D166; border-radius: 4px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); }
.pb-count {
  display: flex;
  align-items: center;
  gap: 3px;
  background: #e5e5ea;
  padding: 3px 8px;
  border-radius: 999px;
  font: 500 9px/1 var(--font-stack);
  color: #3a3a3c;
  white-space: nowrap;
}
.pb-label { font: 500 14px/1 var(--font-stack); color: #3a3a3c; }
.pb-radio {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 2px solid #d1d1d6;
  position: relative;
  transition: border-color 0.2s;
}
.pb-radio.on { border-color: #007AFF; }
.pb-radio.on::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 12px; height: 12px;
  background: #007AFF;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.ns-style-card.active .pb-label { color: #007AFF; }

/* 提醒方式三卡片 */
.ns-style-cards.remind { gap: 16px; padding: 20px 12px 18px; }
.ns-remind-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.ns-remind-card:active .phone-mini { transform: scale(0.95); }
.pm-check {
  width: 22px; height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.pm-check.on { background: #007AFF; }
.pm-check:not(.on) { border: 2px solid #d1d1d6; }

/* 应用详情 */
.ns-app-hero { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 24px 0 26px; }
.ns-hero-title { font: 600 20px/1 var(--font-stack); color: #1c1c1e; letter-spacing: 0.3px; }
</style>
