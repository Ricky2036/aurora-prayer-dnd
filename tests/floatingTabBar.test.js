import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('FloatingTabBar component file exists and contains standard UI design properties', () => {
  const tabbarPath = path.resolve(__dirname, '../src/components/ui/FloatingTabBar.vue')
  assert.ok(fs.existsSync(tabbarPath), 'FloatingTabBar.vue must exist')

  const content = fs.readFileSync(tabbarPath, 'utf8')

  // Props verification
  assert.ok(content.includes('modelValue:'), 'Must accept modelValue prop for v-model binding')
  assert.ok(content.includes('tabs:'), 'Must accept tabs array prop')
  assert.ok(content.includes('height:'), 'Must accept height prop')
  assert.ok(content.includes('bottom:'), 'Must accept bottom prop')
  assert.ok(content.includes('accentColor:'), 'Must accept accentColor prop')

  // Emits verification
  assert.ok(content.includes("emit('update:modelValue'"), 'Must emit update:modelValue on tab click')
  assert.ok(content.includes("emit('change'"), 'Must emit change event on tab click')

  // Visual specifications from 时钟.mp4 reference
  assert.ok(content.includes('border-radius: 9999px'), 'Outer container and pill must be pill-shaped (9999px radius)')
  assert.ok(content.includes('nav-sliding-pill-track'), 'Must feature dynamic sliding indicator track')
  assert.ok(content.includes('nav-highlight-pill'), 'Must feature translucent highlight pill')
  assert.ok(content.includes('backdrop-filter: blur(28px)'), 'Must feature 28px blur frosted glass material')
  assert.ok(content.includes('cubic-bezier(0.25, 1, 0.5, 1)'), 'Must use smooth fluid sliding curve')
  assert.ok(content.includes('rgba(255, 255, 255, 0.16)'), 'Highlight pill background must match reference translucent gray')
})

test('ClockApp delegates bottom navigation to global FloatingTabBar component', () => {
  const clockAppPath = path.resolve(__dirname, '../src/components/apps/clock/ClockApp.vue')
  assert.ok(fs.existsSync(clockAppPath), 'ClockApp.vue must exist')

  const content = fs.readFileSync(clockAppPath, 'utf8')

  assert.ok(content.includes("import FloatingTabBar from '../../ui/FloatingTabBar.vue'"), 'ClockApp must import FloatingTabBar')
  assert.ok(content.includes('<FloatingTabBar'), 'ClockApp template must render FloatingTabBar')
  assert.ok(content.includes('v-model="activeTab"'), 'Must bind activeTab with v-model')
  assert.ok(content.includes('height="62px"'), 'Height must be pixel-aligned to 62px')
  assert.ok(content.includes('bottom="22px"'), 'Bottom margin must be pixel-aligned to 22px')
})

test('AlarmTab and WorldClockTab implement list scroll mask fade-out gradient and bottom clearance', () => {
  const alarmPath = path.resolve(__dirname, '../src/components/apps/clock/tabs/AlarmTab.vue')
  const worldClockPath = path.resolve(__dirname, '../src/components/apps/clock/tabs/WorldClockTab.vue')

  const alarmContent = fs.readFileSync(alarmPath, 'utf8')
  const worldClockContent = fs.readFileSync(worldClockPath, 'utf8')

  // AlarmTab mask-image
  assert.ok(alarmContent.includes('-webkit-mask-image: linear-gradient'), 'AlarmTab must include -webkit-mask-image')
  assert.ok(alarmContent.includes('mask-image: linear-gradient'), 'AlarmTab must include mask-image')
  assert.ok(alarmContent.includes('transparent calc(100% - 22px)'), 'AlarmTab mask must completely fade to transparent at tab bar bottom (22px)')
  assert.ok(alarmContent.includes('padding: 8px 16px 110px'), 'AlarmTab must include 110px bottom clearance')

  // WorldClockTab mask-image
  assert.ok(worldClockContent.includes('-webkit-mask-image: linear-gradient'), 'WorldClockTab must include -webkit-mask-image')
  assert.ok(worldClockContent.includes('mask-image: linear-gradient'), 'WorldClockTab must include mask-image')
  assert.ok(worldClockContent.includes('padding: 10px 16px 110px'), 'WorldClockTab must include 110px bottom clearance')
})

test('TimerTab and StopwatchTab avoid footer collision with the 62px floating tab bar', () => {
  const timerPath = path.resolve(__dirname, '../src/components/apps/clock/tabs/TimerTab.vue')
  const stopwatchPath = path.resolve(__dirname, '../src/components/apps/clock/tabs/StopwatchTab.vue')

  const timerContent = fs.readFileSync(timerPath, 'utf8')
  const stopwatchContent = fs.readFileSync(stopwatchPath, 'utf8')

  assert.ok(timerContent.includes('margin-bottom: calc(22px + 62px + 12px)'), 'Timer control footer must clear 62px tab bar with 12px gap')
  assert.ok(stopwatchContent.includes('margin-bottom: calc(22px + 62px + 12px)'), 'Stopwatch control footer must clear 62px tab bar with 12px gap')
})
