import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCurrentIslandPrayer } from '../src/utils/prayerIsland.js'

test('closing a prayer island suppresses the same prayer fallback', () => {
  const fajr = { id: 'fajr', enabled: true }
  assert.equal(resolveCurrentIslandPrayer({
    masterEnabled: true,
    simulatedPrayerId: null,
    dismissedPrayerId: 'fajr',
    activePrayer: null,
    userMode: 'muslim',
    prayers: [fajr]
  }), null)
})

test('a different prayer can appear after the dismissed prayer', () => {
  const dhuhr = { id: 'dhuhr', enabled: true }
  assert.equal(resolveCurrentIslandPrayer({
    masterEnabled: true,
    simulatedPrayerId: 'dhuhr',
    dismissedPrayerId: 'fajr',
    activePrayer: null,
    userMode: 'normal',
    prayers: [dhuhr]
  }), dhuhr)
})
