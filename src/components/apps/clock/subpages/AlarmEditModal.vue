<script setup>
import { computed, ref, watch } from 'vue'
import { formatDaysRepeat } from '../../../../stores/clockStore'
import WheelTimePicker from '../../../ui/WheelTimePicker.vue'
import ToggleSwitch from '../../../ui/ToggleSwitch.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  alarm: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'save', 'delete'])

const isEditMode = computed(() => !!(props.alarm && props.alarm.id))
const modalTitle = computed(() => (isEditMode.value ? '编辑闹钟' : '新建闹钟'))

// 表单状态
const formTime = ref('07:00')
const formDays = ref([0, 6])
const formRepeatLabel = computed(() => formatDaysRepeat(formDays.value))
const formRingDateEnabled = ref(false)
const formRingDate = ref('2026-09-10')
const formRingtone = ref('默认铃声')
const formLabel = ref('')
const formSnooze = ref('10 分钟, 3 次')
const formVibration = ref('跟随音乐节奏')
const formFolax = ref('已关闭')

// 当前激活的子面板：null | 'repeat' | 'ringtone' | 'snooze' | 'vibration' | 'folax'
const activeSubSheet = ref(null)

// 监听传入的 alarm 进行回填
watch(
  () => props.alarm,
  (item) => {
    if (item) {
      formTime.value = item.time || '07:00'
      formDays.value = Array.isArray(item.days) ? [...item.days] : [0, 6]
      formRingDateEnabled.value = !!item.ringDateEnabled
      formRingDate.value = item.ringDate || '2026-09-10'
      formRingtone.value = item.ringtone || '默认铃声'
      formLabel.value = item.label || ''
      formSnooze.value = item.snooze || '10 分钟, 3 次'
      formVibration.value = item.vibration || '跟随音乐节奏'
      formFolax.value = item.folaxBroadcast || '已关闭'
    } else {
      // 默认新建状态（8:00，工作日）
      formTime.value = '08:00'
      formDays.value = [1, 2, 3, 4, 5]
      formRingDateEnabled.value = false
      formRingDate.value = '2026-09-10'
      formRingtone.value = '默认铃声'
      formLabel.value = ''
      formSnooze.value = '10 分钟, 3 次'
      formVibration.value = '跟随音乐节奏'
      formFolax.value = '已关闭'
    }
  },
  { immediate: true }
)

// 星期定义 (0=周日, 1=周一...)
const WEEK_DAYS = [
  { day: 0, name: '周日' },
  { day: 1, name: '周一' },
  { day: 2, name: '周二' },
  { day: 3, name: '周三' },
  { day: 4, name: '周四' },
  { day: 5, name: '周五' },
  { day: 6, name: '周六' }
]

function toggleDay(day) {
  const idx = formDays.value.indexOf(day)
  if (idx >= 0) {
    formDays.value.splice(idx, 1)
  } else {
    formDays.value.push(day)
    formDays.value.sort((a, b) => a - b)
  }
}

function setRepeatPreset(type) {
  if (type === 'everyday') {
    formDays.value = [0, 1, 2, 3, 4, 5, 6]
  } else if (type === 'workday') {
    formDays.value = [1, 2, 3, 4, 5]
  } else if (type === 'once') {
    formDays.value = []
  }
}

// 铃声选项
const RINGTONES = [
  '默认铃声',
  'Rise Slowly',
  '麦加唤礼声',
  '晨光初熹',
  '清泉流响',
  '经典钟声'
]

// 稍后提醒选项
const SNOOZE_OPTIONS = [
  '5 分钟，3 次',
  '10 分钟，3 次',
  '15 分钟，3 次',
  '10 分钟，5 次',
  '关闭'
]

// 振动选项
const VIBRATION_OPTIONS = [
  '跟随音乐节奏',
  '经典轻微振动',
  '强振动模式',
  '关闭'
]

// Folax 播报选项
const FOLAX_OPTIONS = [
  '已关闭',
  '天气与温差提醒',
  '今日日程简报',
  '晨间智能简报 (天气+日程)'
]

