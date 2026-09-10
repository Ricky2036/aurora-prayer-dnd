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

test('ClockApp conditionally renders 5-Tab when muslimAlarmEnabled is true and 4-Tab when false', () => {
  const clockAppPath = path.resolve(__dirname, '../src/components/apps/clock/ClockApp.vue')
  const content = fs.readFileSync(clockAppPath, 'utf8')

  assert.ok(content.includes('isMuslimAlarmEnabled'), 'Must compute isMuslimAlarmEnabled')
  assert.ok(content.includes('clock.settings.muslimAlarmEnabled'), 'Must bind to clock.settings.muslimAlarmEnabled')
  assert.ok(content.includes("id: 'muslim', name: '穆斯林'"), 'Must define 穆斯林 tab')
  assert.ok(content.includes("activeTab.value = 'alarm'"), 'Must fallback to alarm tab when disabled')
})

test('MuslimTab component faithfully implements Islamic prayer compass wheel and reference design', () => {
  const muslimPath = path.resolve(__dirname, '../src/components/apps/clock/tabs/MuslimTab.vue')
  assert.ok(fs.existsSync(muslimPath), 'MuslimTab.vue must exist')

  const content = fs.readFileSync(muslimPath, 'utf8')

  // Date and location
  assert.ok(content.includes('gregorianDate = \'10\''), 'Must show day 10')
  assert.ok(content.includes('gregorianMonth = \'九月\''), 'Must show month September')
  assert.ok(content.includes('weekDayStr = \'星期四\''), 'Must show Thursday')
  assert.ok(content.includes('locationCity = \'深圳市\''), 'Must show Shenzhen')
  assert.ok(content.includes('hijriDate = \'27\''), 'Must show Hijri date 27')
  assert.ok(content.includes('hijriMonth = \'回历 3 月\''), 'Must show Hijri month 3')

  // 6 prayer slots and exact times
  assert.ok(content.includes('04:54'), '晨礼 must be 04:54')
  assert.ok(content.includes('06:07'), '日出 must be 06:07')
  assert.ok(content.includes('12:21'), '晌礼 must be 12:21')
  assert.ok(content.includes('15:48'), '哺礼 must be 15:48')
  assert.ok(content.includes('18:34'), '昏礼 must be 18:34')
  assert.ok(content.includes('19:45'), '宵礼 must be 19:45')

  // Highlights and Kaaba
  assert.ok(content.includes('orange-highlight'), '晌礼 must be orange highlighted')
  assert.ok(content.includes('dhuhr-curled-tail'), '晌礼 must feature curled tail and sparkle')
  assert.ok(content.includes('kaaba-badge-indicator'), '宵礼 must feature Kaaba badge indicator')
  assert.ok(content.includes('center-compass-dial'), 'Must include center compass dial')
  assert.ok(content.includes('kaaba-compass-needle'), 'Must include red compass needle')
  assert.ok(content.includes('filigree-mandala-bg'), 'Must include arabesque mandala background')

  // Top header button, popover modal, and large title
  assert.ok(content.includes('more-menu-btn'), 'Must include 44px top right circular menu button')
  assert.ok(content.includes('popover-menu'), 'Must include popover menu card')
  assert.ok(content.includes('穆斯林闹钟'), 'Popover must contain Muslim Alarm option')
  assert.ok(content.includes('设置'), 'Popover must contain Settings option')
  assert.ok(content.includes('large-title-section'), 'Must include large title section')
  assert.ok(content.includes('page-title'), 'Must include page title element')

  // Geometry: outward flaring crescents, 4 compass teeth, NWSE alignment, 12-petal rosette, white Kaaba badge
  assert.ok(content.includes('center-rosette-bg'), 'Must include center 12-petal lotus rosette')
  assert.ok(content.includes('center-rosette-inner-contour'), 'Must include decorative inner rosette contour')
  assert.ok(content.includes('26, 116, 206, 296'), '4 compass teeth must align with 4 cardinal compass axes')
  assert.ok(content.includes('rotate(26 190 190)'), 'Letter N must align with North tooth at 26 deg')
  assert.ok(content.includes('rotate(116 190 190)'), 'Letter E must align with East tooth at 116 deg')
  assert.ok(content.includes('rotate(206 190 190)'), 'Letter S must align with South tooth at 206 deg')
  assert.ok(content.includes('rotate(296 190 190)'), 'Letter W must align with West tooth at 296 deg')
  assert.ok(content.includes('fill="#FFFFFF" stroke="#E6981A"'), 'Kaaba badge must have white disc with gold border')
  assert.ok(content.includes('Bab al-Kaaba'), 'Kaaba badge must feature Golden Door on right face')
})

