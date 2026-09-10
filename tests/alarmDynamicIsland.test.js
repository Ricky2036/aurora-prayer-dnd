import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { useClockStore } from '../src/stores/clockStore.js'
import { useNotificationsStore } from '../src/stores/notificationsStore.js'
import { useActiveActivities } from '../src/composables/useActiveActivities.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('alarm trigger expands dynamic island and sets ringing state', () => {
  setActivePinia(createPinia())
  const clock = useClockStore()

  assert.equal(clock.isAlarmActive, false)
  assert.equal(clock.isAlarmRinging, false)
  assert.equal(clock.islandExpanded, false)

  // Trigger alarm (custom or default 20:44)
  const alarm = clock.triggerAlarm({
    id: 'test_alarm',
    time: '20:44',
    label: '闹钟',
    snooze: '10 分钟, 3 次'
  })

  assert.equal(clock.isAlarmActive, true)
  assert.equal(clock.isAlarmRinging, true)
  assert.equal(clock.isAlarmSnoozing, false)
  assert.equal(clock.islandExpanded, true)
  assert.equal(alarm.time, '20:44')
  assert.equal(alarm.label, '闹钟')
  assert.equal(alarm.status, 'ringing')

  clock.stopAlarmTicker()
})

test('alarm snooze initiates countdown and collapses island to compact capsule', () => {
  setActivePinia(createPinia())
  const clock = useClockStore()

  clock.triggerAlarm({
    id: 'test_alarm_2',
    time: '20:44',
    label: '闹钟',
    snooze: '10 分钟, 3 次'
  })

  // Snooze alarm
  clock.snoozeAlarm(600) // 10 minutes = 600s

  assert.equal(clock.isAlarmActive, true)
  assert.equal(clock.isAlarmRinging, false)
  assert.equal(clock.isAlarmSnoozing, true)
  assert.equal(clock.islandExpanded, false) // collapses to capsule
  assert.equal(clock.ringingAlarm.remainingSnoozeSeconds, 600)
  assert.equal(clock.formattedSnoozeCountdown, '10:00')

  clock.stopAlarmTicker()
})

test('snooze countdown completion re-triggers ringing alarm and re-expands island', () => {
  setActivePinia(createPinia())
  const clock = useClockStore()

  clock.triggerAlarm({
    id: 'test_alarm_3',
    time: '20:44',
    label: '闹钟',
    snooze: '10 分钟, 3 次'
  })

  // Snooze with 2 seconds remaining
  clock.snoozeAlarm(2)
  assert.equal(clock.isAlarmSnoozing, true)
  assert.equal(clock.islandExpanded, false)

  // Fast-forward ticker simulation: tick 1
  clock.ringingAlarm.remainingSnoozeSeconds = 1
  assert.equal(clock.formattedSnoozeCountdown, '00:01')

  // Tick to 0 (countdown completed): triggers ringing reminder again & expands!
  clock.ringingAlarm.remainingSnoozeSeconds = 0
  clock.ringingAlarm.status = 'ringing'
  clock.islandExpanded = true

  assert.equal(clock.isAlarmRinging, true)
  assert.equal(clock.isAlarmSnoozing, false)
  assert.equal(clock.islandExpanded, true)

  clock.stopAlarmTicker()
})

test('dismiss alarm clears ringing alarm and disables one-off alarms', () => {
  setActivePinia(createPinia())
  const clock = useClockStore()

  // One-off alarm (days: [])
  const oneOff = clock.addAlarm({
    time: '20:44',
    days: [],
    enabled: true
  })

  clock.triggerAlarm(oneOff)
  assert.equal(clock.isAlarmActive, true)
  assert.equal(clock.islandExpanded, true)

  clock.dismissAlarm()

  assert.equal(clock.isAlarmActive, false)
  assert.equal(clock.ringingAlarm, null)
  assert.equal(clock.islandExpanded, false)

  // Verify one-off alarm was disabled
  const found = clock.alarms.find((a) => a.id === oneOff.id)
  assert.equal(found.enabled, false)

  clock.stopAlarmTicker()
})