function handleSave() {
  const payload = {
    time: formTime.value,
    days: [...formDays.value],
    repeatLabel: formRepeatLabel.value,
    ringDateEnabled: formRingDateEnabled.value,
    ringDate: formRingDate.value,
    ringtone: formRingtone.value,
    label: formLabel.value,
    snooze: formSnooze.value,
    vibration: formVibration.value,
    folaxBroadcast: formFolax.value
  }
  emit('save', payload)
}

function handleDelete() {
  if (props.alarm && props.alarm.id) {
    emit('delete', props.alarm.id)
  }
}

function handleClose() {
  activeSubSheet.value = null
  emit('close')
}
</script>

<template>
  <div v-if="visible" class="alarm-modal-backdrop" @click.self="handleClose">
    <div class="alarm-modal-sheet">
      <!-- 顶部 Header -->
      <div class="modal-header">
        <div class="header-placeholder"></div>
        <div class="modal-title">{{ modalTitle }}</div>
        <button class="modal-close-circle" title="关闭" @click="handleClose">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1.5 1.5L12.5 12.5M1.5 12.5L12.5 1.5"
              stroke="#FFFFFF"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <!-- 可滚动区域 -->
      <div class="modal-scroll-body">
        <!-- 双列滚轮时间选择器 -->
        <div class="time-drum-section">
          <WheelTimePicker v-model="formTime" />
        </div>

        <!-- 卡片 1：基础设置参数 -->
        <div class="edit-card-group">
          <!-- 重复 -->
          <div class="edit-card-row clickable" @click="activeSubSheet = 'repeat'">
            <span class="row-label">重复</span>
            <div class="row-right">
              <span class="row-value">{{ formRepeatLabel }}</span>
              <svg class="chevron-icon" width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path d="M1 1L6 6L1 11" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>

          <div class="row-divider"></div>

          <!-- 指定日期响铃 -->
          <div class="edit-card-row">
            <span class="row-label">指定日期响铃</span>
            <div class="row-right" @click.stop>
              <ToggleSwitch v-model="formRingDateEnabled" />
            </div>
          </div>

          <!-- 开启指定日期时展示日期 -->
          <template v-if="formRingDateEnabled">
            <div class="row-divider"></div>
            <div class="edit-card-row sub-row">
              <span class="row-sub-label">响铃日期</span>
              <input type="date" v-model="formRingDate" class="date-input" />
            </div>
          </template>

          <div class="row-divider"></div>

          <!-- 闹钟提示音 -->
          <div class="edit-card-row clickable" @click="activeSubSheet = 'ringtone'">
            <div class="row-col-label">
              <span class="row-label">闹钟提示音</span>
              <span class="row-sub-desc">{{ formRingtone }}</span>
            </div>
            <div class="row-right">
              <svg class="chevron-icon" width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path d="M1 1L6 6L1 11" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>

          <div class="row-divider"></div>

          <!-- 标签 -->
          <div class="edit-card-row">
            <span class="row-label">标签</span>
            <div class="row-right">
              <input
                v-model="formLabel"
                placeholder="闹钟"
                class="label-input"
                maxlength="16"
              />
              <svg class="chevron-icon" width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path d="M1 1L6 6L1 11" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>

          <div class="row-divider"></div>

          <!-- 稍后提醒 -->
          <div class="edit-card-row clickable" @click="activeSubSheet = 'snooze'">
            <span class="row-label">稍后提醒</span>
            <div class="row-right">
              <span class="row-value">{{ formSnooze }}</span>
              <svg class="chevron-icon" width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path d="M1 1L6 6L1 11" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>

          <div class="row-divider"></div>

          <!-- 响铃时振动 -->
          <div class="edit-card-row clickable" @click="activeSubSheet = 'vibration'">
            <span class="row-label">响铃时振动</span>
            <div class="row-right">
              <span class="row-value">{{ formVibration }}</span>
              <svg class="chevron-icon" width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path d="M1 1L6 6L1 11" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- 卡片 2：Folax 闹钟播报 -->
        <div class="edit-card-group folax-card clickable" @click="activeSubSheet = 'folax'">
          <div class="row-col-label">
            <span class="row-label">Folax 闹钟播报</span>
            <span class="row-sub-desc">响铃时将智能播报所选内容。</span>
          </div>
          <div class="row-right">
            <span class="row-value">{{ formFolax }}</span>
            <svg class="chevron-icon" width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>

        <!-- 删除闹钟（编辑已有闹钟时展示） -->
        <div v-if="isEditMode" class="delete-card clickable" @click="handleDelete">
          <span>删除闹钟</span>
        </div>
      </div>

      <!-- 底部保存按钮（橙色大药丸） -->
      <div class="modal-footer">
        <button class="btn-save-pill" @click="handleSave">
          保存
        </button>
      </div>

      <!-- ================= 二级抽屉面板 ================= -->

      <!-- 重复选择抽屉 -->
      <div v-if="activeSubSheet === 'repeat'" class="sub-sheet-mask" @click.self="activeSubSheet = null">
        <div class="sub-sheet-card">
          <div class="sub-sheet-header">
            <span class="sub-sheet-title">重复</span>
            <button class="sub-sheet-done" @click="activeSubSheet = null">完成</button>
          </div>
          <!-- 快捷模式 -->
          <div class="sub-sheet-presets">
            <button class="preset-chip" @click="setRepeatPreset('everyday')">每天</button>
            <button class="preset-chip" @click="setRepeatPreset('workday')">工作日</button>
            <button class="preset-chip" @click="setRepeatPreset('once')">仅一次</button>
          </div>
          <!-- 7 天多选列表 -->
          <div class="sub-sheet-list">
            <div
              v-for="w in WEEK_DAYS"
              :key="w.day"
              class="sub-list-item"
              @click="toggleDay(w.day)"
            >
              <span>{{ w.name }}</span>
              <svg v-if="formDays.includes(w.day)" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="#FF9F0A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 铃声选择抽屉 -->
      <div v-if="activeSubSheet === 'ringtone'" class="sub-sheet-mask" @click.self="activeSubSheet = null">
        <div class="sub-sheet-card">
          <div class="sub-sheet-header">
            <span class="sub-sheet-title">闹钟提示音</span>
            <button class="sub-sheet-done" @click="activeSubSheet = null">完成</button>
          </div>
          <div class="sub-sheet-list">
            <div
              v-for="r in RINGTONES"
              :key="r"
              class="sub-list-item"
              @click="formRingtone = r; activeSubSheet = null"
            >
              <span>{{ r }}</span>
              <svg v-if="formRingtone === r" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="#FF9F0A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 稍后提醒抽屉 -->
      <div v-if="activeSubSheet === 'snooze'" class="sub-sheet-mask" @click.self="activeSubSheet = null">
        <div class="sub-sheet-card">
          <div class="sub-sheet-header">
            <span class="sub-sheet-title">稍后提醒</span>
            <button class="sub-sheet-done" @click="activeSubSheet = null">完成</button>
          </div>
          <div class="sub-sheet-list">
            <div
              v-for="s in SNOOZE_OPTIONS"
              :key="s"
              class="sub-list-item"
              @click="formSnooze = s; activeSubSheet = null"
            >
              <span>{{ s }}</span>
              <svg v-if="formSnooze === s" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="#FF9F0A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 振动选择抽屉 -->
      <div v-if="activeSubSheet === 'vibration'" class="sub-sheet-mask" @click.self="activeSubSheet = null">
        <div class="sub-sheet-card">
          <div class="sub-sheet-header">
            <span class="sub-sheet-title">响铃时振动</span>
            <button class="sub-sheet-done" @click="activeSubSheet = null">完成</button>
          </div>
          <div class="sub-sheet-list">
            <div
              v-for="v in VIBRATION_OPTIONS"
              :key="v"
              class="sub-list-item"
              @click="formVibration = v; activeSubSheet = null"
            >
              <span>{{ v }}</span>
              <svg v-if="formVibration === v" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="#FF9F0A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Folax 播报抽屉 -->
      <div v-if="activeSubSheet === 'folax'" class="sub-sheet-mask" @click.self="activeSubSheet = null">
        <div class="sub-sheet-card">
          <div class="sub-sheet-header">
            <span class="sub-sheet-title">Folax 闹钟播报</span>
            <button class="sub-sheet-done" @click="activeSubSheet = null">完成</button>
          </div>
          <div class="sub-sheet-list">
            <div
              v-for="f in FOLAX_OPTIONS"
              :key="f"
              class="sub-list-item"
              @click="formFolax = f; activeSubSheet = null"
            >
              <span>{{ f }}</span>
              <svg v-if="formFolax === f" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="#FF9F0A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alarm-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 600;
  display: flex;
  align-items: flex-end;
  animation: modalFade 0.22s ease-out;
}

