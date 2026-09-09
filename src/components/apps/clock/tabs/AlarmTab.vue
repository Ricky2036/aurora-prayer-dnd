<script setup>
import { ref } from 'vue'
import { useClockStore } from '../../../../stores/clockStore'
import { CLOCK_ICONS } from '../clockIcons'
import ToggleSwitch from '../../../ui/ToggleSwitch.vue'

const emit = defineEmits(['open-subpage'])
const clock = useClockStore()

// 更多菜单显示状态
const showMenu = ref(false)
// 新增闹钟弹窗
const showAddModal = ref(false)
const newTime = ref('08:00')
const newLabel = ref('')
const newRepeat = ref('everyday') // 'once' | 'workday' | 'everyday'

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

function handleAddAlarm() {
  let days = []
  let repeatLabel = '每天'
  if (newRepeat.value === 'workday') {
    days = [1, 2, 3, 4, 5]
    repeatLabel = '周一至周五'
  } else if (newRepeat.value === 'once') {
    days = []
    repeatLabel = '仅一次'
  } else {
    days = [0, 1, 2, 3, 4, 5, 6]
    repeatLabel = '每天'
  }

  clock.addAlarm({
    time: newTime.value,
    days,
    repeatLabel,
    label: newLabel.value
  })

  showAddModal.value = false
  newLabel.value = ''
}
</script>

<template>
  <div class="alarm-tab" @click="closeMenu">
    <!-- 顶部 Bar -->
    <header class="tab-header">
      <h1 class="header-title">闹钟</h1>
      <div class="header-actions" @click.stop>
        <button class="icon-action-btn" title="添加闹钟" @click="showAddModal = true">
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

        <div class="alarm-action">
          <ToggleSwitch
            :model-value="item.enabled"
            @update:model-value="clock.toggleAlarm(item.id)"
          />
        </div>
      </div>
    </div>

    <!-- 新增闹钟弹窗 -->
    <Transition name="fade">
      <div v-if="showAddModal" class="modal-mask" @click.self="showAddModal = false">
        <div class="modal-card">
          <div class="modal-header">
            <button class="modal-btn-cancel" @click="showAddModal = false">取消</button>
            <span class="modal-title">添加闹钟</span>
            <button class="modal-btn-confirm" @click="handleAddAlarm">保存</button>
          </div>

          <div class="modal-body">
            <div class="time-picker-row">
              <input type="time" v-model="newTime" class="time-input" />
            </div>

            <div class="modal-field-group">
              <div class="field-item">
                <span class="field-label">重复</span>
                <select v-model="newRepeat" class="field-select">
                  <option value="everyday">每天</option>
                  <option value="workday">工作日 (周一至周五)</option>
                  <option value="once">仅一次</option>
                </select>
              </div>
              <div class="modal-divider"></div>
              <div class="field-item">
                <span class="field-label">标签</span>
                <input v-model="newLabel" placeholder="闹钟" class="field-text-input" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
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
  padding: 8px 16px 80px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alarm-card {
  padding: 16px 18px;
  background: #141416;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  transition: background 0.2s ease;
}

.alarm-card.active {
  background: #1c1c1e;
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

/* 模态弹窗 */
.modal-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(10px);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.modal-card {
  width: 100%;
  background: #1c1c1e;
  border-radius: 24px 24px 0 0;
  padding: 16px 20px 36px;
  box-sizing: border-box;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
}

.modal-btn-cancel,
.modal-btn-confirm {
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 6px;
}

.modal-btn-cancel {
  color: #8e8e93;
}

.modal-btn-confirm {
  color: #ff9500;
  font-weight: 600;
}

.time-picker-row {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.time-input {
  font-size: 40px;
  background: transparent;
  border: none;
  color: #ff9500;
  font-family: inherit;
  font-weight: 300;
}

.modal-field-group {
  background: #2c2c2e;
  border-radius: 14px;
  overflow: hidden;
}

.field-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.field-label {
  font-size: 15px;
  color: #fff;
}

.field-select {
  background: transparent;
  border: none;
  color: #ff9500;
  font-size: 15px;
  outline: none;
}

.field-text-input {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 15px;
  text-align: right;
  outline: none;
}

.modal-divider {
  height: 0.5px;
  background: rgba(255, 255, 255, 0.1);
  margin-left: 16px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
