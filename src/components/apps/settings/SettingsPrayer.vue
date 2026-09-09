<script setup>
import { computed, ref } from 'vue'
import { usePrayerStore } from '../../../stores/prayerStore'
import { useClockStore } from '../../../stores/clockStore'
import { useSystemStore } from '../../../stores/systemStore'
import { useI18nStore } from '../../../stores/i18nStore'
import AppNavBar from '../../ui/AppNavBar.vue'
import ToggleSwitch from '../../ui/ToggleSwitch.vue'
import { GLYPHS } from '../../../assets/icons/glyphs'

const emit = defineEmits(['back-to-dnd', 'back'])
const prayerStore = usePrayerStore()
const clockStore = useClockStore()
const systemStore = useSystemStore()
const i18n = useI18nStore()

/* 安全的多语言翻译辅助函数：缺失或未编译时自动降级兜底，绝不显示生硬英文 key */
function tr(key, zhFallback, enFallback, bnFallback) {
  const val = i18n?.t ? i18n.t(key) : null
  if (val && val !== key) return val
  if (i18n?.locale === 'en') return enFallback || zhFallback
  if (i18n?.locale === 'bn') return bnFallback || enFallback || zhFallback
  return zhFallback
}

/* 提醒时间二级页面选项定义与状态计算 */
const reminderOptions = [
  { value: -1, labelKey: 'noReminder', zh: '不提醒', en: 'None', bn: 'কোনোটি নয়' },
  { value: 5, labelKey: 'advance5Min', zh: '提前 5 分钟', en: '5 minutes before', bn: '৫ মিনিট আগে' },
  { value: 10, labelKey: 'advance10Min', zh: '提前 10 分钟', en: '10 minutes before', bn: '১০ মিনিট আগে' },
  { value: 15, labelKey: 'advance15Min', zh: '提前 15 分钟', en: '15 minutes before', bn: '১৫ মিনিট আগে' }
]

const currentReminderValue = computed(() => {
  if (prayerStore?.alarmLinkageEnabled === false || prayerStore?.alarmAdvanceMinutes === -1) {
    return -1
  }
  const mins = prayerStore?.alarmAdvanceMinutes
  if (mins === 5 || mins === 10 || mins === 15) return mins
  if (prayerStore?.alarmLinkageEnabled) return 15
  return -1
})

const currentReminderLabel = computed(() => {
  const val = currentReminderValue.value
  const opt = reminderOptions.find((o) => o.value === val)
  if (opt) return tr(opt.labelKey, opt.zh, opt.en, opt.bn)
  return tr('noReminder', '不提醒', 'None', 'কোনোটি নয়')
})

function openReminderSubpage() {
  isBack.value = false
  currentView.value = 'reminder'
}

function handleReminderBack() {
  isBack.value = true
  currentView.value = 'list'
}

function selectReminderOption(val) {
  if (val === -1) {
    if (prayerStore) {
      prayerStore.alarmLinkageEnabled = false
      prayerStore.alarmAdvanceMinutes = -1
      if (typeof prayerStore.setAlarmReminder === 'function') {
        prayerStore.setAlarmReminder(-1)
      } else {
        if (typeof prayerStore.setAlarmLinkage === 'function') prayerStore.setAlarmLinkage(false)
        if (typeof prayerStore.setAlarmAdvanceMinutes === 'function') prayerStore.setAlarmAdvanceMinutes(-1)
      }
    }
    if (clockStore?.settings) {
      clockStore.settings.muslimAlarmEnabled = false
    }
  } else {
    if (prayerStore) {
      prayerStore.alarmLinkageEnabled = true
      prayerStore.alarmAdvanceMinutes = val
      if (typeof prayerStore.setAlarmReminder === 'function') {
        prayerStore.setAlarmReminder(val)
      } else {
        if (typeof prayerStore.setAlarmLinkage === 'function') prayerStore.setAlarmLinkage(true)
        if (typeof prayerStore.setAlarmAdvanceMinutes === 'function') prayerStore.setAlarmAdvanceMinutes(val)
      }
    }
    if (clockStore?.settings) {
      clockStore.settings.muslimAlarmEnabled = true
    }
  }
}

