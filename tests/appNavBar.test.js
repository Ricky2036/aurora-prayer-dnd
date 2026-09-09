import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('AppNavBar component provides sticky pinning to prevent scrolling off screen', () => {
  const navBarPath = path.resolve(__dirname, '../src/components/ui/AppNavBar.vue')
  assert.ok(fs.existsSync(navBarPath), 'AppNavBar.vue must exist')

  const content = fs.readFileSync(navBarPath, 'utf8')

  // Sticky prop default true
  assert.ok(content.includes("sticky: { type: Boolean, default: true }"), 'AppNavBar must have sticky prop defaulting to true')
  assert.ok(content.includes(":class=\"{ 'is-sticky': sticky }\""), 'AppNavBar template must bind is-sticky class')

  // CSS rules for sticky pinning
  assert.ok(content.includes('.app-nav-bar.is-sticky'), 'Must define .app-nav-bar.is-sticky rule')
  assert.ok(content.includes('position: sticky;'), 'Must have position: sticky')
  assert.ok(content.includes('top: 0;'), 'Must pin to top: 0')
  assert.ok(content.includes('z-index: 10;'), 'Must have elevated z-index to stay above scrolled content')
  assert.ok(content.includes('backdrop-filter: blur(20px)'), 'Must have frosted glass blur effect')
})

test('SettingsNotifications pages include AppNavBar headers across all subviews', () => {
  const notifSettingsPath = path.resolve(__dirname, '../src/components/apps/settings/SettingsNotifications.vue')
  assert.ok(fs.existsSync(notifSettingsPath), 'SettingsNotifications.vue must exist')

  const content = fs.readFileSync(notifSettingsPath, 'utf8')

  // Verified presence in all 5 subviews
  assert.ok(content.includes('<AppNavBar :title="i18n.t(\'notifications\')"'), 'Main subview must render AppNavBar')
  assert.ok(content.includes('<AppNavBar :title="i18n.t(\'nsLockScreenNotif\')"'), 'Lock screen subview must render AppNavBar')
  assert.ok(content.includes('<AppNavBar :title="i18n.t(\'nsFloatingNotif\')"'), 'Floating subview must render AppNavBar')
  assert.ok(content.includes('<AppNavBar :title="i18n.t(\'nsDynamicBar\')"'), 'Dynamic Bar subview must render AppNavBar')
  assert.ok(content.includes('<AppNavBar :title="i18n.notifTitle(currentDetailApp.appId)"'), 'App detail subview must render AppNavBar')
})
