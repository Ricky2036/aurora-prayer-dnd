import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
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

test('prayer and media dynamic island default to closed / inactive state', () => {
  const compPathPrayer = new URL('../src/stores/prayerStore.js', import.meta.url)
  const contentPrayer = fs.readFileSync(compPathPrayer, 'utf8')
  assert.match(contentPrayer, /simulatedPrayerId:\s*null/, 'Prayer simulatedPrayerId must default to null')

  const compPathControl = new URL('../src/stores/controlStore.js', import.meta.url)
  const contentControl = fs.readFileSync(compPathControl, 'utf8')
  assert.match(contentControl, /mediaPlaying:\s*false/, 'ControlStore mediaPlaying must default to false')
  assert.match(contentControl, /mediaActive:\s*false/, 'ControlStore mediaActive must default to false')
})

