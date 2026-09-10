import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { usePrayerStore } from '../src/stores/prayerStore.js'
import { useClockStore } from '../src/stores/clockStore.js'
import { useI18nStore } from '../src/stores/i18nStore.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('prayerStore initializes reminder default state to None (不提醒)', () => {
  setActivePinia(createPinia())
  const prayerStore = usePrayerStore()

  // 默认不提醒，符合用户明确指定“不提醒（默认）”
  assert.equal(prayerStore.alarmLinkageEnabled, false)
  assert.equal(prayerStore.alarmAdvanceMinutes, -1)
  assert.equal(prayerStore.alarmRingtone, '麦加唤礼声')
})

test('prayerStore mutates reminder properties and resets properly', () => {
  setActivePinia(createPinia())
  const prayerStore = usePrayerStore()

  prayerStore.setAlarmReminder(5)
  assert.equal(prayerStore.alarmLinkageEnabled, true)
  assert.equal(prayerStore.alarmAdvanceMinutes, 5)

  prayerStore.setAlarmReminder(10)
  assert.equal(prayerStore.alarmLinkageEnabled, true)
  assert.equal(prayerStore.alarmAdvanceMinutes, 10)

  prayerStore.setAlarmReminder(15)
  assert.equal(prayerStore.alarmLinkageEnabled, true)
  assert.equal(prayerStore.alarmAdvanceMinutes, 15)

  prayerStore.setAlarmReminder(-1)
  assert.equal(prayerStore.alarmLinkageEnabled, false)
  assert.equal(prayerStore.alarmAdvanceMinutes, -1)

  // Reset to defaults
  prayerStore.resetDefaults()
  assert.equal(prayerStore.alarmLinkageEnabled, false)
  assert.equal(prayerStore.alarmAdvanceMinutes, -1)
})

test('clockStore settings and tabs support Muslim mode and alarm linkage', () => {
  setActivePinia(createPinia())
  const clockStore = useClockStore()

  assert.equal(typeof clockStore.setActiveTab, 'function')
  clockStore.setActiveTab('muslim')
  assert.equal(clockStore.activeTab, 'muslim')
})

test('i18nStore defines all required keys across zh, en, and bn locales', () => {
  setActivePinia(createPinia())
  const i18n = useI18nStore()

  const requiredKeys = [
    'prayerAlarmHeader',
    'prayerAlarmLinkage',
    'alarmAdvanceTime',
    'noReminder',
    'advance5Min',
    'advance10Min',
    'advance15Min',
    'reminderDesc'
  ]

  for (const locale of ['zh', 'en', 'bn']) {
    i18n.setLocale(locale)
    for (const key of requiredKeys) {
      const translation = i18n.t(key)
      assert.ok(translation, `Locale ${locale} missing key: ${key}`)
      assert.notEqual(translation, key, `Locale ${locale} returned raw key for: ${key}`)
    }
  }
})

