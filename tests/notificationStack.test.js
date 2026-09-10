import test from 'node:test'
import assert from 'node:assert/strict'
import { getNotificationStackLayout } from '../src/utils/notificationStack.js'

test('cards remain unstacked while they fit above the shared bottom threshold', () => {
  assert.deepEqual(getNotificationStackLayout({ cardBottom: 768, viewportHeight: 844 }), {
    stacked: false,
    translateY: 0,
    scale: 1,
    opacity: 1,
    backgroundAlpha: null,
    interactive: true
  })
})

test('notification center and lock screen receive identical stack geometry', () => {
  const input = { cardBottom: 816, viewportHeight: 844 }
  const notificationCenter = getNotificationStackLayout(input)
  const lockScreen = getNotificationStackLayout(input)
  assert.deepEqual(lockScreen, notificationCenter)
  assert.equal(notificationCenter.stacked, true)
  assert.equal(notificationCenter.translateY, -32)
  assert.equal(notificationCenter.scale, 0.945)
  assert.equal(notificationCenter.opacity, 1)
})

test('deep overflow fades out and cannot intercept gestures', () => {
  const layout = getNotificationStackLayout({ cardBottom: 960, viewportHeight: 844 })
  assert.equal(layout.stacked, true)
  assert.equal(layout.opacity, 0)
  assert.equal(layout.interactive, false)
})

test('lock screen can reserve shortcut space and keep stacked glass opaque', () => {
  const layout = getNotificationStackLayout({
    cardBottom: 760,
    viewportHeight: 844,
    bottomInset: 140,
    maxVisualOffset: 36,
    baseBackgroundAlpha: 0.98,
    deepBackgroundAlpha: 0.82,
    backgroundFadeStart: 1
  })

  assert.equal(layout.stacked, true)
  assert.ok(760 + layout.translateY <= 740)
  assert.ok(layout.backgroundAlpha >= 0.82)
  assert.ok(layout.backgroundAlpha <= 0.98)
})

test('lock screen stack opacity decreases from the front card toward deeper cards', () => {
  const options = {
    viewportHeight: 844,
    bottomInset: 140,
    maxVisualOffset: 36,
    baseBackgroundAlpha: 0.98,
    deepBackgroundAlpha: 0.82,
    backgroundFadeStart: 1
  }
  const front = getNotificationStackLayout({ ...options, cardBottom: 716 })
  const back = getNotificationStackLayout({ ...options, cardBottom: 820 })

  assert.ok(front.backgroundAlpha > back.backgroundAlpha)
  assert.equal(front.backgroundAlpha, 0.98)
  assert.ok(front.opacity > back.opacity)
})
