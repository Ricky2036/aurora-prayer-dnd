<script setup>
import { computed, ref } from 'vue'
import { SEED_CONTACTS, usePrayerStore } from '../../../stores/prayerStore'
import { useI18nStore } from '../../../stores/i18nStore'
import AppNavBar from '../../ui/AppNavBar.vue'
import ToggleSwitch from '../../ui/ToggleSwitch.vue'
import { GLYPHS } from '../../../assets/icons/glyphs'

const emit = defineEmits(['back-to-dnd'])
const prayerStore = usePrayerStore()
const i18n = useI18nStore()

/* 页面视图层级：'list'（礼拜勿扰列表） | 'edit'（单项全屏设置页） | 'contacts'（选择联系人页） */
const currentView = ref('list')
const isBack = ref(false)
const editingPrayer = ref(null)
const editForm = ref({
  startTime: '05:15',
  endTime: '05:45',
  repeatType: 'everyday',
  repeatDays: [0, 1, 2, 3, 4, 5, 6]
})

/* 联系人选择与搜索 */
const searchQuery = ref('')
const filteredContacts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return SEED_CONTACTS
  return SEED_CONTACTS.filter((c) => {
    const nameMatch = c.name.toLowerCase().includes(q)
    const enMatch = c.enName?.toLowerCase().includes(q)
    const bnMatch = c.bnName?.toLowerCase().includes(q)
    const pinyinMatch = c.pinyin?.toLowerCase().includes(q)
    const phoneMatch = c.phone.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''))
    const tagMatch = c.tag?.toLowerCase().includes(q)
    return nameMatch || enMatch || bnMatch || pinyinMatch || phoneMatch || tagMatch
  })
})

function openContactsSelection() {
  isBack.value = false
  searchQuery.value = ''
  currentView.value = 'contacts'
}

