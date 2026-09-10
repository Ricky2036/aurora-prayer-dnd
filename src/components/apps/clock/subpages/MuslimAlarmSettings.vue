<script setup>
import { ref, computed } from 'vue'
import { useClockStore } from '../../../../stores/clockStore'
import { useBackHandler } from '../../../../composables/backRegistry'
import ToggleSwitch from '../../../ui/ToggleSwitch.vue'

const emit = defineEmits(['back'])
const clock = useClockStore()

// 弹窗状态：null | 'calcMethod' | 'prayerTimeMethod' | 'ramadanAdjust' | 'ringtone'
const activeModal = ref(null)

const CALC_METHODS = [
  '埃及综合调查局',
  '摩洛哥宗教事务部',
  '克拉嗤伊斯兰科学大学',
  '北美伊斯兰协会',
  '穆斯林世界联盟',
  '乌姆·库拉大学',
  '土耳其宗教事务主席',
  '德黑兰大学地球物理研究所',
  '伊玛目 Leva 研究所（库姆）',
  '自定义'
]

const ASR_METHODS = [
  '莎菲懿法学派',
  '哈纳菲',
  '自定义'
]

const RAMADAN_ADJUST_DAYS = [-2, -1, 0, 1, 2]

const RINGTONES = [
  '默认铃声 (Rise Slowly)',
  '麦加唤礼声',
  '麦地那唤礼声',
  '阿克萨唤礼声',
  '平静晨鸣'
]

const modalTitle = computed(() => {
  if (activeModal.value === 'calcMethod') return '计算方法'
  if (activeModal.value === 'prayerTimeMethod') return '哺礼时间法'
  if (activeModal.value === 'ramadanAdjust') return '调整斋月日期'
  if (activeModal.value === 'ringtone') return '铃声'
  return ''
})

const currentOptions = computed(() => {
  if (activeModal.value === 'calcMethod') return CALC_METHODS
  if (activeModal.value === 'prayerTimeMethod') return ASR_METHODS
  if (activeModal.value === 'ramadanAdjust') return RAMADAN_ADJUST_DAYS
  if (activeModal.value === 'ringtone') return RINGTONES
  return []
})

function isOptionSelected(opt) {
  if (activeModal.value === 'calcMethod') {
    return clock.settings.calcMethod === opt
  }
  if (activeModal.value === 'prayerTimeMethod') {
    return clock.settings.prayerTimeMethod === opt
  }
  if (activeModal.value === 'ramadanAdjust') {
    return clock.settings.ramadanAdjustDays === opt
  }
  if (activeModal.value === 'ringtone') {
    return clock.settings.ringtone === opt
  }
  return false
}

function formatOptionLabel(opt) {
  if (activeModal.value === 'ramadanAdjust') {
    return `${opt} 天`
  }
  return opt
}

function openModal(modalType) {
  activeModal.value = modalType
}

function closeModal() {
  activeModal.value = null
}

function selectOption(opt) {
  if (activeModal.value === 'calcMethod') {
    clock.setCalcMethod(opt)
  } else if (activeModal.value === 'prayerTimeMethod') {
    clock.setPrayerTimeMethod(opt)
  } else if (activeModal.value === 'ramadanAdjust') {
    clock.setRamadanAdjustDays(opt)
  } else if (activeModal.value === 'ringtone') {
    clock.setRingtone(opt)
  }
  closeModal()
}

// 侧滑/物理返回键优先关闭底部弹窗
useBackHandler(() => {
  if (activeModal.value) {
    closeModal()
    return true
  }
  return false
})
</script>

