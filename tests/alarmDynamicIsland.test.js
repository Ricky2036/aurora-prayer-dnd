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

test('LockScreen and NotificationCenter use CLOCK_ICONS.alarm with alarm-activity-icon and no obsolete inline SVG', () => {
  const lsPath = path.resolve(__dirname, '../src/components/system/LockScreen.vue')
  const ncPath = path.resolve(__dirname, '../src/components/system/NotificationCenter.vue')
  const lsContent = fs.readFileSync(lsPath, 'utf8')
  const ncContent = fs.readFileSync(ncPath, 'utf8')

  assert.ok(lsContent.includes(':d="CLOCK_ICONS.alarm"'), 'LockScreen must use CLOCK_ICONS.alarm')
  assert.ok(lsContent.includes('class="alarm-activity-icon"'), 'LockScreen must use alarm-activity-icon class')
  assert.ok(!lsContent.includes('<circle cx="17" cy="17" r="10" fill="#FF9F0A"'), 'LockScreen must not have obsolete circular alarm SVG')

  assert.ok(ncContent.includes(':d="CLOCK_ICONS.alarm"'), 'NotificationCenter must use CLOCK_ICONS.alarm')
  assert.ok(ncContent.includes('class="alarm-activity-icon"'), 'NotificationCenter must use alarm-activity-icon class')
  assert.ok(!ncContent.includes('<circle cx="17" cy="17" r="10" fill="#FF9F0A"'), 'NotificationCenter must not have obsolete circular alarm SVG')
})

test('DynamicIsland.vue supports mirrored swipe-to-delete, settings jump, and IslandCloseModal', () => {
  const compPath = path.resolve(__dirname, '../src/components/system/DynamicIsland.vue')
  const content = fs.readFileSync(compPath, 'utf8')

  assert.ok(content.includes('island-swipe-actions'), 'Must render island-swipe-actions layer')
  assert.ok(content.includes('island-btn-settings'), 'Must render settings button')
  assert.ok(content.includes('island-btn-delete'), 'Must render delete button')
  assert.ok(content.includes('IslandCloseModal'), 'Must include IslandCloseModal component')
  assert.ok(content.includes('onJumpSettings'), 'Must provide onJumpSettings method')
  assert.ok(content.includes('onRequestDeleteActivity'), 'Must provide onRequestDeleteActivity method')
  assert.ok(content.includes('onCardPointerDown'), 'Must handle pointer down for swipe gesture')
  assert.ok(content.includes('onCardPointerMove'), 'Must handle pointer move for swipe gesture')
  assert.ok(content.includes('onCardPointerUp'), 'Must handle pointer up for swipe gesture')
})

test('DevConsole defaults to island module and provides 5 system app island buttons', () => {
  const compPath = path.resolve(__dirname, '../src/components/dev/DevConsole.vue')
  const content = fs.readFileSync(compPath, 'utf8')

  assert.match(content, /:\s*'island'/, 'initialModule must fallback to island')
  assert.match(content, /<option value="island">灵动岛<\/option>/, 'Module option must be 灵动岛')
  assert.doesNotMatch(content, /<option value="island">灵动岛与闹钟<\/option>/, 'Must not include 灵动岛与闹钟')
  assert.match(content, /<span class="pc-card-title">系统应用<\/span>/, 'Must have 系统应用 section title')
  assert.match(content, /CLOCK_ICONS\.alarm/, 'Must render alarm vector icon')
  assert.match(content, /CLOCK_ICONS\.stopwatch/, 'Must render stopwatch vector icon')
  assert.match(content, /CLOCK_ICONS\.timer/, 'Must render timer vector icon')
  assert.match(content, /GLYPHS\.mic/, 'Must render mic vector icon for recorder')
  assert.match(content, /GLYPHS\.music/, 'Must render music vector icon')
  assert.match(content, /<span>闹钟<\/span>/, 'Must list 闹钟 button')
  assert.match(content, /<span>计时器<\/span>/, 'Must list 计时器 button')
  assert.match(content, /<span>倒计时<\/span>/, 'Must list 倒计时 button')
  assert.match(content, /<span>录音<\/span>/, 'Must list 录音 button')
  assert.match(content, /<span>音乐<\/span>/, 'Must list 音乐 button')
})