function handleContactsBack() {
  isBack.value = true
  currentView.value = 'list'
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
  if (currentView.value === 'contacts') {
    handleContactsBack()
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
  let label = '每天'
  if (editForm.value.repeatType === 'weekday') {
    label = '工作日启用 · 周末关闭'
  } else if (editForm.value.repeatType === 'weekend') {
    label = '仅周末启用'
  } else if (editForm.value.repeatType === 'custom') {
    if (editForm.value.repeatDays.length === 7) label = '每天'
    else if (editForm.value.repeatDays.length === 5 && !editForm.value.repeatDays.includes(5) && !editForm.value.repeatDays.includes(6)) label = '工作日启用 · 周末关闭'
    else label = '每周 ' + editForm.value.repeatDays.map(d => weekDays.value.find(w => w.day === d)?.label).join('、')
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
      <!-- ================= 1. 朝拜勿扰主列表页 ================= -->
      <div v-if="currentView === 'list'" key="list" class="prayer-subpage">
        <!-- 顶部导航：当前菜单名称「朝拜勿扰」左对齐 -->
        <AppNavBar :title="i18n.t('prayerDnd')" @back="emit('back-to-dnd')" />

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

          <!-- 功能 1：智能识别 (基于位置自动启用) -->
          <div class="group-header">{{ i18n.t('autoEnableHeader') }}</div>
          <div class="cell-group">
            <div class="list-cell">
              <div class="lc-icon" style="background: #007AFF;">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path :d="GLYPHS.location" fill="#fff" />
                </svg>
              </div>
              <div class="lc-main no-sep">
                <div class="lc-title-col">
                  <span class="lc-title">{{ i18n.t('autoGeofenceTitle') }}</span>
                  <span class="lc-sub-desc">{{ i18n.t('autoGeofenceDesc') }}</span>
                </div>
                <div class="lc-right">
                  <ToggleSwitch v-model="prayerStore.geoAutoEnable" />
                </div>
              </div>
            </div>
          </div>

          <!-- 功能 2：AI 自动接听 -->
          <div class="group-header">{{ i18n.t('aiAnswerHeader') }}</div>
          <div class="cell-group">
            <div class="list-cell">
              <div class="lc-icon" style="background: #5856D6;">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path :d="GLYPHS.sparklesPhone" fill="#fff" />
                </svg>
              </div>
              <div class="lc-main" :class="{ 'no-sep': !prayerStore.aiAutoAnswer }">
                <div class="lc-title-col">
                  <span class="lc-title">{{ i18n.t('aiAutoAnswerTitle') }}</span>
                  <span class="lc-sub-desc">{{ i18n.t('aiAutoAnswerDesc') }}</span>
                </div>
                <div class="lc-right">
                  <ToggleSwitch v-model="prayerStore.aiAutoAnswer" />
                </div>
              </div>
            </div>

            <!-- 开启 AI 接听后的选择联系人栏 -->
            <div v-if="prayerStore.aiAutoAnswer" class="list-cell clickable" @click="openContactsSelection">
              <div class="lc-icon" style="background: #FF9500;">
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path :d="GLYPHS.person" fill="#fff" />
                </svg>
              </div>
              <div class="lc-main no-sep">
                <span class="lc-title">{{ i18n.t('aiDesignatedContacts') }}</span>
                <div class="lc-right">
                  <span class="lc-sub-val dark-text">{{ prayerStore.selectedContactsSummary }}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" class="chevron-icon">
                    <path :d="GLYPHS.chevronRight" fill="#C7C7CC" />
                  </svg>
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
          <div class="group-header">{{ i18n.locale === 'zh' ? '时间设置' : i18n.locale === 'en' ? 'TIME SETTINGS' : 'সময় নির্ধারণ' }}</div>
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
                <span class="lc-title">{{ i18n.locale === 'zh' ? '工作日 (周日至周四)' : i18n.locale === 'en' ? 'Weekdays (Sun-Thu)' : 'কার্যদিবস (রবি-বৃহঃ)' }}</span>
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
                <span class="lc-title">{{ i18n.locale === 'zh' ? '周末 (周五至周六)' : i18n.locale === 'en' ? 'Weekend (Fri-Sat)' : 'ছুটির দিন (শুক্র-শনি)' }}</span>
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

            <!-- 自定义重复周几选择器（仅选中自定义时展示） -->
            <div v-if="editForm.repeatType === 'custom'" class="weekday-picker-card">
              <div class="wp-circles">
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
            </div>
          </div>
        </div>
      </div>

      <!-- ================= 3. 联系人选择页面 (支持多选与搜索) ================= -->
      <div v-else-if="currentView === 'contacts'" key="contacts" class="prayer-subpage">
        <!-- 顶部导航：标题为「选择联系人」，左侧返回按钮「< 礼拜勿扰」 -->
        <AppNavBar :title="i18n.t('aiDesignatedContacts')" :back-label="i18n.t('prayerDnd')" @back="handleContactsBack" />

        <div class="scrollable detail-body contacts-subpage-body">
          <!-- 搜索输入框 -->
          <div class="contacts-search-box">
            <div class="csb-wrapper">
              <svg width="15" height="15" viewBox="0 0 24 24" class="csb-icon">
                <path :d="GLYPHS.search" fill="#8E8E93" />
              </svg>
              <input
                v-model="searchQuery"
                type="text"
                class="csb-field"
                :placeholder="i18n.t('searchContactsPlaceholder')"
              />
              <button v-if="searchQuery" class="csb-clear" @click="searchQuery = ''">
                <svg width="12" height="12" viewBox="0 0 24 24">
                  <path :d="GLYPHS.close" fill="#fff" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 多选统计与快捷操作栏 -->
          <div class="contacts-bar">
            <span class="cb-stat">{{ i18n.t('selectedCountLabel')(prayerStore.selectedContactIds.length) }}</span>
            <div class="cb-buttons">
              <button class="cb-btn" @click="prayerStore.selectAllContacts">{{ i18n.t('selectAll') }}</button>
              <span class="cb-divider">/</span>
              <button class="cb-btn" @click="prayerStore.clearAllContacts">{{ i18n.t('clearAll') }}</button>
            </div>
          </div>

          <!-- 联系人列表 -->
          <div v-if="filteredContacts.length > 0" class="cell-group contacts-cell-group">
            <div
              v-for="(contact, index) in filteredContacts"
              :key="contact.id"
              class="contact-row clickable"
              :class="{ 'is-selected': prayerStore.selectedContactIds.includes(contact.id) }"
              @click="prayerStore.toggleContact(contact.id)"
            >
              <!-- 勾选状态图标 -->
              <div class="cr-checkbox">
                <div class="cr-circle" :class="{ checked: prayerStore.selectedContactIds.includes(contact.id) }">
                  <svg v-if="prayerStore.selectedContactIds.includes(contact.id)" width="12" height="12" viewBox="0 0 24 24">
                    <path :d="GLYPHS.check" fill="#fff" />
                  </svg>
                </div>
              </div>

              <!-- 彩色头像徽标 -->
              <div class="cr-avatar" :style="{ background: contact.avatarBg }">
                <span>{{ (i18n.locale === 'en' ? (contact.enName || contact.name) : (contact.name)).slice(0, 1) }}</span>
              </div>

              <!-- 联系人信息 -->
              <div class="cr-content" :class="{ 'no-sep': index === filteredContacts.length - 1 }">
                <div class="cr-meta">
                  <div class="cr-name-row">
                    <span class="cr-name">{{ i18n.locale === 'en' ? (contact.enName || contact.name) : i18n.locale === 'bn' ? (contact.bnName || contact.name) : contact.name }}</span>
                    <span class="cr-tag">{{ contact.tag }}</span>
                  </div>
                  <span class="cr-phone">{{ contact.phone }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 搜索无结果占位 -->
          <div v-else class="contacts-empty-box">
            <svg width="40" height="40" viewBox="0 0 24 24" class="ce-icon">
              <path :d="GLYPHS.search" fill="#C7C7CC" />
            </svg>
            <span class="ce-title">{{ i18n.t('noContactsFound') }}</span>
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
  margin: 0 16px 8px;
  background: var(--bg-cell);
  border-radius: var(--radius-cell-group);
  overflow: hidden;
}

.group-header {
  font: var(--text-footnote);
  color: var(--label-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin: 16px 20px 6px;
}

.group-footer {
  font: var(--text-caption);
  color: var(--label-tertiary);
  margin: 4px 20px 16px;
  line-height: 1.4;
}

.list-cell {
  display: flex;
  align-items: center;
  background: var(--bg-cell);
  padding-left: 16px;
  min-height: 44px;
  cursor: default;
}
.list-cell.clickable { cursor: pointer; }
.list-cell.clickable:active { background: #E9E9EB; }

.lc-icon {
  flex: none;
  width: 29px;
  height: 29px;
  border-radius: 6.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.lc-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px 11px 0;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12);
  min-width: 0;
}
.lc-main.no-sep { border-bottom: none; }

.lc-title {
  font: 400 15px/1.25 var(--font-stack);
  color: var(--label);
}

.lc-title-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  padding: 11px 16px;
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

/* ================= 联系人选择页面专属样式 ================= */
.contacts-subpage-body {
  padding: 10px 0 34px;
}

.contacts-search-box {
  padding: 0 16px 10px;
}

.csb-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(142, 142, 147, 0.12);
  border-radius: 10px;
  padding: 0 10px;
  height: 36px;
}

.csb-icon {
  flex: none;
  margin-right: 6px;
}

.csb-field {
  flex: 1;
  border: none;
  background: transparent;
  font: 400 14px/1.2 var(--font-stack);
  color: var(--label);
  outline: none;
  padding: 0;
}

.csb-field::placeholder {
  color: #8e8e93;
}

.csb-clear {
  flex: none;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: #8e8e93;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  margin-left: 6px;
}

.contacts-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 8px;
}

.cb-stat {
  font: 500 13px/1.2 var(--font-stack);
  color: var(--label-secondary);
}

.cb-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cb-btn {
  background: none;
  border: none;
  font: 500 13px/1.2 var(--font-stack);
  color: #007aff;
  cursor: pointer;
  padding: 0;
}

.cb-btn:active {
  opacity: 0.6;
}

.cb-divider {
  font-size: 12px;
  color: rgba(60, 60, 67, 0.2);
}

.contacts-cell-group {
  margin: 0 16px 16px;
}

.contact-row {
  display: flex;
  align-items: center;
  padding-left: 14px;
  background: var(--bg-cell);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.contact-row:active {
  background: #eaeaea;
}

.cr-checkbox {
  flex: none;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cr-circle {
  width: 21px;
  height: 21px;
  border-radius: 50%;
  border: 1.5px solid #c7c7cc;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
  background: transparent;
}

.cr-circle.checked {
  background: #007aff;
  border-color: #007aff;
  transform: scale(1.05);
}

.cr-avatar {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  color: #ffffff;
  font: 600 15px/1 var(--font-stack);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.cr-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px 11px 0;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12);
  min-width: 0;
}

.cr-content.no-sep {
  border-bottom: none;
}

.cr-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cr-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cr-name {
  font: 500 15px/1.2 var(--font-stack);
  color: var(--label);
}

.cr-tag {
  font: 400 10.5px/1.2 var(--font-stack);
  padding: 1.5px 5.5px;
  border-radius: 4px;
  background: rgba(142, 142, 147, 0.15);
  color: var(--label-secondary);
}

.cr-phone {
  font: 400 12.5px/1.2 var(--font-stack);
  color: var(--label-secondary);
}

.contacts-empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  gap: 12px;
}

.ce-icon {
  opacity: 0.5;
}

.ce-title {
  font: 400 14px/1.3 var(--font-stack);
  color: var(--label-secondary);
}
</style>