@keyframes modalFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.alarm-modal-sheet {
  width: 100%;
  max-height: 94%;
  background: #1c1c1e;
  border-radius: 28px 28px 0 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.6);
  animation: modalSlideUp 0.28s cubic-bezier(0.2, 0.9, 0.3, 1);
}

@keyframes modalSlideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* 顶部 Header */
.modal-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.header-placeholder {
  width: 34px;
  height: 34px;
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.3px;
}

.modal-close-circle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #323234;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
}

.modal-close-circle:active {
  background: #48484a;
}

/* 滚动主体 */
.modal-scroll-body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 12px;
}

.time-drum-section {
  padding: 8px 0 16px;
}

/* 卡片样式（还原截图 #2C2C2E 质感与 16px 圆角） */
.edit-card-group {
  background: #2c2c2e;
  border-radius: 16px;
  margin: 0 16px 14px;
  overflow: hidden;
}

.edit-card-row {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  box-sizing: border-box;
}

.edit-card-row.clickable {
  cursor: pointer;
}

.edit-card-row.clickable:active {
  background: rgba(255, 255, 255, 0.05);
}

.sub-row {
  background: rgba(255, 255, 255, 0.02);
}

.row-label {
  font-size: 16px;
  color: #ffffff;
  font-weight: 400;
}