<template>
  <div class="subpage-container">
    <!-- 顶栏导航 -->
    <header class="subpage-header">
      <button class="back-btn" @click="emit('back')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M15 19L8 12L15 5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <h2 class="subpage-title">穆斯林闹钟</h2>
      <div class="header-placeholder"></div>
    </header>

    <!-- 设置卡片 -->
    <div class="subpage-content">
      <div class="settings-card">
        <!-- 主开关 -->
        <div class="setting-item toggle-item">
          <span class="setting-label">穆斯林闹钟</span>
          <ToggleSwitch
            :model-value="clock.settings.muslimAlarmEnabled"
            @update:model-value="clock.setMuslimAlarmEnabled($event)"
          />
        </div>

        <div class="divider"></div>

        <!-- 计算方法 -->
        <div class="setting-item clickable" @click="openModal('calcMethod')">
          <div class="setting-text-col">
            <span class="setting-label">计算方法</span>
            <span class="setting-sublabel">{{ clock.settings.calcMethod }}</span>
          </div>
          <svg class="setting-chevron" width="8" height="13" viewBox="0 0 8 13" fill="none">
            <path d="M1.5 1.5L6.5 6.5L1.5 11.5" stroke="#8e8e93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="divider"></div>

        <!-- 哺礼时间法 -->
        <div class="setting-item clickable" @click="openModal('prayerTimeMethod')">
          <div class="setting-text-col">
            <span class="setting-label">哺礼时间法</span>
            <span class="setting-sublabel">{{ clock.settings.prayerTimeMethod }}</span>
          </div>
          <svg class="setting-chevron" width="8" height="13" viewBox="0 0 8 13" fill="none">
            <path d="M1.5 1.5L6.5 6.5L1.5 11.5" stroke="#8e8e93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="divider"></div>

        <!-- 调整斋月日期 -->
        <div class="setting-item clickable" @click="openModal('ramadanAdjust')">
          <div class="setting-text-col">
            <span class="setting-label">调整斋月日期</span>
            <span class="setting-sublabel">{{ clock.settings.ramadanAdjustDays }} 天</span>
          </div>
          <svg class="setting-chevron" width="8" height="13" viewBox="0 0 8 13" fill="none">
            <path d="M1.5 1.5L6.5 6.5L1.5 11.5" stroke="#8e8e93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="divider"></div>

        <!-- 铃声 -->
        <div class="setting-item clickable" @click="openModal('ringtone')">
          <div class="setting-text-col">
            <span class="setting-label">铃声</span>
            <span class="setting-sublabel">{{ clock.settings.ringtone }}</span>
          </div>
          <svg class="setting-chevron" width="8" height="13" viewBox="0 0 8 13" fill="none">
            <path d="M1.5 1.5L6.5 6.5L1.5 11.5" stroke="#8e8e93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 底部抽屉弹窗 (Bottom Sheet Modal) -->
    <Transition name="sheet-fade">
      <div v-if="activeModal" class="modal-backdrop" @click="closeModal">
        <Transition name="sheet-slide">
          <div v-if="activeModal" class="bottom-sheet" @click.stop>
            <div class="sheet-title">{{ modalTitle }}</div>
            <div class="sheet-list">
              <div
                v-for="opt in currentOptions"
                :key="opt"
                class="sheet-option-item"
                @click="selectOption(opt)"
              >
                <span class="option-label">{{ formatOptionLabel(opt) }}</span>
                <span class="option-radio" :class="{ selected: isOptionSelected(opt) }"></span>
              </div>
            </div>
            <button class="sheet-cancel-btn" @click="closeModal">取消</button>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.subpage-container {
  height: 100%;
  background: #000000;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  padding-top: var(--safe-top, 44px);
  box-sizing: border-box;
  position: relative;
}

:deep(.toggle-switch.on) {
  background: #ff9500 !important;
}
:deep(.toggle-switch) {
  background: #38383a;
}

.subpage-header {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #000000;
}

.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.back-btn:active {
  background: rgba(255, 255, 255, 0.2);
}

.subpage-title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.header-placeholder {
  width: 36px;
}

.subpage-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.settings-card {
  background: #1c1c1e;
  border-radius: 16px;
  overflow: hidden;
}

.setting-item {
  min-height: 64px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.setting-item.toggle-item {
  min-height: 56px;
}

.setting-item.clickable {
  cursor: pointer;
}

.setting-item.clickable:active {
  background: rgba(255, 255, 255, 0.05);
}

.setting-text-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label {
  font-size: 16px;
  color: #ffffff;
  font-weight: 400;
  line-height: 1.3;
}

.setting-sublabel {
  font-size: 14px;
  color: #8e8e93;
  line-height: 1.3;
}

.setting-chevron {
  flex-shrink: 0;
  margin-left: 12px;
}

.divider {
  height: 0.5px;
  background: rgba(255, 255, 255, 0.08);
  margin-left: 16px;
}

/* ================= 底部抽屉弹窗样式 ================= */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.bottom-sheet {
  width: 100%;
  max-width: 480px;
  background: #252527;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 22px 20px calc(20px + env(safe-area-inset-bottom, 0px)) 20px;
  box-sizing: border-box;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.5);
}

.sheet-title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.sheet-list {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  overscroll-behavior: contain;
}

.sheet-option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 4px;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: background 0.12s;
}

.sheet-option-item:active {
  background: rgba(255, 255, 255, 0.05);
}

.option-label {
  font-size: 16px;
  color: #ffffff;
  line-height: 1.4;
}

.option-radio {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #545458;
  box-sizing: border-box;
  display: inline-block;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.option-radio.selected {
  border: 5px solid #ff9500;
  background: #252527;
}

.sheet-cancel-btn {
  width: 100%;
  height: 50px;
  border-radius: 25px;
  background: #38383a;
  border: none;
  color: #ffffff;
  font-size: 16px;
  font-weight: 500;
  margin-top: 16px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.sheet-cancel-btn:active {
  background: #48484a;
}

/* 动效 */
.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity 0.25s ease;
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-slide-leave-active {
  transition: transform 0.22s cubic-bezier(0.4, 0, 1, 1);
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}
</style>