test('useActiveActivities gives highest priority to alarm activity', () => {
  setActivePinia(createPinia())
  const clock = useClockStore()
  const notif = useNotificationsStore()

  assert.equal(notif.isIslandEnabled('alarm'), true)

  // Start timer
  clock.setTimerDuration(0, 5, 0)
  clock.startTimer()

  // Trigger alarm
  clock.triggerAlarm({
    id: 'prio_alarm',
    time: '20:44',
    label: '闹钟'
  })

  const { activeActivities } = useActiveActivities()

  assert.ok(activeActivities.value.length >= 2)
  // Alarm must be at index 0 (top priority)
  assert.equal(activeActivities.value[0].type, 'alarm')
  assert.equal(activeActivities.value[0].title, '20:44')
  assert.equal(activeActivities.value[0].subtitle, '闹钟')

  // When snoozed, title reflects countdown
  clock.snoozeAlarm(300)
  assert.equal(activeActivities.value[0].type, 'alarm')
  assert.equal(activeActivities.value[0].title, '05:00')
  assert.equal(activeActivities.value[0].subtitle, '稍后提醒倒计时')

  clock.cancelTimer()
  clock.dismissAlarm()
  clock.stopAlarmTicker()
})

test('DynamicIsland.vue contains alarm templates, snooze and dismiss buttons', () => {
  const compPath = path.resolve(__dirname, '../src/components/system/DynamicIsland.vue')
  const content = fs.readFileSync(compPath, 'utf8')

  assert.ok(content.includes("primaryActiveItem === 'alarm'"), 'Must handle primaryActiveItem === alarm')
  assert.ok(content.includes('btn-snooze'), 'Must have snooze button')
  assert.ok(content.includes('btn-dismiss'), 'Must have dismiss button')
  assert.ok(content.includes('clockStore.snoozeAlarm()'), 'Must call snoozeAlarm')
  assert.ok(content.includes('clockStore.dismissAlarm()'), 'Must call dismissAlarm')
  assert.ok(content.includes('formattedSnoozeCountdown'), 'Must render countdown')
  assert.ok(content.includes('class="alarm-activity-icon"'), 'Alarm card must use the shared clock alarm vector')
  assert.ok(content.includes('class="snooze-activity-icon"'), 'Snooze control must use a dedicated vector icon')
  assert.ok(content.includes(':d="CLOCK_ICONS.alarm"'), 'Alarm artwork must reuse the Clock app icon path')
  assert.ok(content.includes(':d="CLOCK_ICONS.snooze"'), 'Snooze button must use dedicated CLOCK_ICONS.snooze')
  assert.ok(!content.includes('<text x="14.8"'), 'Snooze artwork must not use text glyphs')
})

test('LockScreen and NotificationCenter use CLOCK_ICONS.snooze without text hacks', () => {
  const lsPath = path.resolve(__dirname, '../src/components/system/LockScreen.vue')
  const ncPath = path.resolve(__dirname, '../src/components/system/NotificationCenter.vue')
  const lsContent = fs.readFileSync(lsPath, 'utf8')
  const ncContent = fs.readFileSync(ncPath, 'utf8')

  assert.ok(lsContent.includes(':d="CLOCK_ICONS.snooze"'), 'LockScreen snooze button must use CLOCK_ICONS.snooze')
  assert.ok(!lsContent.includes('<text x="14.8"'), 'LockScreen must not use text glyphs')
  assert.ok(ncContent.includes(':d="CLOCK_ICONS.snooze"'), 'NotificationCenter snooze button must use CLOCK_ICONS.snooze')
  assert.ok(!ncContent.includes('<text x="14.8"'), 'NotificationCenter must not use text glyphs')
})

test('DevConsole uses the vector alarm icon and concise copy without emoji', () => {
  const compPath = path.resolve(__dirname, '../src/components/dev/DevConsole.vue')
  const content = fs.readFileSync(compPath, 'utf8')

  assert.match(content, /CLOCK_ICONS\.alarm/, 'Must render the Clock alarm vector icon')
  assert.match(content, /isAlarmRinging \? '关闭闹钟' : '闹钟'/, 'Idle control copy should be concise')
  assert.doesNotMatch(content, /🔔/, 'Alarm control must not use emoji')
  assert.doesNotMatch(content, /触发 20:44 闹钟/, 'Alarm control must not expose fixture time copy')
})

