import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { useClockStore, formatDaysRepeat } from '../src/stores/clockStore.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('formatDaysRepeat formats day arrays accurately', () => {
  assert.equal(formatDaysRepeat([]), '仅一次')
  assert.equal(formatDaysRepeat([0, 1, 2, 3, 4, 5, 6]), '每天')
  assert.equal(formatDaysRepeat([1, 2, 3, 4, 5]), '周一至周五')
  assert.equal(formatDaysRepeat([0, 6]), '周日, 周六')
  assert.equal(formatDaysRepeat([6, 0]), '周日, 周六') // handles unsorted input
  assert.equal(formatDaysRepeat([1, 3, 5]), '周一, 周三, 周五')
})

test('clockStore updateAlarm updates alarm properties and recalculates repeatLabel', () => {
  setActivePinia(createPinia())
  const clock = useClockStore()

  // Test updating existing alarm a1
  const updated = clock.updateAlarm('a1', {
    time: '07:30',
    days: [1, 2, 3, 4, 5],
    snooze: '15 分钟，3 次',
    ringtone: '麦加唤礼声'
  })

  assert.ok(updated)
  assert.equal(updated.time, '07:30')
  assert.equal(updated.repeatLabel, '周一至周五')
  assert.equal(updated.snooze, '15 分钟，3 次')
  assert.equal(updated.ringtone, '麦加唤礼声')

  // Verify in alarms array
  const a1 = clock.alarms.find((a) => a.id === 'a1')
  assert.equal(a1.time, '07:30')
  assert.equal(a1.repeatLabel, '周一至周五')
})

test('clockStore addAlarm includes all standard fields matching reference design', () => {
  setActivePinia(createPinia())
  const clock = useClockStore()

  const newAlarm = clock.addAlarm({
    time: '06:30',
    days: [0, 6],
    label: '早锻炼'
  })

  assert.ok(newAlarm.id)
  assert.equal(newAlarm.time, '06:30')
  assert.equal(newAlarm.repeatLabel, '周日, 周六')
  assert.equal(newAlarm.ringtone, '默认铃声')
  assert.equal(newAlarm.snooze, '10 分钟, 3 次')
  assert.equal(newAlarm.vibration, '跟随音乐节奏')
  assert.equal(newAlarm.folaxBroadcast, '已关闭')
  assert.equal(newAlarm.ringDateEnabled, false)
})

test('AlarmEditModal component exists and matches reference screenshot structure', () => {
  const modalPath = path.resolve(__dirname, '../src/components/apps/clock/subpages/AlarmEditModal.vue')
  assert.ok(fs.existsSync(modalPath), 'AlarmEditModal.vue must exist')
  const content = fs.readFileSync(modalPath, 'utf-8')

  // Header and title
  assert.ok(content.includes('modalTitle'), 'Must compute modalTitle (编辑闹钟 / 新建闹钟)')
  assert.ok(content.includes('modal-close-circle'), 'Must provide circular close button')

  // WheelTimePicker integration
  assert.ok(content.includes('WheelTimePicker'), 'Must integrate WheelTimePicker')

  // Card 1 rows
  assert.ok(content.includes('重复'), 'Must include 重复 row')
  assert.ok(content.includes('指定日期响铃'), 'Must include 指定日期响铃 row')
  assert.ok(content.includes('闹钟提示音'), 'Must include 闹钟提示音 row')
  assert.ok(content.includes('标签'), 'Must include 标签 row')
  assert.ok(content.includes('稍后提醒'), 'Must include 稍后提醒 row')
  assert.ok(content.includes('响铃时振动'), 'Must include 响铃时振动 row')

  // Card 2 Folax broadcast
  assert.ok(content.includes('Folax 闹钟播报'), 'Must include Folax 闹钟播报')
  assert.ok(content.includes('响铃时将智能播报所选内容。'), 'Must include Folax description')

  // Pill save button & delete button
  assert.ok(content.includes('btn-save-pill'), 'Must include pill-shaped save button')
  assert.ok(content.includes('删除闹钟'), 'Must include delete alarm option in edit mode')
})

test('WheelTimePicker component provides double column drum wheel interaction', () => {
  const pickerPath = path.resolve(__dirname, '../src/components/ui/WheelTimePicker.vue')
  assert.ok(fs.existsSync(pickerPath), 'WheelTimePicker.vue must exist')
  const content = fs.readFileSync(pickerPath, 'utf-8')

  assert.ok(content.includes('wheel-time-picker'), 'Must define wheel-time-picker class')
  assert.ok(content.includes('row-center'), 'Must define row-center styling for active number')
  assert.ok(content.includes('row-near'), 'Must define row-near styling')
  assert.ok(content.includes('row-far'), 'Must define row-far styling')
  assert.ok(content.includes('stepHour'), 'Must support stepping hour')
  assert.ok(content.includes('stepMinute'), 'Must support stepping minute')
})

test('SettingsPrayer component unifies time setting using TimePickerModal', () => {
  const prayerPath = path.resolve(__dirname, '../src/components/apps/settings/SettingsPrayer.vue')
  const content = fs.readFileSync(prayerPath, 'utf-8')

  assert.ok(content.includes('TimePickerModal'), 'SettingsPrayer must import and use TimePickerModal')
  assert.ok(content.includes('handleTimePickerConfirm'), 'Must handle TimePickerModal confirm')
})
