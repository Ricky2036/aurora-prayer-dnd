import assert from 'node:assert/strict'
import test from 'node:test'
import { APPS } from '../src/config/apps.js'
import { normalizeHomeAnchorRect } from '../src/utils/appIconAnchors.js'
import {
  buildHeroClipPath,
  CIRCLE_CORNER_CONTROL,
  closeHeroEase,
  deriveHeroClipGeometry,
  deriveHandoffFrame,
  deriveHeroFrame,
  derivePreviewFrame,
  HERO_CLOSE_DURATION,
  HERO_HANDOFF_DURATION,
  HERO_MIN_CLOSE_DURATION,
  HERO_OPEN_DURATION,
  ICON_SQUIRCLE_CONTROL,
  ICON_SQUIRCLE_RADIUS_RATIO,
  makeViewportRect,
  openHeroEase,
  prepareNativeHandoffFrame,
  resolveCloseDuration
} from '../src/utils/heroGeometry.js'

const viewport = makeViewportRect(389, 848)
const columns = [36.625, 121.875, 207.125, 292.375]
const rows = [251, 360, 469, 578]
const gridAnchors = rows
  .flatMap((y) => columns.map((x) => ({ x, y, width: 60, height: 60 })))
  .slice(0, 15)
const dockAnchors = [35.875, 121.625, 207.375, 293.125]
  .map((x) => ({ x, y: 744, width: 60, height: 60 }))
const allAnchors = [...gridAnchors, ...dockAnchors]

function heroFrame(direction, anchorRect, timeMs, extras = {}) {
  return deriveHeroFrame({
    direction,
    timeMs,
    viewportRect: viewport,
    anchorRect,
    ...extras
  })
}

function assertRectEqual(actual, expected, message) {
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.equal(actual[key], expected[key], `${message}: ${key}`)
  }
}

test('方向独立曲线符合参考视频的关键采样点', () => {
  assert.ok(openHeroEase(0.1) > 0.61 && openHeroEase(0.1) < 0.63)
  assert.ok(openHeroEase(0.25) > 0.82 && openHeroEase(0.25) < 0.84)
  assert.ok(openHeroEase(0.5) > 0.94 && openHeroEase(0.5) < 0.96)
  assert.ok(openHeroEase(0.75) > 0.98)

  assert.ok(closeHeroEase(0.1) > 0.05 && closeHeroEase(0.1) < 0.07)
  assert.ok(closeHeroEase(0.25) > 0.23 && closeHeroEase(0.25) < 0.26)
  assert.ok(closeHeroEase(0.5) > 0.59 && closeHeroEase(0.5) < 0.62)
  assert.ok(closeHeroEase(0.75) > 0.87 && closeHeroEase(0.75) < 0.90)
})

test('四列、全部网格行与 Dock 的启动/退出端点精确等于稳定锚点', () => {
  allAnchors.forEach((anchor, index) => {
    const openingStart = heroFrame('open', anchor, 0)
    const openingEnd = heroFrame('open', anchor, HERO_OPEN_DURATION)
    const closingEnd = heroFrame('close', anchor, HERO_CLOSE_DURATION)
    assertRectEqual(openingStart.windowRect, anchor, `open anchor ${index}`)
    assertRectEqual(openingEnd.windowRect, viewport, `open viewport ${index}`)
    assertRectEqual(closingEnd.windowRect, anchor, `close anchor ${index}`)
    assert.equal(closingEnd.iconScale, 1)
    assert.equal(closingEnd.iconOpacity, 1)
  })
})

