export const HERO_OPEN_DURATION = 420
export const HERO_CLOSE_DURATION = 320
export const HERO_MIN_CLOSE_DURATION = 160
export const HERO_HANDOFF_DURATION = 70

// AppIcon 的 SVG squircle 蒙版：角区占边长 28%，三次贝塞尔控制点位于角区 50%。
// Hero 裁切复用同一组几何常量，避免图标与底板各自近似圆角而在四角漏色。
export const ICON_SQUIRCLE_RADIUS_RATIO = 0.28
export const ICON_SQUIRCLE_CONTROL = 0.5
export const CIRCLE_CORNER_CONTROL = 0.5522847498

export const OPEN_TIMING = Object.freeze({
  iconOutStart: 0.00,
  iconOutEnd: 0.22,
  surfaceInStart: 0.15,
  surfaceInEnd: 0.50,
  contentInStart: 0.22,
  contentInEnd: 0.60,
  backdropInEnd: 0.18,
  backdropOutStart: 0.82
})

export const CLOSE_TIMING = Object.freeze({
  contentOutStart: 0.25,
  contentOutEnd: 0.66,
  surfaceOutStart: 0.32,
  surfaceOutEnd: 0.72,
  iconInStart: 0.45,
  iconInEnd: 0.82,
  heroFillOutStart: 0.82,
  heroFillOutEnd: 0.96,
  backdropSettleEnd: 0.18,
  backdropOutStart: 0.52
})

export function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

export function lerp(from, to, progress) {
  return from + (to - from) * progress
}

function timelineProgress(progress, start, end) {
  return clamp01((progress - start) / (end - start))
}

function cubicCoordinate(t, p1, p2) {
  const inverse = 1 - t
  return 3 * inverse * inverse * t * p1 + 3 * inverse * t * t * p2 + t * t * t
}

export function cubicBezierEase(progress, x1, y1, x2, y2) {
  const x = clamp01(progress)
  if (x === 0 || x === 1) return x

  let low = 0
  let high = 1
  let parameter = x
  for (let i = 0; i < 20; i += 1) {
    parameter = (low + high) / 2
    const estimate = cubicCoordinate(parameter, x1, x2)
    if (estimate < x) low = parameter
    else high = parameter
  }
  return cubicCoordinate(parameter, y1, y2)
}

/** 参考视频的强调减速启动：迅速离开图标，长尾柔和铺满屏幕。 */
export function openHeroEase(progress) {
  return cubicBezierEase(progress, 0.05, 0.7, 0.1, 1)
}

/** 退出使用独立曲线：前段稳定收拢，中后段快速归位并平滑停住。 */
export function closeHeroEase(progress) {
  return cubicBezierEase(progress, 0.2, 0, 0.6, 1)
}

export function makeViewportRect(width, height) {
  return { x: 0, y: 0, width, height }
}

export function interpolateRect(from, to, progress) {
  if (progress <= 0) return { ...from }
  if (progress >= 1) return { ...to }
  return {
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress)
  }
}

function openLayerState(progress) {
  const backdropIn = timelineProgress(progress, 0, OPEN_TIMING.backdropInEnd)
  const backdropOut = timelineProgress(progress, OPEN_TIMING.backdropOutStart, 1)
  return {
    iconOpacity: 1 - timelineProgress(progress, OPEN_TIMING.iconOutStart, OPEN_TIMING.iconOutEnd),
    appSurfaceOpacity: timelineProgress(progress, OPEN_TIMING.surfaceInStart, OPEN_TIMING.surfaceInEnd),
    contentOpacity: timelineProgress(progress, OPEN_TIMING.contentInStart, OPEN_TIMING.contentInEnd),
    heroFillOpacity: 1,
    // 图标完全淡出后，才把窗口顶角从图标 squircle 过渡到屏幕圆角。
    iconShapeProgress: 1 - timelineProgress(
      progress,
      OPEN_TIMING.iconOutEnd,
      OPEN_TIMING.surfaceInEnd
    ),
    backdropStrength: Math.min(backdropIn, 1 - backdropOut)
  }
}