/* 兼容性保留字段与方法 */
const alarmLinkageEnabled = computed({
  get: () => currentReminderValue.value !== -1,
  set: (val) => selectReminderOption(val ? 15 : -1)
})
function jumpToClockMuslim() {
  clockStore?.setActiveTab?.('muslim')
  systemStore?.openApp?.('clock')
}

/* 页面视图层级：'list'（礼拜勿扰列表） | 'edit'（单项全屏设置页） */
const currentView = ref('list')
const isBack = ref(false)
const editingPrayer = ref(null)
const editForm = ref({
  startTime: '05:15',
  endTime: '05:45',
  repeatType: 'everyday',
  repeatDays: [0, 1, 2, 3, 4, 5, 6]
})

function formatTime(prayer) {
  return `${prayer.startTime} - ${prayer.endTime}`
}

function formatRepeat(prayer) {
  if (prayer.repeatType === 'everyday') return i18n.t('repeatEveryday')
  if (prayer.repeatType === 'weekday') return i18n.t('repeatWeekday')
  if (prayer.repeatType === 'weekend') return i18n.t('repeatWeekend')
  return i18n.t('repeatCustom')
}

/* 时间滚轮弹窗状态（图 1 控件样式，屏幕底部弹出） */
const showTimePicker = ref(false)
const timePickerType = ref('start') // 'start' | 'end'
const pickerHour = ref(22)
const pickerMinute = ref(0)

/* 动态星期列表 */
const weekDays = computed(() => {
  return [0, 1, 2, 3, 4, 5, 6].map((day, idx) => ({
    day,
    label: i18n.currentWeekDays[idx]
  }))
})

function getShortRepeatTag(prayer) {
  if (prayer.repeatType === 'weekday') return i18n.t('repeatWeekday')
  if (prayer.repeatType === 'weekend') return i18n.t('repeatWeekend')
  if (prayer.repeatType === 'everyday') return i18n.t('repeatEveryday')
  if (prayer.repeatDays?.length === 7) return i18n.t('repeatEveryday')
  if (prayer.repeatDays?.length === 5 && !prayer.repeatDays.includes(5) && !prayer.repeatDays.includes(6)) return i18n.t('repeatWeekday')
  if (prayer.repeatDays?.length === 2 && prayer.repeatDays.includes(5) && prayer.repeatDays.includes(6)) return i18n.t('repeatWeekend')
  return i18n.t('repeatCustom')
}

/* 进入全屏设置页面 */
function openEdit(prayer) {
  isBack.value = false
  editingPrayer.value = prayer
  editForm.value = {
    startTime: prayer.startTime,
    endTime: prayer.endTime,
    repeatType: prayer.repeatType,
    repeatDays: [...prayer.repeatDays]
  }
  currentView.value = 'edit'
}

function handleEditBack() {
  isBack.value = true
  saveEdit()
  currentView.value = 'list'
}

function back() {
  if (showAdvancePicker.value) {
    closeAdvancePicker()
    return true
  }
  if (showRingtonePicker.value) {
    closeRingtonePicker()
    return true
  }
  if (showTimePicker.value) {
    closeTimePicker()
    return true
  }
  if (currentView.value === 'edit') {
    handleEditBack()
    return true
  }
  return false
}

defineExpose({ back })

/* 时间滚轮弹窗控制（屏幕底部弹出） */
function openTimePicker(type) {
  timePickerType.value = type
  const targetTime = type === 'start' ? editForm.value.startTime : editForm.value.endTime
  const [h, m] = targetTime.split(':').map(Number)
  pickerHour.value = isNaN(h) ? 12 : h
  pickerMinute.value = isNaN(m) ? 0 : m
  showTimePicker.value = true
}