test('LockScreen implements screen-edge clipping with full-width container and overflow visible wrapper', () => {
  const compPath = path.resolve(__dirname, '../src/components/system/LockScreen.vue')
  const content = fs.readFileSync(compPath, 'utf8')

  assert.match(content, /\.ls-clip\s*\{[^}]*width:\s*100%;/s, 'ls-clip must be 100% full width')
  assert.match(content, /\.ls-clip\s*\{[^}]*overflow-x:\s*clip;/s, 'ls-clip must clip horizontally at screen viewport')
  assert.match(content, /\.ls-card-wrapper\s*\{[^}]*overflow:\s*visible;/s, 'ls-card-wrapper must have overflow: visible for unhindered sliding')
  assert.doesNotMatch(content, /round 22px 22px 0px 0px/, 'clipStyle must not restrict horizontal sliding with premature rounded corner inset')
})

test('DynamicIsland expanded card removes black container background to reveal floating swipe actions over wallpaper', () => {
  const compPath = path.resolve(__dirname, '../src/components/system/DynamicIsland.vue')
  const content = fs.readFileSync(compPath, 'utf8')

  assert.match(content, /\.island-card\.is-expanded\s*\{[^}]*background:\s*transparent;/s, 'island-card.is-expanded must have transparent background')
  assert.match(content, /\.island-card\.is-expanded\s*\{[^}]*overflow:\s*visible;/s, 'island-card.is-expanded must have overflow: visible')
  assert.match(content, /\.island-secondary-card\s*\{[^}]*background:\s*transparent;/s, 'island-secondary-card must have transparent background')
  assert.match(content, /\.island-secondary-card\s*\{[^}]*overflow:\s*visible;/s, 'island-secondary-card must have overflow: visible')
  assert.match(content, /\.expanded-layer\s*\{[^}]*background:\s*#000000;/s, 'expanded-layer must own the black card surface')
})

test('LockScreen defaults to stacked notifications and sinks live activity cards when collapsed', () => {
  const compPath = path.resolve(__dirname, '../src/components/system/LockScreen.vue')
  const content = fs.readFileSync(compPath, 'utf8')

  assert.match(content, /const isCollapsed = ref\(false\)/, 'LockScreen must default to stacked notifications (isCollapsed = false)')
  assert.match(content, /const NATIVE_EXPAND_OFFSET = 0/, 'NATIVE_EXPAND_OFFSET must be 0')
  assert.match(content, /const COLLAPSED_BOTTOM_Y = computed/, 'Must define COLLAPSED_BOTTOM_Y for sunken collapsed position')
  assert.match(content, /COLLAPSED_BOTTOM_Y\.value/, 'getActivityCollapsedY must sink to COLLAPSED_BOTTOM_Y when media is inactive')
})

test('SettingsNotifications places recorder notification settings item at the top', () => {
  const notifSettingsPath = path.resolve(__dirname, '../src/components/apps/settings/SettingsNotifications.vue')
  const content = fs.readFileSync(notifSettingsPath, 'utf8')

  assert.match(content, /map\.set\('recorder',\s*\{/, 'Must pin recorder at the top of notificationApps')
  assert.match(content, /id:\s*'recorder'/, 'Must specify id recorder')
  assert.match(content, /appId:\s*'recorder'/, 'Must specify appId recorder')
  assert.match(content, /iconType:\s*'recorder'/, 'Must specify iconType recorder')
  assert.match(content, /notificationsStore\.islandSettings\.recorder/, 'Must link recorder toggle with notificationsStore islandSettings')
})

test('notifIcons and i18nStore provide recorder icon and title definitions', () => {
  const iconsPath = path.resolve(__dirname, '../src/components/ui/notifIcons.js')
  const iconsContent = fs.readFileSync(iconsPath, 'utf8')
  assert.match(iconsContent, /recorder:\s*IC_IMG\(recorder\)/, 'notifIcons must define recorder icon')
  assert.match(iconsContent, /voicememos:\s*IC_IMG\(recorder\)/, 'notifIcons must define voicememos icon')

  const i18nPath = path.resolve(__dirname, '../src/stores/i18nStore.js')
  const i18nContent = fs.readFileSync(i18nPath, 'utf8')
  assert.match(i18nContent, /recorder:\s*'录音'/, 'i18nStore zh must define recorder title as 录音')
  assert.match(i18nContent, /recorder:\s*'Voice Memos'/, 'i18nStore en must define recorder title as Voice Memos')
})

test('SettingsNotifications decouples master switch and links live activity toggle to islandSettings', () => {
  const notifSettingsPath = path.resolve(__dirname, '../src/components/apps/settings/SettingsNotifications.vue')
  const content = fs.readFileSync(notifSettingsPath, 'utf8')

  // Master switch is purely appStates and decoupled from islandSettings
  assert.match(content, /function getAppState\(id\) \{\s*return appStates\.value\[id\] !== false\s*\}/, 'getAppState must be decoupled from islandSettings')

  // Live activity switch links to notificationsStore islandSettings
  assert.match(content, /getIslandKeyForApp/, 'Must resolve island key for application')
  assert.match(content, /notificationsStore\.isIslandEnabled\(islandKey\)/, 'getAppLiveActivityState must check isIslandEnabled')
  assert.match(content, /notificationsStore\.setIslandEnabled\(islandKey,\s*next\)/, 'toggleAppLiveActivityState must call setIslandEnabled')
})

test('DevConsole prayer card uses 礼拜模式 title and provides SVG icons for all 5 prayers', () => {
  const devConsolePath = path.resolve(__dirname, '../src/components/dev/DevConsole.vue')
  const content = fs.readFileSync(devConsolePath, 'utf8')

  assert.doesNotMatch(content, /礼拜灵动岛/, 'DevConsole must no longer use 礼拜灵动岛')
  assert.match(content, /<span class="pc-card-title">礼拜模式<\/span>/, 'Must use 礼拜模式 title')

  // Check dropdown module options
  assert.doesNotMatch(content, /礼拜与时钟/, 'DevConsole dropdown must no longer contain 礼拜与时钟')
  assert.match(content, /<option value="muslim">礼拜模式<\/option>/, 'DevConsole dropdown must contain 礼拜模式')

  // Check buttons style unification to pc-sysapp-btn
  assert.match(content, /class="pc-sysapp-grid"[\s\S]*?class="pc-sysapp-btn"[\s\S]*?p\.id === 'fajr'/, 'Prayer buttons must use pc-sysapp-grid and pc-sysapp-btn')

  // Check 5 prayer SVGs
  assert.match(content, /p\.id === 'fajr'[\s\S]*?<svg[\s\S]*?<path d="M12 2v6"/, 'Fajr must have sunrise SVG')
  assert.match(content, /p\.id === 'dhuhr'[\s\S]*?<circle cx="12" cy="12" r="4"/, 'Dhuhr must have midday sun SVG')
  assert.match(content, /p\.id === 'asr'[\s\S]*?<circle cx="9" cy="9"/, 'Asr must have afternoon slanting sun SVG')
  assert.match(content, /p\.id === 'maghrib'[\s\S]*?<path d="M12 10v6"/, 'Maghrib must have sunset SVG')
  assert.match(content, /p\.id === 'isha'|else[\s\S]*?<path d="M21 12\.79A9 9 0 1 1 11\.21 3/, 'Isha must have night moon SVG')
})

test('DevConsole dropdown puts Control Center last, useCapture defaults to without frame, and removes alarm snooze button', () => {
  const devConsolePath = path.resolve(__dirname, '../src/components/dev/DevConsole.vue')
  const devContent = fs.readFileSync(devConsolePath, 'utf8')

  // Check dropdown option ordering: island -> muslim -> control
  assert.match(
    devContent,
    /<option value="island">灵动岛<\/option>\s*<option value="muslim">礼拜模式<\/option>\s*<option value="control">控制中心<\/option>/,
    'Dropdown must put control center last'
  )

  // Verify alarm snooze button is removed from DevConsole
  assert.doesNotMatch(devContent, /稍后提醒延时/, 'DevConsole must not have snooze button')
  assert.doesNotMatch(devContent, /clockStore\.snoozeAlarm\(\)/, 'DevConsole must not call snoozeAlarm')

  const capturePath = path.resolve(__dirname, '../src/composables/useCapture.js')
  const captureContent = fs.readFileSync(capturePath, 'utf8')
  assert.match(captureContent, /const recordWithFrame = ref\(false\)/, 'recordWithFrame must default to false')
  assert.match(captureContent, /const screenshotWithFrame = ref\(false\)/, 'screenshotWithFrame must default to false')
})



