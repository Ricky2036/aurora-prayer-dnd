import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { indicatorDefs, orderedIndicators } from '../src/utils/statusBarIndicators.js'

test('status bar indicators priority order conforms to spec', () => {
  // Ordered indicators should be sorted ascending by priority (lowest to highest)
  assert.deepEqual(
    orderedIndicators.map(i => i.key),
    ['vibrate', 'mute', 'hotspot', 'bluetooth', 'dnd']
  )

  // Lowest priority indicators (vibrate, mute) should have smaller priority numbers than bluetooth and dnd
  const vibratePrio = indicatorDefs.find(i => i.key === 'vibrate').priority
  const btPrio = indicatorDefs.find(i => i.key === 'bluetooth').priority
  const dndPrio = indicatorDefs.find(i => i.key === 'dnd').priority
  assert.ok(vibratePrio < btPrio)
  assert.ok(btPrio < dndPrio)
})

test('show function accurately reflects control store states', () => {
  const dndItem = indicatorDefs.find(i => i.key === 'dnd')
  assert.equal(dndItem.show({ dnd: false, doNotDisturb: false }), false)
  assert.equal(dndItem.show({ dnd: true, doNotDisturb: false }), true)
  assert.equal(dndItem.show({ dnd: false, doNotDisturb: true }), true)

  const btItem = indicatorDefs.find(i => i.key === 'bluetooth')
  assert.equal(btItem.show({ bluetooth: false }), false)
  assert.equal(btItem.show({ bluetooth: true }), true)

  const muteItem = indicatorDefs.find(i => i.key === 'mute')
  assert.equal(muteItem.show({ soundMode: 'ring' }), false)
  assert.equal(muteItem.show({ soundMode: 'mute' }), true)
})

test('status bar time is preserved on home screen and apps, only hidden on lock screen', () => {
  const sbPath = new URL('../src/components/phone/StatusBar.vue', import.meta.url)
  const sbContent = fs.readFileSync(sbPath, 'utf8')

  assert.match(sbContent, /const hideTime = computed\(\(\) => \{\s*return system\.baseLayer === 'lock'\s*\}\)/)
  assert.doesNotMatch(sbContent, /recorder\.isRecording\s*&&\s*system\.activeAppId\s*!==\s*'voicememos'/)
})