function closeTimePicker() {
  showTimePicker.value = false
}

function confirmTimePicker() {
  const formatted = `${String(pickerHour.value).padStart(2, '0')}:${String(pickerMinute.value).padStart(2, '0')}`
  if (timePickerType.value === 'start') {
    editForm.value.startTime = formatted
  } else {
    editForm.value.endTime = formatted
  }
  showTimePicker.value = false
}

function changeHour(delta) {
  pickerHour.value = (pickerHour.value + delta + 24) % 24
}

function changeMinute(delta) {
  pickerMinute.value = (pickerMinute.value + delta + 60) % 60
}

/* 滚轮与拖拽 */
function onWheelHour(e) {
  e.preventDefault()
  if (e.deltaY > 0) changeHour(1)
  else if (e.deltaY < 0) changeHour(-1)
}

function onWheelMinute(e) {
  e.preventDefault()
  if (e.deltaY > 0) changeMinute(1)
  else if (e.deltaY < 0) changeMinute(-1)
}

let dragStartY = 0
let dragStartVal = 0
let activeCol = null

function startDragHour(e) {
  dragStartY = e.clientY
  dragStartVal = pickerHour.value
  activeCol = 'hour'
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function startDragMinute(e) {
  dragStartY = e.clientY
  dragStartVal = pickerMinute.value
  activeCol = 'minute'
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e) {
  if (!activeCol) return
  const diff = Math.round((dragStartY - e.clientY) / 22)
  if (activeCol === 'hour') {
    pickerHour.value = (dragStartVal + diff + 2400) % 24
  } else if (activeCol === 'minute') {
    pickerMinute.value = (dragStartVal + diff + 6000) % 60
  }
}

function onPointerUp() {
  activeCol = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

/* 重复模式选择：只有选择「自定义」时才显示周定制控件 */
function selectRepeatPreset(type) {
  editForm.value.repeatType = type
  if (type === 'everyday') {
    editForm.value.repeatDays = [0, 1, 2, 3, 4, 5, 6]
  } else if (type === 'weekday') {
    editForm.value.repeatDays = [0, 1, 2, 3, 4] // 工作日 (周日至周四)
  } else if (type === 'weekend') {
    editForm.value.repeatDays = [5, 6] // 周末 (周五至周六)
  } else if (type === 'custom') {
    if (editForm.value.repeatDays.length === 7 || editForm.value.repeatDays.length === 0) {
      editForm.value.repeatDays = [0, 1, 2, 3, 4] // 默认选中工作日
    }
  }
}

function toggleWeekDay(day) {
  const idx = editForm.value.repeatDays.indexOf(day)
  if (idx > -1) {
    if (editForm.value.repeatDays.length > 1) {
      editForm.value.repeatDays.splice(idx, 1)
    }
  } else {
    editForm.value.repeatDays.push(day)
    editForm.value.repeatDays.sort((a, b) => a - b)
  }
}

function saveEdit() {
  if (!editingPrayer.value) return
  // 这条 label 会存进 store 并显示在列表上，必须跟着语言走，否则切英文后这里仍是中文
  let label = i18n.t('repeatEveryday')
  if (editForm.value.repeatType === 'weekday') {
    label = i18n.t('repeatWeekdayOn')
  } else if (editForm.value.repeatType === 'weekend') {
    label = i18n.t('repeatWeekendOnly')
  } else if (editForm.value.repeatType === 'custom') {
    if (editForm.value.repeatDays.length === 7) label = i18n.t('repeatEveryday')
    else if (editForm.value.repeatDays.length === 5 && !editForm.value.repeatDays.includes(5) && !editForm.value.repeatDays.includes(6)) label = i18n.t('repeatWeekdayOn')
    else label = i18n.t('repeatWeekly')(
      editForm.value.repeatDays.map(d => weekDays.value.find(w => w.day === d)?.label).join(i18n.t('repeatDaySep'))
    )
  }

  prayerStore.updatePrayer(editingPrayer.value.id, {
    startTime: editForm.value.startTime,
    endTime: editForm.value.endTime,
    repeatType: editForm.value.repeatType,
    repeatDays: editForm.value.repeatDays,
    repeatLabel: label
  })
}
</script>

<template>
  <div class="settings-prayer">
    <Transition :name="isBack ? 'slide-back' : 'slide'" mode="out-in">
      <!-- ================= 1. 礼拜模式主列表页 ================= -->
      <div v-if="currentView === 'list'" key="list" class="prayer-subpage">
        <!-- 顶部导航：当前菜单名称「礼拜模式」左对齐 -->
        <AppNavBar :title="i18n.t('prayerDnd')" @back="emit('back')" />

        <div class="scrollable detail-body">
          <!-- 总开关 -->
          <div class="cell-group">
            <div class="list-cell">
              <div class="lc-icon" style="background: #34C759;">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path :d="GLYPHS.moon" fill="#fff" />
                </svg>
              </div>
              <div class="lc-main no-sep">
                <div class="lc-title-col">
                  <span class="lc-title">{{ i18n.t('prayerDnd') }}</span>
                  <span class="lc-sub-desc">{{ i18n.t('prayerDndDesc') }}</span>
                </div>
                <div class="lc-right">
                  <ToggleSwitch v-model="prayerStore.masterEnabled" />
                </div>
              </div>
            </div>
          </div>

          <!-- 五大时段列表 -->
          <div class="group-header">{{ i18n.t('prayerSlots') }}</div>
          <div class="cell-group">
            <div
              v-for="(prayer, index) in prayerStore.prayers"
              :key="prayer.id"
              class="prayer-item-cell"
              :class="{ 'is-disabled': !prayer.enabled || !prayerStore.masterEnabled }"
              @click="openEdit(prayer)"
            >
              <!-- 左侧时段信息：本地化礼拜名称 + 时间与重复标签 -->
              <div class="pic-left">
                <div class="pic-name-row">
                  <span class="pic-name">{{ i18n.prayerFull(prayer.id) }}</span>
                </div>
                <div class="pic-window-row">
                  <span class="pic-window-time">{{ prayer.startTime }} - {{ prayer.endTime }}</span>
                  <span class="pic-repeat-badge">{{ getShortRepeatTag(prayer) }}</span>
                </div>
              </div>

              <!-- 右侧开关 -->
              <div class="pic-right" @click.stop>
                <ToggleSwitch
                  :model-value="prayer.enabled"
                  @update:model-value="prayerStore.togglePrayer(prayer.id)"
                />
              </div>
            </div>
          </div>

          <!-- 闹钟提醒入口（小标题为唤礼提醒，标题为闹钟提醒） -->
          <div class="group-header">{{ tr('prayerAlarmHeader', '唤礼提醒', 'ADHAN REMINDER', 'আযান স্মারক') }}</div>
          <div class="cell-group">
            <div class="list-cell clickable" @click="openReminderSubpage">
              <div class="lc-icon" style="background: #FF9500;">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path :d="GLYPHS.bell" fill="#fff" />
                </svg>
              </div>
              <div class="lc-main no-sep">
                <span class="lc-title">{{ tr('prayerAlarmLinkage', '闹钟提醒', 'Alarm Reminder', 'অ্যালার্ম স্মারক') }}</span>
                <div class="lc-right">
                  <span class="lc-sub-val dark-text">{{ currentReminderLabel }}</span>
                  <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                    <path d="M1 1L6 6L1 11" stroke="#C7C7CC" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- 功能：AI 自动接听 -->
          <div class="group-header">{{ i18n.t('aiAnswerHeader') }}</div>
          <div class="cell-group">
            <div class="list-cell">
              <div class="lc-icon" style="background: #5856D6;">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path :d="GLYPHS.sparklesPhone" fill="#fff" />
                </svg>
              </div>
              <div class="lc-main no-sep">
                <div class="lc-title-col">
                  <span class="lc-title">{{ i18n.t('aiAutoAnswerTitle') }}</span>
                  <span class="lc-sub-desc">{{ i18n.t('aiAutoAnswerDesc') }}</span>
                </div>
                <div class="lc-right">
                  <ToggleSwitch v-model="prayerStore.aiAutoAnswer" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= 2. 单项礼拜全屏设置页（标题为 x礼，如“晨礼”） ================= -->
      <div v-else-if="currentView === 'edit' && editingPrayer" key="edit" class="prayer-subpage">
        <!-- 顶部导航：标题为对应语言名称，左侧返回按钮「< 礼拜勿扰」 -->
        <AppNavBar :title="i18n.prayerName(editingPrayer.id)" :back-label="i18n.t('prayerDnd')" @back="handleEditBack" />

        <div class="scrollable detail-body">
          <!-- 时间设置分组（深灰色字体，无背板，点击在屏幕底部呼出时间滚轮弹窗） -->
          <div class="group-header">{{ i18n.t('prayerTimeSettings') }}</div>
          <div class="cell-group">
            <div class="list-cell clickable" @click="openTimePicker('start')">
              <div class="lc-main">
                <span class="lc-title">{{ i18n.t('startTime') }}</span>
                <div class="lc-right">
                  <span class="ms-time-val">{{ editForm.startTime }}</span>
                </div>
              </div>
            </div>
            <div class="list-cell clickable" @click="openTimePicker('end')">
              <div class="lc-main no-sep">
                <span class="lc-title">{{ i18n.t('endTime') }}</span>
                <div class="lc-right">
                  <span class="ms-time-val">{{ editForm.endTime }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 重复模式选择 -->
          <div class="group-header">{{ i18n.t('repeat') }}</div>
          <div class="cell-group">
            <div
              class="list-cell clickable"
              @click="selectRepeatPreset('everyday')"
            >
              <div class="lc-main">
                <span class="lc-title">{{ i18n.t('repeatEveryday') }}</span>
                <div class="lc-right">
                  <svg v-if="editForm.repeatType === 'everyday'" width="18" height="18" viewBox="0 0 24 24">
                    <path :d="GLYPHS.check" fill="#007AFF" />
                  </svg>
                </div>
              </div>
            </div>

            <div
              class="list-cell clickable"
              @click="selectRepeatPreset('weekday')"
            >
              <div class="lc-main">
                <span class="lc-title">{{ i18n.t('repeatWeekdaySunThu') }}</span>
                <div class="lc-right">
                  <svg v-if="editForm.repeatType === 'weekday'" width="18" height="18" viewBox="0 0 24 24">
                    <path :d="GLYPHS.check" fill="#007AFF" />
                  </svg>
                </div>
              </div>
            </div>

            <div
              class="list-cell clickable"
              @click="selectRepeatPreset('weekend')"
            >
              <div class="lc-main" :class="{ 'no-sep': editForm.repeatType !== 'custom' }">
                <span class="lc-title">{{ i18n.t('repeatWeekendFriSat') }}</span>
                <div class="lc-right">
                  <svg v-if="editForm.repeatType === 'weekend'" width="18" height="18" viewBox="0 0 24 24">
                    <path :d="GLYPHS.check" fill="#007AFF" />
                  </svg>
                </div>
              </div>
            </div>

            <div
              class="list-cell clickable"
              @click="selectRepeatPreset('custom')"
            >
              <div class="lc-main no-sep">
                <span class="lc-title">{{ i18n.t('repeatCustom') }}</span>
                <div class="lc-right">
                  <svg v-if="editForm.repeatType === 'custom'" width="18" height="18" viewBox="0 0 24 24">
                    <path :d="GLYPHS.check" fill="#007AFF" />
                  </svg>
                </div>
              </div>
            </div>

            <!-- 自定义重复周几选择器（仅选中自定义时展示，水平排布） -->
            <Transition name="expand">
              <div v-if="editForm.repeatType === 'custom'" class="weekday-circle-row">
                <button
                  v-for="w in weekDays"
                  :key="w.day"
                  class="wsc-circle-btn"
                  :class="{ 'is-selected': editForm.repeatDays.includes(w.day) }"
                  @click="toggleWeekDay(w.day)"
                >
                  {{ w.label }}
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- ================= 3. 提醒时间全屏二级页 ================= -->
      <div v-else-if="currentView === 'reminder'" key="reminder" class="prayer-subpage">
        <!-- 顶部导航：当前菜单名称「闹钟提醒」，左侧返回按钮「< 礼拜模式」 -->
        <AppNavBar :title="tr('prayerAlarmLinkage', '闹钟提醒', 'Alarm Reminder', 'অ্যালার্ম স্মারক')" :back-label="tr('prayerDnd', '礼拜模式', 'Prayer Mode', 'নামাজ মোড')" @back="handleReminderBack" />

        <div class="scrollable detail-body">
          <div class="group-header">{{ tr('alarmAdvanceTime', '提醒时间', 'REMINDER TIME', 'স্মারক সময়') }}</div>
          <div class="cell-group">
            <div
              v-for="(opt, idx) in reminderOptions"
              :key="opt.value"
              class="list-cell clickable"
              @click="selectReminderOption(opt.value)"
            >
              <div class="lc-main" :class="{ 'no-sep': idx === reminderOptions.length - 1 }">
                <span class="lc-title">{{ tr(opt.labelKey, opt.zh, opt.en, opt.bn) }}</span>
                <div class="lc-right">
                  <svg v-if="currentReminderValue === opt.value" width="18" height="18" viewBox="0 0 24 24">
                    <path :d="GLYPHS.check" fill="#007AFF" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="group-footer">
            {{ tr('reminderDesc', '开启后将在每个礼拜时段开始前收到闹钟或唤礼提醒。', 'You will receive an alarm or adhan reminder before each prayer time begins.', 'প্রতিটি নামাজের সময় শুরু হওয়ার পূর্বে অ্যালার্ম বা আযানের স্মারক পাবেন।') }}
          </div>
        </div>
      </div>
    </Transition>

    <!-- ================= 时间选择滚轮弹窗（图 1 控件样式，位于屏幕底部） ================= -->
    <Transition name="picker-bottom">
      <div v-if="showTimePicker" class="picker-backdrop" @click="closeTimePicker">
        <div class="picker-bottom-sheet" @click.stop>
          <!-- 标题与当前时间展示 -->
          <div class="pd-header">
            <div class="pd-type-label">{{ timePickerType === 'start' ? i18n.t('startTime') : i18n.t('endTime') }}</div>
            <div class="pd-time-display">
              {{ String(pickerHour).padStart(2, '0') }}:{{ String(pickerMinute).padStart(2, '0') }}
            </div>
          </div>

          <!-- 双列时间滚轮 -->
          <div class="pd-wheel-container">
            <div class="pd-wheel-highlight"></div>

            <!-- 小时列 -->
            <div
              class="pd-wheel-column"
              @wheel="onWheelHour"
              @pointerdown="startDragHour"
            >
              <div class="wheel-item far" @click="changeHour(-2)">
                {{ String((pickerHour - 2 + 24) % 24).padStart(2, '0') }}
              </div>
              <div class="wheel-item near" @click="changeHour(-1)">
                {{ String((pickerHour - 1 + 24) % 24).padStart(2, '0') }}
              </div>
              <div class="wheel-item center">
                {{ String(pickerHour).padStart(2, '0') }}
              </div>
              <div class="wheel-item near" @click="changeHour(1)">
                {{ String((pickerHour + 1 + 24) % 24).padStart(2, '0') }}
              </div>
              <div class="wheel-item far" @click="changeHour(2)">
                {{ String((pickerHour + 2 + 24) % 24).padStart(2, '0') }}
              </div>
            </div>

            <!-- 分钟列 -->
            <div
              class="pd-wheel-column"
              @wheel="onWheelMinute"
              @pointerdown="startDragMinute"
            >
              <div class="wheel-item far" @click="changeMinute(-2)">
                {{ String((pickerMinute - 2 + 60) % 60).padStart(2, '0') }}
              </div>
              <div class="wheel-item near" @click="changeMinute(-1)">
                {{ String((pickerMinute - 1 + 60) % 60).padStart(2, '0') }}
              </div>
              <div class="wheel-item center">
                {{ String(pickerMinute).padStart(2, '0') }}
              </div>
              <div class="wheel-item near" @click="changeMinute(1)">
                {{ String((pickerMinute + 1 + 60) % 60).padStart(2, '0') }}
              </div>
              <div class="wheel-item far" @click="changeMinute(2)">
                {{ String((pickerMinute + 2 + 60) % 60).padStart(2, '0') }}
              </div>
            </div>
          </div>

          <!-- 底部取消与确定胶囊按钮 -->
          <div class="pd-actions">
            <button class="pd-btn pd-cancel" @click="closeTimePicker">{{ i18n.t('cancel') }}</button>
            <button class="pd-btn pd-confirm" @click="confirmTimePicker">{{ i18n.t('confirm') }}</button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.settings-prayer {
  height: 100%;
  background: var(--bg-grouped);
  overflow: hidden;
  position: relative;
}

.prayer-subpage {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-body {
  flex: 1;
  padding: 14px 0 34px;
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

/* 单元格与分组 */
.cell-group {
  margin: 0 16px 18px;
  background: var(--bg-cell);
  border-radius: var(--radius-cell-group);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.group-header {
  font: var(--text-footnote);
  color: var(--label-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin: 20px 20px 7px;
}

.group-footer {
  font: var(--text-caption);
  color: var(--label-tertiary);
  margin: 4px 20px 18px;
  line-height: 1.4;
}

.list-cell {
  display: flex;
  align-items: center;
  background: var(--bg-cell);
  padding-left: 16px;
  min-height: 48px;
  cursor: default;
}
.list-cell.clickable { cursor: pointer; }
.list-cell.clickable:active { background: #E9E9EB; }

.lc-icon {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 8.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 13px;
}

.lc-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 12px 0;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12);
  min-width: 0;
}
.lc-main.no-sep { border-bottom: none; }

.lc-title {
  font: 400 15.5px/1.25 var(--font-stack);
  color: var(--label);
}

.lc-title-col {
  display: flex;
  flex-direction: column;
  gap: 2.5px;
  min-width: 0;
  padding-right: 8px;
}

.lc-sub-desc {
  font: 400 12px/1.35 var(--font-stack);
  color: var(--label-secondary);
}

.lc-sub-val {
  font: 400 14px/1.2 var(--font-stack);
  color: var(--label-secondary);
}

.lc-sub-val.dark-text {
  color: #3C3C43;
  font-weight: 400;
}

.lc-right {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
}

/* 礼拜时段专属卡片项 */
.prayer-item-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 18px;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12);
  background: var(--bg-cell);
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.2s ease;
}

.prayer-item-cell:last-child {
  border-bottom: none;
}

.prayer-item-cell:active {
  background: #EAEAEA;
}

.prayer-item-cell.is-disabled {
  opacity: 0.5;
}

.pic-left {
  flex: 1;
  min-width: 0;
}

.pic-name-row {
  display: flex;
  align-items: center;
}

.pic-name {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 15.5px;
  font-weight: 600;
  color: var(--label);
}

.pic-window-row {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pic-window-time {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 13.5px;
  font-weight: 500;
  color: #636366; /* 深灰色 */
  letter-spacing: 0.2px;
}

.pic-repeat-badge {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 12px;
  font-weight: 450;
  color: #8e8e93;
}

.pic-right {
  display: flex;
  align-items: center;
  flex: none;
  margin-left: 12px;
}

/* 无背板深灰字体时间 */
.ms-time-val {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: #636366; /* 深灰色 */
  letter-spacing: 0.2px;
}

/* 图 2 样式：圆形星期按钮横排（仅在选择自定义时展开） */
.weekday-circle-row {
  display: flex;
  justify-content: space-between;
  padding: 14px 18px;
  border-top: 0.5px solid rgba(60, 60, 67, 0.08);
  background: var(--bg-cell);
}

.wsc-circle-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #f2f2f7;
  color: #636366;
  font-size: 13.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
  user-select: none;
}

.wsc-circle-btn.is-selected {
  background: #007AFF; /* 图 2 经典天蓝色 */
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.35);
}

.wsc-circle-btn:active {
  transform: scale(0.92);
}

/* 自定义周定制展开动画 */
.expand-enter-active, .expand-leave-active {
  transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.expand-enter-to, .expand-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 80px;
}

/* ================= 图 1 时间滚轮弹窗（屏幕底部展示） ================= */
.picker-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 60;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 12px 24px;
}

.picker-bottom-sheet {
  width: 100%;
  max-width: 360px;
  background: #ffffff;
  border-radius: 28px;
  padding: 22px 20px 20px;
  box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pd-header {
  text-align: center;
  margin-bottom: 8px;
}

.pd-type-label {
  font-size: 15px;
  font-weight: 400;
  color: #8e8e93;
}

.pd-time-display {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  font-size: 24px;
  font-weight: 700;
  color: #000000;
  margin-top: 4px;
  letter-spacing: -0.2px;
}

.pd-wheel-container {
  position: relative;
  width: 100%;
  height: 160px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 36px;
  overflow: hidden;
  user-select: none;
  touch-action: none;
}

.pd-wheel-highlight {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 64px;
  height: 32px;
  pointer-events: none;
}

.pd-wheel-column {
  flex: 1;
  max-width: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: grab;
}

.pd-wheel-column:active {
  cursor: grabbing;
}

.wheel-item {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  transition: all 0.1s ease;
  cursor: pointer;
}

.wheel-item.center {
  font-size: 24px;
  font-weight: 700;
  color: #000000;
}

.wheel-item.near {
  font-size: 18px;
  font-weight: 500;
  color: #8e8e93;
  opacity: 0.7;
}

.wheel-item.far {
  font-size: 14px;
  font-weight: 400;
  color: #c7c7cc;
  opacity: 0.4;
}

.pd-actions {
  display: flex;
  width: 100%;
  gap: 12px;
  margin-top: 18px;
}

.pd-btn {
  flex: 1;
  height: 44px;
  border-radius: 22px;
  border: none;
  font-size: 15.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pd-cancel {
  background: #f2f2f7;
  color: #1c1c1e;
}

.pd-cancel:active {
  background: #e5e5ea;
}

.pd-confirm {
  background: #00C853; /* 图 1 鲜亮绿色 */
  color: #ffffff;
  box-shadow: 0 3px 10px rgba(0, 200, 83, 0.3);
}

.pd-confirm:active {
  transform: scale(0.96);
  opacity: 0.9;
}

/* 弹窗底部滑入过渡 */
.picker-bottom-enter-active,
.picker-bottom-leave-active {
  transition: opacity 0.25s ease;
}

.picker-bottom-enter-from,
.picker-bottom-leave-to {
  opacity: 0;
}

.picker-bottom-enter-active .picker-bottom-sheet {
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.picker-bottom-leave-active .picker-bottom-sheet {
  transition: transform 0.25s cubic-bezier(0.8, 0, 0.8, 0.2);
}

.picker-bottom-enter-from .picker-bottom-sheet {
  transform: translateY(100%);
}

.picker-bottom-leave-to .picker-bottom-sheet {
  transform: translateY(100%);
}


</style>