test('SettingsPrayer component template includes simplified arrow entry and secondary reminder subpage', () => {
  const componentPath = path.resolve(__dirname, '../src/components/apps/settings/SettingsPrayer.vue')
  const content = fs.readFileSync(componentPath, 'utf-8')

  // Section header
  assert.ok(content.includes('prayerAlarmHeader'), 'Must include prayerAlarmHeader')

  // Main page entry: arrow navigation instead of switch
  assert.ok(content.includes('openReminderSubpage'), 'Must navigate via openReminderSubpage')
  assert.ok(content.includes('currentReminderLabel'), 'Must display current reminder text on right')
  assert.ok(content.includes('prayerAlarmLinkage'), 'Must include prayerAlarmLinkage title')

  // Secondary subpage: currentView === 'reminder'
  assert.ok(content.includes("currentView === 'reminder'"), 'Must define secondary subpage for reminder')
  assert.ok(content.includes('handleReminderBack'), 'Must handle returning back from subpage')
  assert.ok(content.includes('reminderOptions'), 'Must define reminder options list')
  assert.ok(content.includes('selectReminderOption'), 'Must handle option selection')

  // Option keys in subpage
  assert.ok(content.includes('noReminder'), 'Must include noReminder option')
  assert.ok(content.includes('advance5Min'), 'Must include advance5Min option')
  assert.ok(content.includes('advance10Min'), 'Must include advance10Min option')
  assert.ok(content.includes('advance15Min'), 'Must include advance15Min option')

  // ListCell adoption on main page
  assert.ok(content.includes('<ListCell'), 'Must adopt ListCell component for standardized cell layout')
  assert.ok(content.includes('currentReminderLabel'), 'Must bind value to currentReminderLabel')
  assert.ok(content.includes('chevron'), 'Must specify chevron arrow')

  // Confirmation modal on reminder subpage when Muslim alarm is not enabled
  assert.ok(content.includes('ActionModal'), 'Must mount ActionModal for enable confirmation')
  assert.ok(content.includes('showEnableMuslimAlarmModal'), 'Must track showEnableMuslimAlarmModal')
  assert.ok(content.includes('confirmEnableMuslimAlarm'), 'Must define confirmEnableMuslimAlarm handler')
  assert.ok(content.includes('cancelEnableMuslimAlarm'), 'Must define cancelEnableMuslimAlarm handler')
})

test('SettingsPrayer updates copy matching exact user specifications', () => {
  setActivePinia(createPinia())
  const i18n = useI18nStore()
  i18n.setLocale('zh')

  assert.equal(
    i18n.t('prayerAlarmLinkageDesc'),
    '礼拜开始前，使用穆斯林闹钟进行提醒',
    'Subtitle copy must match exact user prompt'
  )

  assert.equal(
    i18n.t('reminderDesc'),
    '开启后将在设定的每个礼拜开始时间前启用穆斯林闹钟进行唤礼提醒。',
    'Footer description copy must match exact user prompt'
  )

  assert.equal(i18n.t('enableMuslimAlarmTitle'), '启用穆斯林闹钟？')
  assert.equal(i18n.t('enableMuslimAlarmDesc'), '使用该功能需先启用穆斯林闹钟！')
  assert.equal(i18n.t('enableNow'), '立即开启')
})

test('clockStore supports muslimTimeMode, calcMethod, and prayerTimeMethod synchronization', () => {
  setActivePinia(createPinia())
  const clockStore = useClockStore()

  assert.equal(clockStore.muslimTimeMode, 'default', 'Defaults to default reference time')
  assert.equal(clockStore.settings.muslimAlarmEnabled, false, 'Defaults to false when not yet enabled')
  assert.equal(clockStore.settings.calcMethod, '穆斯林世界联盟', 'Defaults to 穆斯林世界联盟')
  assert.equal(clockStore.settings.prayerTimeMethod, '莎菲懿法学派', 'Defaults to 莎菲懿法学派')

  // Switching to custom mode sets both methods to '自定义'
  clockStore.setMuslimTimeMode('custom')
  assert.equal(clockStore.muslimTimeMode, 'custom', 'Switches to custom scheduled time')
  assert.equal(clockStore.settings.calcMethod, '自定义', 'Switches calcMethod to 自定义')
  assert.equal(clockStore.settings.prayerTimeMethod, '自定义', 'Switches prayerTimeMethod to 自定义')

  // Switching back to default restores default organizations
  clockStore.setMuslimTimeMode('default')
  assert.equal(clockStore.muslimTimeMode, 'default', 'Switches back to default time')
  assert.equal(clockStore.settings.calcMethod, '穆斯林世界联盟')
  assert.equal(clockStore.settings.prayerTimeMethod, '莎菲懿法学派')

  // Setting either method to '自定义' triggers custom mode
  clockStore.setCalcMethod('自定义')
  assert.equal(clockStore.muslimTimeMode, 'custom')
  assert.equal(clockStore.settings.calcMethod, '自定义')

  clockStore.setCalcMethod('埃及综合调查局')
  assert.equal(clockStore.muslimTimeMode, 'default')
  assert.equal(clockStore.settings.calcMethod, '埃及综合调查局')
})