test('启动和退出的所有几何字段严格单调且没有回弹', () => {
  for (const anchor of allAnchors) {
    for (const [direction, duration, target] of [
      ['open', HERO_OPEN_DURATION, viewport],
      ['close', HERO_CLOSE_DURATION, anchor]
    ]) {
      let previous = heroFrame(direction, anchor, 0).windowRect
      for (let time = 1; time <= duration; time += 1) {
        const next = heroFrame(direction, anchor, time).windowRect
        for (const key of ['x', 'y', 'width', 'height']) {
          assert.ok(
            Math.abs(target[key] - next[key]) <= Math.abs(target[key] - previous[key]) + 1e-10,
            `${direction} ${key} reversed at ${time}ms for ${JSON.stringify(anchor)}`
          )
        }
        previous = next
      }
    }
  }
})

test('图标底板色与镜像共同覆盖完整几何阶段且方向分层时序正确', () => {
  const anchor = gridAnchors[5]
  for (const [direction, duration] of [
    ['open', HERO_OPEN_DURATION],
    ['close', HERO_CLOSE_DURATION]
  ]) {
    for (let time = 0; time <= duration; time += 1) {
      const frame = heroFrame(direction, anchor, time)
      if (direction === 'open') {
        assert.equal(frame.heroFillOpacity, 1, `${direction} fill missing at ${time}ms`)
      } else {
        // 底板只在镜像已完全显现后退出，任何一帧都不会形成透明空档。
        assert.equal(
          Math.max(frame.heroFillOpacity, frame.iconOpacity),
          1,
          `${direction} hero coverage missing at ${time}ms`
        )
      }
      assert.ok(frame.contentOpacity >= 0 && frame.contentOpacity <= 1)
      assert.ok(frame.appSurfaceOpacity >= 0 && frame.appSurfaceOpacity <= 1)
      assert.ok(frame.iconOpacity >= 0 && frame.iconOpacity <= 1)
    }
  }

  const earlyOpen = heroFrame('open', anchor, HERO_OPEN_DURATION * 0.3)
  assert.equal(earlyOpen.heroFillOpacity, 1)
  assert.ok(earlyOpen.appSurfaceOpacity < 1)
  assert.ok(earlyOpen.contentOpacity < 1)

  const lateClose = heroFrame('close', anchor, HERO_CLOSE_DURATION * 0.65)
  assert.equal(lateClose.heroFillOpacity, 1)
  assert.ok(lateClose.appSurfaceOpacity < 1)
  assert.ok(lateClose.contentOpacity < 1)
  assert.ok(lateClose.iconOpacity > 0)
})

