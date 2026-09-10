<script setup>
import { ref } from 'vue'
import { useClockStore } from '../../../../stores/clockStore'
import { CLOCK_ICONS } from '../clockIcons'
import ToggleSwitch from '../../../ui/ToggleSwitch.vue'
import AlarmEditModal from '../subpages/AlarmEditModal.vue'

const emit = defineEmits(['open-subpage'])
const clock = useClockStore()

// 更多菜单显示状态
const showMenu = ref(false)
// 闹钟编辑/新建弹窗
const showEditModal = ref(false)
const currentEditingAlarm = ref(null)

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function closeMenu() {
  showMenu.value = false
}

function navigateTo(page) {
  closeMenu()
  emit('open-subpage', page)
}

function openAddAlarm() {
  currentEditingAlarm.value = null
  showEditModal.value = true
}

function openEditAlarm(alarm) {
  currentEditingAlarm.value = alarm
  showEditModal.value = true
}

function handleSaveAlarm(payload) {
  if (currentEditingAlarm.value && currentEditingAlarm.value.id) {
    clock.updateAlarm(currentEditingAlarm.value.id, payload)
  } else {
    clock.addAlarm(payload)
  }
  showEditModal.value = false
}

function handleDeleteAlarm(id) {
  clock.deleteAlarm(id)
  showEditModal.value = false
}
</script>

<template>
  <div class="alarm-tab" @click="closeMenu">
    <!-- 顶部 Bar -->
    <header class="tab-header">
      <h1 class="header-title">闹钟</h1>
      <div class="header-actions" @click.stop>
        <button class="icon-action-btn" title="添加闹钟" @click="openAddAlarm">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.plus" fill="#fff" />
          </svg>
        </button>
        <button class="icon-action-btn" title="更多" @click="toggleMenu">
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path :d="CLOCK_ICONS.moreVert" fill="#fff" />
          </svg>
        </button>

        <!-- 更多下拉浮层 -->
        <Transition name="menu-pop">
          <div v-if="showMenu" class="dropdown-menu">
            <button class="menu-item" @click="navigateTo('muslim-alarm')">
              穆斯林闹钟
            </button>
            <div class="menu-divider"></div>
            <button class="menu-item" @click="navigateTo('general-settings')">
              设置
            </button>
          </div>
        </Transition>
      </div>
    </header>

    <!-- 闹钟列表 -->
    <div class="alarm-list">
      <div
        v-for="item in clock.alarms"
        :key="item.id"
        class="alarm-card"
        :class="{ active: item.enabled }"
        @click="openEditAlarm(item)"
      >
        <div class="alarm-info">
          <div class="alarm-time-row">
            <span class="alarm-time">{{ item.time }}</span>
            <span v-if="item.label" class="alarm-tag">{{ item.label }}</span>
          </div>
          <div class="alarm-desc">
            <span>{{ item.repeatLabel }}</span>
            <span v-if="item.enabled && clock.alarmRemainingMap[item.id]" class="alarm-remaining">
              , {{ clock.alarmRemainingMap[item.id] }}
            </span>
          </div>
        </div>

        <div class="alarm-action" @click.stop>
          <ToggleSwitch
            :model-value="item.enabled"
            @update:model-value="clock.toggleAlarm(item.id)"
          />
        </div>
      </div>
    </div>

    <!-- 闹钟新建与编辑高保真抽屉弹窗 -->
    <AlarmEditModal
      :visible="showEditModal"
      :alarm="currentEditingAlarm"
      @close="showEditModal = false"
      @save="handleSaveAlarm"
      @delete="handleDeleteAlarm"
    />
  </div>
</template>

<style scoped>
.alarm-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000;
  color: #fff;
  position: relative;
  overflow: hidden;
}

:deep(.toggle-switch.on) {
  background: #ff9500 !important;
}
:deep(.toggle-switch) {
  background: #38383a;
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
  color: #fff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
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
  color: #fff;
  transition: background 0.15s;
}

.icon-action-btn:active {
  background: rgba(255, 255, 255, 0.1);
}

/* 更多下拉菜单 */
.dropdown-menu {
  position: absolute;
  top: 46px;
  right: 0;
  background: #2c2c2e;
  border-radius: 14px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.65);
  width: 140px;
  z-index: 100;
  overflow: hidden;
  padding: 4px 0;
  border: 0.5px solid rgba(255, 255, 255, 0.1);
}

.menu-item {
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  display: block;
}

.menu-item:active {
  background: rgba(255, 255, 255, 0.1);
}

.menu-divider {
  height: 0.5px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 12px;
}

.menu-pop-enter-active,
.menu-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(-6px);
}

/* 闹钟列表 */
.alarm-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 110px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.alarm-list::-webkit-scrollbar {
  display: none;
}

.alarm-card {
  padding: 16px 18px;
  background: #141416;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  transition: background 0.18s ease;
  cursor: pointer;
}

.alarm-card:active {
  background: #242426;
}

.alarm-card.active {
  background: #1c1c1e;
}

.alarm-card.active:active {
  background: #2a2a2e;
}

.alarm-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.alarm-time-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.alarm-time {
  font-size: 44px;
  font-weight: 300;
  line-height: 1;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  color: #636366;
  transition: color 0.2s;
}

.alarm-card.active .alarm-time {
  color: #ffffff;
}

.alarm-tag {
  font-size: 14px;
  font-weight: 500;
  color: #ff9500;
}

.alarm-desc {
  font-size: 13px;
  color: #636366;
}

.alarm-card.active .alarm-desc {
  color: #8e8e93;
}

.alarm-remaining {
  color: #8e8e93;
}
</style>