test('MuslimAlarmSettings includes 2-line layout, 哺礼时间法, and custom options matching reference images', () => {
  const componentPath = path.resolve(__dirname, '../src/components/apps/clock/subpages/MuslimAlarmSettings.vue')
  const content = fs.readFileSync(componentPath, 'utf-8')

  // Correct naming: 哺礼时间法 instead of 哺乳
  assert.ok(content.includes('哺礼时间法'), 'Must specify 哺礼时间法')
  assert.ok(!content.includes('哺乳时间法'), 'Must NOT contain 哺乳 typo')

  // 2-line layout classes
  assert.ok(content.includes('setting-text-col'), 'Must include 2-line column layout')
  assert.ok(content.includes('setting-sublabel'), 'Must include subtitle value text')

  // Bottom sheet modal elements
  assert.ok(content.includes('bottom-sheet'), 'Must mount bottom sheet modal')
  assert.ok(content.includes('sheet-cancel-btn'), 'Must include cancel button')
  assert.ok(content.includes('option-radio'), 'Must include option radio indicator')

  // Custom options in lists
  assert.ok(content.includes("'自定义'"), "Must include '自定义' option in lists")
  assert.ok(content.includes('CALC_METHODS'), 'Must define CALC_METHODS')
  assert.ok(content.includes('ASR_METHODS'), 'Must define ASR_METHODS')
  assert.ok(content.includes('埃及综合调查局'), 'Must include 埃及综合调查局')
  assert.ok(content.includes('哈纳菲'), 'Must include 哈纳菲')
})

test('SettingsPrayer reminder linkage switches Muslim alarm methods to 自定义', () => {
  const componentPath = path.resolve(__dirname, '../src/components/apps/settings/SettingsPrayer.vue')
  const content = fs.readFileSync(componentPath, 'utf-8')

  assert.ok(content.includes("clockStore.settings.calcMethod = '自定义'"), 'Must switch calcMethod to 自定义 on enabling reminder')
  assert.ok(content.includes("clockStore.settings.prayerTimeMethod = '自定义'"), 'Must switch prayerTimeMethod to 自定义 on enabling reminder')
})

test('Muslim prayer wheel petals are symmetrically centered matching reference design', () => {
  const componentPath = path.resolve(__dirname, '../src/components/apps/clock/tabs/MuslimTab.vue')
  const content = fs.readFileSync(componentPath, 'utf-8')

  // Petal coordinates centered inside each circular petal
  assert.ok(content.includes('left: 260px;'), 'Sunrise and Dhuhr centered at x=260px')
  assert.ok(content.includes('left: 86px;'), 'Isha and Maghrib centered at x=86px')
  assert.ok(content.includes('top: 121px;'), 'Sunrise and Isha centered at y=121px')
  assert.ok(content.includes('top: 218px;'), 'Dhuhr and Maghrib centered at y=218px')
})

test('SettingsPrayer requires user authorization modal when activating reminder linkage', () => {
  const componentPath = path.resolve(__dirname, '../src/components/apps/settings/SettingsPrayer.vue')
  const content = fs.readFileSync(componentPath, 'utf-8')

  // Interception check for both un-enabled Muslim alarm and unlinked reminder state
  assert.ok(
    content.includes('!clockStore?.settings?.muslimAlarmEnabled || !prayerStore?.alarmLinkageEnabled'),
    'Must prompt authorization modal when Muslim alarm is not enabled or reminder linkage is inactive'
  )
  assert.ok(
    content.includes('clockStore.settings.muslimAlarmEnabled = false'),
    'Must reset muslimAlarmEnabled when user selects no reminder (val === -1)'
  )
})


