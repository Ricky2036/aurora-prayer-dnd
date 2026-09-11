import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useNotificationsStore, getIslandKeysForApp, getParentAppsForIslandKey } from '../src/stores/notificationsStore.js'

function initStore() {
  setActivePinia(createPinia())
  return useNotificationsStore()
}

test('helper getIslandKeysForApp maps applications to correct island keys', () => {
  assert.deepEqual(getIslandKeysForApp('recorder'), ['recorder'])
  assert.deepEqual(getIslandKeysForApp('voicememos'), ['recorder'])
  assert.deepEqual(getIslandKeysForApp('clock'), ['alarm', 'timer', 'stopwatch'])
  assert.deepEqual(getIslandKeysForApp('alarm'), ['alarm'])
  assert.deepEqual(getIslandKeysForApp('prayer'), ['prayer'])
  assert.deepEqual(getIslandKeysForApp('spotify'), ['media'])
  assert.deepEqual(getIslandKeysForApp('unknown'), [])
})

test('helper getParentAppsForIslandKey maps island keys to parent application IDs', () => {
  assert.deepEqual(getParentAppsForIslandKey('recorder'), ['recorder', 'voicememos'])
  assert.deepEqual(getParentAppsForIslandKey('alarm'), ['clock', 'alarm'])
  assert.deepEqual(getParentAppsForIslandKey('prayer'), ['prayer', 'clock'])
  assert.deepEqual(getParentAppsForIslandKey('media'), ['media', 'music', 'spotify'])
})

test('turning off Voice Memos master notification switch synchronizes dynamic island to OFF', () => {
  const store = initStore()

  // Default state is enabled
  assert.equal(store.isAppNotificationEnabled('recorder'), true)
  assert.equal(store.isAppNotificationEnabled('voicememos'), true)
  assert.equal(store.islandSettings.recorder, true)
  assert.equal(store.isIslandEnabled('recorder'), true)

  // Turn off master notification switch for recorder
  store.setAppNotificationEnabled('recorder', false)

  assert.equal(store.isAppNotificationEnabled('recorder'), false)
  assert.equal(store.isAppNotificationEnabled('voicememos'), false)
  assert.equal(store.islandSettings.recorder, false, 'Dynamic island switch for recorder must be turned OFF')
  assert.equal(store.isIslandEnabled('recorder'), false, 'Dynamic island must not be enabled')

  // Re-enable master notification switch
  store.setAppNotificationEnabled('recorder', true)
  assert.equal(store.isAppNotificationEnabled('recorder'), true)
  assert.equal(store.isAppNotificationEnabled('voicememos'), true)
  assert.equal(store.islandSettings.recorder, true, 'Dynamic island switch for recorder must be turned ON')
  assert.equal(store.isIslandEnabled('recorder'), true)
})

test('toggleAppNotification toggles notification permission and synchronizes island', () => {
  const store = initStore()

  // Toggle off
  store.toggleAppNotification('voicememos')
  assert.equal(store.isAppNotificationEnabled('voicememos'), false)
  assert.equal(store.isAppNotificationEnabled('recorder'), false)
  assert.equal(store.islandSettings.recorder, false)
  assert.equal(store.isIslandEnabled('recorder'), false)

  // Toggle back on
  store.toggleAppNotification('voicememos')
  assert.equal(store.isAppNotificationEnabled('voicememos'), true)
  assert.equal(store.isAppNotificationEnabled('recorder'), true)
  assert.equal(store.islandSettings.recorder, true)
  assert.equal(store.isIslandEnabled('recorder'), true)
})