function closeLayerState(progress, startBackdropStrength = 1) {
  const backdropSettle = timelineProgress(progress, 0, CLOSE_TIMING.backdropSettleEnd)
  const backdropOut = timelineProgress(progress, CLOSE_TIMING.backdropOutStart, 1)
  // smoothstep 让模糊在图标归位过程中平顺退出，并在精确锚点帧归零。
  // 不能把完整 12px 模糊留给 70ms handoff，否则图标静止后桌面会突然变清晰。
  const backdropOutEase = backdropOut * backdropOut * (3 - 2 * backdropOut)
  const settledBackdrop = lerp(startBackdropStrength, 1, backdropSettle)
  return {
    iconOpacity: timelineProgress(progress, CLOSE_TIMING.iconInStart, CLOSE_TIMING.iconInEnd),
    appSurfaceOpacity: 1 - timelineProgress(
      progress,
      CLOSE_TIMING.surfaceOutStart,
      CLOSE_TIMING.surfaceOutEnd
    ),
    contentOpacity: 1 - timelineProgress(
      progress,
      CLOSE_TIMING.contentOutStart,
      CLOSE_TIMING.contentOutEnd
    ),
    // 镜像完全显现后，在仍然运动的末段撤掉底板。终点只留下单层图标，
    // 避免 handoff 时底板、镜像、真实图标三层叠加造成亮度闪变。
    heroFillOpacity: 1 - timelineProgress(
      progress,
      CLOSE_TIMING.heroFillOutStart,
      CLOSE_TIMING.heroFillOutEnd
    ),
    // 图标开始淡入前已完成顶角拟合，因此整个重叠阶段不会从角落漏出底板色。
    iconShapeProgress: timelineProgress(
      progress,
      CLOSE_TIMING.surfaceOutStart,
      CLOSE_TIMING.iconInStart
    ),
    backdropStrength: settledBackdrop * (1 - backdropOutEase)
  }
}

/**
 * 计算 Hero 窗口的非对称圆角：
 * - 顶角在图标重叠阶段严格匹配 AppIcon 的 squircle；
 * - 下角在长窗口阶段保持应用窗口圆角，只在接近正方形时收敛到图标轮廓。
 */
export function deriveHeroClipGeometry({ windowRect, radius, iconShapeProgress = 0 }) {
  const shape = clamp01(iconShapeProgress)
  const iconRadius = windowRect.width * ICON_SQUIRCLE_RADIUS_RATIO
  const aspectRatio = windowRect.width > 0 ? windowRect.height / windowRect.width : 1
  const squareBlend = clamp01(2 - aspectRatio)
  const bottomShape = shape * squareBlend

  return {
    topRadius: lerp(radius, iconRadius, shape),
    bottomRadius: lerp(radius, iconRadius, bottomShape),
    topControl: lerp(CIRCLE_CORNER_CONTROL, ICON_SQUIRCLE_CONTROL, shape),
    bottomControl: lerp(CIRCLE_CORNER_CONTROL, ICON_SQUIRCLE_CONTROL, bottomShape)
  }
}

function roundedRectCornerPath(width, height, geometry) {
  const maxRadius = Math.max(0, Math.min(width, height) / 2)
  const topRadius = Math.min(maxRadius, Math.max(0, geometry.topRadius))
  const bottomRadius = Math.min(maxRadius, Math.max(0, geometry.bottomRadius))
  const topControl = geometry.topControl
  const bottomControl = geometry.bottomControl

  const trStart = width - topRadius
  const brStart = height - bottomRadius

  return [
    `M ${topRadius} 0`,
    `H ${trStart}`,
    `C ${trStart + topRadius * topControl} 0 ${width} ${topRadius * (1 - topControl)} ${width} ${topRadius}`,
    `V ${brStart}`,
    `C ${width} ${brStart + bottomRadius * bottomControl} ${width - bottomRadius * (1 - bottomControl)} ${height} ${width - bottomRadius} ${height}`,
    `H ${bottomRadius}`,
    `C ${bottomRadius * (1 - bottomControl)} ${height} 0 ${height - bottomRadius * (1 - bottomControl)} 0 ${height - bottomRadius}`,
    `V ${topRadius}`,
    `C 0 ${topRadius * (1 - topControl)} ${topRadius * (1 - topControl)} 0 ${topRadius} 0`,
    'Z'
  ].join(' ')
}