test('图标重叠阶段窗口顶角与 AppIcon squircle 精确同源', () => {
  const anchor = gridAnchors[6]
  const openingOverlap = heroFrame('open', anchor, HERO_OPEN_DURATION * 0.3)
  const closingOverlap = heroFrame('close', anchor, HERO_CLOSE_DURATION * 0.6)

  for (const current of [openingOverlap, closingOverlap]) {
    assert.equal(current.iconShapeProgress, 1)
    const clip = deriveHeroClipGeometry(current)
    assert.equal(clip.topRadius, current.windowRect.width * ICON_SQUIRCLE_RADIUS_RATIO)
    assert.equal(clip.topControl, ICON_SQUIRCLE_CONTROL)
    assert.match(buildHeroClipPath(current), /^path\("M /)
  }

  const fullyOpen = heroFrame('open', anchor, HERO_OPEN_DURATION)
  const openClip = deriveHeroClipGeometry(fullyOpen)
  assert.equal(fullyOpen.iconShapeProgress, 0)
  assert.equal(openClip.topRadius, fullyOpen.radius)
  assert.equal(openClip.topControl, CIRCLE_CORNER_CONTROL)

  const terminal = heroFrame('close', anchor, HERO_CLOSE_DURATION)
  const terminalClip = deriveHeroClipGeometry(terminal)
  assert.equal(terminal.radius, anchor.width * ICON_SQUIRCLE_RADIUS_RATIO)
  assert.equal(terminalClip.topRadius, terminal.radius)
  assert.equal(terminalClip.bottomRadius, terminal.radius)
  assert.equal(terminalClip.topControl, ICON_SQUIRCLE_CONTROL)
  assert.equal(terminalClip.bottomControl, ICON_SQUIRCLE_CONTROL)
})

test('原生交接不改几何，景深和底板已归零且单层镜像保持恒定亮度', () => {
  for (const anchor of allAnchors) {
    const terminal = heroFrame('close', anchor, HERO_CLOSE_DURATION)
    const native = prepareNativeHandoffFrame(terminal)
    assert.equal(native.iconNative, true)
    assertRectEqual(native.windowRect, anchor, 'native handoff')
    assert.equal(native.backdropStrength, 0)
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const handoff = deriveHandoffFrame(native, progress)
      assert.equal(handoff.iconOpacity, 1)
      assert.equal(handoff.heroFillOpacity, 0)
      assert.equal(handoff.backdropStrength, 0)
    }
  }
  assert.equal(HERO_HANDOFF_DURATION, 70)
})

test('退出模糊在图标归位过程中渐隐，并在几何终点前平滑归零', () => {
  const anchor = gridAnchors[9]
  const fadeStart = HERO_CLOSE_DURATION * 0.52
  assert.equal(heroFrame('close', anchor, fadeStart).backdropStrength, 1)

  let previous = 1
  let largestStep = 0
  for (let time = Math.ceil(fadeStart); time <= HERO_CLOSE_DURATION; time += 1) {
    const strength = heroFrame('close', anchor, time).backdropStrength
    assert.ok(strength <= previous + 1e-12, `backdrop reversed at ${time}ms`)
    largestStep = Math.max(largestStep, previous - strength)
    previous = strength
  }
  assert.equal(previous, 0)
  assert.ok(largestStep < 0.011, `backdrop step too large: ${largestStep}`)
})

test('手势续接保持首帧连续并按剩余距离缩短退出时长', () => {
  const anchor = gridAnchors[12]
  for (const progress of [0.16, 0.38, 0.72]) {
    const preview = derivePreviewFrame(viewport, progress, 47)
    const firstCloseFrame = heroFrame('close', anchor, 0, {
      startRect: preview.windowRect,
      startRadius: preview.radius,
      startBackdropStrength: preview.backdropStrength
    })
    assertRectEqual(firstCloseFrame.windowRect, preview.windowRect, `preview ${progress}`)
    assert.equal(firstCloseFrame.radius, preview.radius)
    assert.equal(firstCloseFrame.backdropStrength, preview.backdropStrength)
    const duration = resolveCloseDuration({
      viewportRect: viewport,
      anchorRect: anchor,
      startRect: preview.windowRect
    })
    assert.ok(duration < HERO_CLOSE_DURATION)
    assert.ok(duration >= HERO_MIN_CLOSE_DURATION)
  }

  assert.equal(resolveCloseDuration({
    viewportRect: viewport,
    anchorRect: anchor,
    startRect: viewport
  }), HERO_CLOSE_DURATION)
  assert.equal(resolveCloseDuration({
    viewportRect: viewport,
    anchorRect: anchor,
    startRect: { ...anchor, width: anchor.width + 1 }
  }), HERO_MIN_CLOSE_DURATION)
})

test('所有应用均配置非空的静态 Hero 底板色', () => {
  for (const app of APPS) {
    assert.equal(typeof app.heroBackground, 'string', `${app.id} heroBackground type`)
    assert.ok(app.heroBackground.trim().length > 0, `${app.id} heroBackground missing`)
  }
})

test('舞台逆缩放后的锚点统一恢复到桌面 1/8px 布局单位', () => {
  const normalized = normalizeHomeAnchorRect({
    x: 36.609375,
    y: 250.984375,
    width: 60,
    height: 60
  })
  assert.deepEqual(
    { x: normalized.x, y: normalized.y, width: normalized.width, height: normalized.height },
    { x: 36.625, y: 251, width: 60, height: 60 }
  )
  assert.equal(normalized.cx, 66.625)
  assert.equal(normalized.cy, 281)
})
