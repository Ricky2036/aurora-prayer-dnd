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

test('prayerStore initializes alarm linkage default state properly', () => {
  setActivePinia(createPinia())
  const prayerStore = usePrayerStore()

  assert.equal(prayerStore.alarmLinkageEnabled, true)
  assert.equal(prayerStore.alarmAdvanceMinutes, 15)
  assert.equal(prayerStore.alarmRingtone, '麦加唤礼声')
})

test('prayerStore mutates alarm linkage properties and resets properly', () => {
  setActivePinia(createPinia())
  const prayerStore = usePrayerStore()

  prayerStore.setAlarmLinkage(false)
  assert.equal(prayerStore.alarmLinkageEnabled, false)

  prayerStore.setAlarmAdvanceMinutes(30)
  assert.equal(prayerStore.alarmAdvanceMinutes, 30)

  prayerStore.setAlarmRingtone('麦地那唤礼声')
  assert.equal(prayerStore.alarmRingtone, '麦地那唤礼声')

  // Reset to defaults
  prayerStore.resetDefaults()
  assert.equal(prayerStore.alarmLinkageEnabled, true)
  assert.equal(prayerStore.alarmAdvanceMinutes, 15)
  assert.equal(prayerStore.alarmRingtone, '麦加唤礼声')
})

test('clockStore settings and tabs support Muslim mode and alarm linkage', () => {
  setActivePinia(createPinia())
  const clockStore = useClockStore()

  assert.equal(clockStore.settings.muslimAlarmEnabled, true)
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
    'prayerAlarmLinkageDesc',
    'alarmAdvanceTime',
    'alarmRingtone',
    'openClockApp',
    'openClockAppDesc',
    'advance0Min',
    'advance10Min',
    'advance15Min',
    'advance30Min',
    'ringtoneMecca',
    'ringtoneMedina',
    'ringtoneAqsa',
    'ringtoneDawn',
    'ringtoneDefault'
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

test('SettingsPrayer component template includes Option 2 alarm linkage elements', () => {
  const componentPath = path.resolve(__dirname, '../src/components/apps/settings/SettingsPrayer.vue')
  const content = fs.readFileSync(componentPath, 'utf-8')

  // Section header
  assert.ok(content.includes('prayerAlarmHeader'), 'Must include prayerAlarmHeader')

  // Master switch
  assert.ok(content.includes('alarmLinkageEnabled'), 'Must bind alarmLinkageEnabled')
  assert.ok(content.includes('prayerAlarmLinkage'), 'Must include prayerAlarmLinkage title')
  assert.ok(content.includes('prayerAlarmLinkageDesc'), 'Must include prayerAlarmLinkageDesc')

  // Subgroup transition
  assert.ok(content.includes('name="subgroup-expand"'), 'Must have subgroup-expand transition')

  // Advance time cell & picker
  assert.ok(content.includes('alarmAdvanceTime'), 'Must include alarmAdvanceTime')
  assert.ok(content.includes('openAdvancePicker'), 'Must handle openAdvancePicker')
  assert.ok(content.includes('showAdvancePicker'), 'Must have showAdvancePicker modal')

  // Ringtone cell & picker
  assert.ok(content.includes('alarmRingtone'), 'Must include alarmRingtone')
  assert.ok(content.includes('openRingtonePicker'), 'Must handle openRingtonePicker')
  assert.ok(content.includes('showRingtonePicker'), 'Must have showRingtonePicker modal')

  // Clock App navigation jump
  assert.ok(content.includes('openClockApp'), 'Must include openClockApp')
  assert.ok(content.includes('openClockAppDesc'), 'Must include openClockAppDesc')
  assert.ok(content.includes('jumpToClockMuslim'), 'Must call jumpToClockMuslim')
  assert.ok(content.includes("clockStore.setActiveTab('muslim')"), 'jumpToClockMuslim must set active tab')
  assert.ok(content.includes("systemStore.openApp('clock')"), 'jumpToClockMuslim must open clock app')
})
