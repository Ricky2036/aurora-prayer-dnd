import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const SETTINGS_APP_PATH = path.resolve('src/components/apps/settings/SettingsApp.vue')
const SEARCH_BAR_PATH = path.resolve('src/components/ui/SettingsSearchBar.vue')
const LIST_CELL_PATH = path.resolve('src/components/ui/ListCell.vue')

test('SettingsApp.vue exists and includes all 8 standardized card groups matching reference recording', () => {
  assert.ok(fs.existsSync(SETTINGS_APP_PATH), 'SettingsApp.vue should exist')
  const content = fs.readFileSync(SETTINGS_APP_PATH, 'utf-8')

  // Group 1: User Account Card
  assert.match(content, /Ricky/, 'Account card should contain Ricky')
  assert.match(content, /使用云服务、查找等/, 'Account card should contain cloud subtitle')
  assert.match(content, /account-avatar/, 'Account card should have custom avatar')

  // Group 2: Device Model Card
  assert.match(content, /Infinix GT 50 Pro/, 'Device card should contain Infinix GT 50 Pro')

  // Group 3: Network & Connectivity (5 items)
  assert.match(content, /飞行模式/, 'Should contain 飞行模式')
  assert.match(content, /SIM卡与网络设置/, 'Should contain SIM卡与网络设置')
  assert.match(content, /WLAN/, 'Should contain WLAN')
  assert.match(content, /Ricky_5G/, 'WLAN should display connected network Ricky_5G')
  assert.match(content, /蓝牙/, 'Should contain 蓝牙')
  assert.match(content, /多设备连接/, 'Should contain 多设备连接')

  // Group 4: AI, Personalization, Display, Sound & Notifications (5 items)
  assert.match(content, /Infinix AI/, 'Should contain Infinix AI')
  assert.match(content, /壁纸与个性化/, 'Should contain 壁纸与个性化')
  assert.match(content, /显示与亮度/, 'Should contain 显示与亮度')
  assert.match(content, /声音与振动/, 'Should contain 声音与振动')
  assert.match(content, /通知与状态栏/, 'Should contain 通知与状态栏')

  // Group 5: Privacy & Security (4 items)
  assert.match(content, /密码与安全/, 'Should contain 密码与安全')
  assert.match(content, /权限与隐私/, 'Should contain 权限与隐私')
  assert.match(content, /应用管理/, 'Should contain 应用管理')
  assert.match(content, /位置信息/, 'Should contain 位置信息')

  // Group 6: System Features & Utilities (4 items)
  assert.match(content, /GT Zone/, 'Should contain GT Zone')
  assert.match(content, /辅助功能/, 'Should contain 辅助功能')
  assert.match(content, /电池与省电/, 'Should contain 电池与省电')
  assert.match(content, /存储/, 'Should contain 存储')

  // Group 7: Digital Well-being & Accounts (4 items)
  assert.match(content, /数字健康与家长控制/, 'Should contain 数字健康与家长控制')
  assert.match(content, /安全和紧急情况/, 'Should contain 安全和紧急情况')
  assert.match(content, /用户与账号/, 'Should contain 用户与账号')
  assert.match(content, /Google/, 'Should contain Google')

  // Group 8: System (1 item)
  assert.match(content, /系统/, 'Should contain 系统')
})

test('SettingsApp includes floating search bar and standardized card styling', () => {
  const content = fs.readFileSync(SETTINGS_APP_PATH, 'utf-8')

  // Floating search bar widget integration
  assert.match(content, /SettingsSearchBar/, 'Should mount SettingsSearchBar component')
  assert.match(content, /settings-floating-search/, 'Should have floating container for search bar')
  assert.match(content, /scroll-bottom-spacer/, 'Should include scroll spacer to prevent content cutoff')

  // Card border-radius 24px and pure white background
  assert.match(content, /border-radius:\s*24px/, 'Cards should have standardized 24px border radius')
  assert.match(content, /background:\s*#FFFFFF/, 'Cards should have pure white background')
  assert.match(content, /#F4F5F7/, 'Background should match modern tOS neutral tone')
})

test('SettingsSearchBar component provides search magnifying glass and microphone icon', () => {
  assert.ok(fs.existsSync(SEARCH_BAR_PATH), 'SettingsSearchBar.vue should exist')
  const content = fs.readFileSync(SEARCH_BAR_PATH, 'utf-8')

  assert.match(content, /search-icon/, 'Should render search magnifying glass icon')
  assert.match(content, /mic-icon/, 'Should render microphone icon')
  assert.match(content, /btn-clear/, 'Should render clear button when input has value')
  assert.match(content, /border-radius:\s*24px/, 'Search bar should have capsule 24px radius')
  assert.match(content, /height:\s*48px/, 'Search bar should have 48px height')
})

test('ListCell styling complies with updated squircle icon and divider norms', () => {
  assert.ok(fs.existsSync(LIST_CELL_PATH), 'ListCell.vue should exist')
  const content = fs.readFileSync(LIST_CELL_PATH, 'utf-8')

  assert.match(content, /width:\s*36px/, 'Icon width should be standardized to 36px')
  assert.match(content, /height:\s*36px/, 'Icon height should be standardized to 36px')
  assert.match(content, /border-radius:\s*10px/, 'Icon squircle radius should be 10px')
  assert.match(content, /#F0F1F3/, 'Divider separator color should be #F0F1F3')
})