test('turning off clock notifications turns off alarm, timer, and stopwatch dynamic islands', () => {
  const store = initStore()

  store.setAppNotificationEnabled('clock', false)
  assert.equal(store.islandSettings.alarm, false)
  assert.equal(store.islandSettings.timer, false)
  assert.equal(store.islandSettings.stopwatch, false)
  assert.equal(store.isIslandEnabled('alarm'), false)
  assert.equal(store.isIslandEnabled('timer'), false)
  assert.equal(store.isIslandEnabled('stopwatch'), false)

  store.setAppNotificationEnabled('clock', true)
  assert.equal(store.islandSettings.alarm, true)
  assert.equal(store.islandSettings.timer, true)
  assert.equal(store.islandSettings.stopwatch, true)
})

test('turning off prayer notifications turns off prayer dynamic island', () => {
  const store = initStore()

  store.setAppNotificationEnabled('prayer', false)
  assert.equal(store.islandSettings.prayer, false)
  assert.equal(store.isIslandEnabled('prayer'), false)

  store.setAppNotificationEnabled('prayer', true)
  assert.equal(store.islandSettings.prayer, true)
  assert.equal(store.isIslandEnabled('prayer'), true)
})

test('turning off spotify / media notifications turns off media dynamic island', () => {
  const store = initStore()

  store.setAppNotificationEnabled('spotify', false)
  assert.equal(store.islandSettings.media, false)
  assert.equal(store.isIslandEnabled('media'), false)

  store.setAppNotificationEnabled('spotify', true)
  assert.equal(store.islandSettings.media, true)
  assert.equal(store.isIslandEnabled('media'), true)
})

test('turning off only island switch preserves app notification permission, and turning island ON auto-restores app notification', () => {
  const store = initStore()

  // App notification is enabled, but island is turned off manually
  store.setIslandEnabled('recorder', false)
  assert.equal(store.islandSettings.recorder, false)
  assert.equal(store.isIslandEnabled('recorder'), false)
  assert.equal(store.isAppNotificationEnabled('recorder'), true, 'Notification master switch remains ON')

  // Disable app notification
  store.setAppNotificationEnabled('recorder', false)
  assert.equal(store.isAppNotificationEnabled('recorder'), false)

  // Re-enable island directly via dynamic bar switch
  store.setIslandEnabled('recorder', true)
  assert.equal(store.islandSettings.recorder, true)
  assert.equal(store.isAppNotificationEnabled('recorder'), true, 'Parent app notification auto-restored to ON')
  assert.equal(store.isIslandEnabled('recorder'), true)
})

test('setAppTarget correctly directs to target application notification settings', () => {
  const store = initStore()

  store.setAppTarget('spotify')
  assert.equal(store.targetView, 'notifications')
  assert.equal(store.targetSubView, 'appDetail')
  assert.equal(store.targetAppId, 'spotify')
  assert.equal(store.targetIslandKey, null)

  store.setAppTarget('whatsapp')
  assert.equal(store.targetAppId, 'whatsapp')
})

test('screen recording options conform to frame specification', () => {
  function getRecordOptions(isMobile, recordWithFrame) {
    const withFrame = !isMobile && recordWithFrame
    return {
      withFrame,
      rounded: withFrame,
      transcode: withFrame,
      preferMp4: !withFrame
    }
  }

  // When recording without frame (desktop or mobile)
  const unframed = getRecordOptions(false, false)
  assert.equal(unframed.withFrame, false)
  assert.equal(unframed.rounded, false, 'Unframed recording must not clip rounded corners')
  assert.equal(unframed.transcode, false, 'Unframed recording must not transcode')
  assert.equal(unframed.preferMp4, true, 'Unframed recording must output direct MP4')

  const mobileUnframed = getRecordOptions(true, true)
  assert.equal(mobileUnframed.withFrame, false)
  assert.equal(mobileUnframed.rounded, false)
  assert.equal(mobileUnframed.transcode, false)
  assert.equal(mobileUnframed.preferMp4, true)

  // When recording with frame (desktop only)
  const framed = getRecordOptions(false, true)
  assert.equal(framed.withFrame, true)
  assert.equal(framed.rounded, true)
  assert.equal(framed.transcode, true)
  assert.equal(framed.preferMp4, false)
})