.row-sub-label {
  font-size: 15px;
  color: #8e8e93;
}

.row-col-label {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.row-sub-desc {
  font-size: 13px;
  color: #8e8e93;
  line-height: 1.35;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-value {
  font-size: 15px;
  color: #8e8e93;
}

.chevron-icon {
  opacity: 0.8;
  flex-shrink: 0;
}

.row-divider {
  height: 0.5px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 16px;
}

.date-input {
  background: #1c1c1e;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 14px;
  outline: none;
}

.label-input {
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: 15px;
  text-align: right;
  outline: none;
  width: 120px;
}

.label-input::placeholder {
  color: #636366;
}

/* Folax 卡片 */
.folax-card {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 删除按钮卡片 */
.delete-card {
  background: #2c2c2e;
  border-radius: 16px;
  margin: 0 16px 16px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff453a;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.delete-card:active {
  background: rgba(255, 69, 58, 0.12);
}

/* 底部保存大药丸按钮 */
.modal-footer {
  padding: 8px 16px 24px;
  flex-shrink: 0;
}

.btn-save-pill {
  width: 100%;
  height: 52px;
  border-radius: 26px;
  background: #ff9f0a;
  color: #ffffff;
  font-size: 17px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: -0.3px;
  box-shadow: 0 4px 16px rgba(255, 159, 10, 0.3);
  transition: opacity 0.15s, transform 0.1s;
}

.btn-save-pill:active {
  opacity: 0.88;
  transform: scale(0.99);
}

/* 二级浮层抽屉 */
.sub-sheet-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  animation: modalFade 0.18s ease-out;
}

.sub-sheet-card {
  width: 100%;
  background: #242426;
  border-radius: 24px 24px 0 0;
  padding: 16px 20px 32px;
  box-sizing: border-box;
  box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.6);
  animation: modalSlideUp 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
}

.sub-sheet-header {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.sub-sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.sub-sheet-done {
  background: transparent;
  border: none;
  color: #ff9f0a;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
}

.sub-sheet-presets {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.preset-chip {
  flex: 1;
  height: 36px;
  background: #323234;
  border-radius: 18px;
  border: none;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.preset-chip:active {
  background: #ff9f0a;
}

.sub-sheet-list {
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.sub-list-item {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
  font-size: 15px;
  color: #ffffff;
  cursor: pointer;
}

.sub-list-item:last-child {
  border-bottom: none;
}

.sub-list-item:active {
  opacity: 0.7;
}
</style>