export function buildHeroClipPath(frame) {
  if (!frame?.windowRect) return 'none'
  const { width, height } = frame.windowRect
  const geometry = deriveHeroClipGeometry(frame)
  return `path("${roundedRectCornerPath(width, height, geometry)}")`
}

/**
 * 方向独立的纯函数 Hero 帧。所有几何、圆角、图层和桌面景深仍由同一个
 * requestAnimationFrame 时间参数派生，但启动不再是退出轨迹的机械倒放。
 */
export function deriveHeroFrame({
  direction,
  timeMs,
  duration = direction === 'open' ? HERO_OPEN_DURATION : HERO_CLOSE_DURATION,
  viewportRect,
  anchorRect,
  startRect,
  startRadius,
  startBackdropStrength,
  viewportRadius = 47,
  anchorRadius = 60 * ICON_SQUIRCLE_RADIUS_RATIO
}) {
  const elapsed = Math.min(duration, Math.max(0, timeMs))
  const timeProgress = duration > 0 ? elapsed / duration : 1
  const opening = direction === 'open'
  const geometryProgress = opening
    ? openHeroEase(timeProgress)
    : closeHeroEase(timeProgress)
  const fromRect = opening ? anchorRect : (startRect || viewportRect)
  const toRect = opening ? viewportRect : anchorRect
  const fromRadius = opening ? anchorRadius : (startRadius ?? viewportRadius)
  const toRadius = opening ? viewportRadius : anchorRadius
  const windowRect = interpolateRect(fromRect, toRect, geometryProgress)
  const layers = opening
    ? openLayerState(timeProgress)
    : closeLayerState(timeProgress, startBackdropStrength ?? 1)

  return {
    windowRect,
    radius: lerp(fromRadius, toRadius, geometryProgress),
    contentOpacity: layers.contentOpacity,
    appSurfaceOpacity: layers.appSurfaceOpacity,
    heroFillOpacity: layers.heroFillOpacity,
    iconShapeProgress: layers.iconShapeProgress,
    iconOpacity: layers.iconOpacity,
    iconScale: windowRect.width / anchorRect.width,
    iconNative: false,
    backdropStrength: layers.backdropStrength
  }
}

export function resolveCloseDuration({
  viewportRect,
  anchorRect,
  startRect = viewportRect,
  baseDuration = HERO_CLOSE_DURATION,
  minDuration = HERO_MIN_CLOSE_DURATION
}) {
  const fullDistance = Math.max(1, viewportRect.width - anchorRect.width)
  const remainingDistance = Math.max(0, startRect.width - anchorRect.width)
  return Math.max(minDuration, baseDuration * clamp01(remainingDistance / fullDistance))
}

/** 终点仅归一化图标渲染路径，不改变任何几何、颜色或透明度。 */
export function prepareNativeHandoffFrame(frame) {
  return { ...frame, iconScale: 1, iconNative: true }
}

export function deriveHandoffFrame(frame, progress) {
  const opacity = 1 - clamp01(progress)
  return {
    ...frame,
    // 静止交接阶段始终只显示一层全亮镜像；真实图标在结束帧原子替换它。
    iconOpacity: frame.iconOpacity,
    heroFillOpacity: frame.heroFillOpacity * opacity,
    backdropStrength: frame.backdropStrength * opacity
  }
}

/** 应用内返回手势的跟手预览；提交时该矩形会成为关闭动画的实际起点。 */
export function derivePreviewFrame(viewportRect, progress, viewportRadius = 47) {
  const p = clamp01(progress)
  const scale = 1 - p * 0.08
  const width = viewportRect.width * scale
  const height = viewportRect.height * scale

  return {
    windowRect: {
      x: (viewportRect.width - width) / 2 + p * 28,
      y: p * 40,
      width,
      height
    },
    radius: lerp(viewportRadius, 38, p),
    contentOpacity: 1,
    appSurfaceOpacity: 1,
    heroFillOpacity: 1,
    iconShapeProgress: 0,
    iconOpacity: 0,
    iconScale: width / 60,
    iconNative: false,
    backdropStrength: p
  }
}
