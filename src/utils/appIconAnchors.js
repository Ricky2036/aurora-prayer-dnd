import { rectRelativeToScreen } from './dom.js'

const homeAnchors = new Map()
let pendingLaunch = null
const HOME_LAYOUT_SUBPIXELS = 8

/**
 * 桌面四列网格和 Dock 的布局轨道天然落在 1/8 CSS px 上。舞台 transform 后
 * getBoundingClientRect 会先量化物理像素，再做逆缩放；统一恢复布局单位可避免
 * 丢失一个子像素。该规则对所有锚点一致，不包含分列或方向补偿。
 */
export function normalizeHomeAnchorRect(rect) {
  if (!rect) return null
  const normalized = {
    ...rect,
    x: Math.round(rect.x * HOME_LAYOUT_SUBPIXELS) / HOME_LAYOUT_SUBPIXELS,
    y: Math.round(rect.y * HOME_LAYOUT_SUBPIXELS) / HOME_LAYOUT_SUBPIXELS
  }
  Object.defineProperties(normalized, {
    cx: { enumerable: true, get() { return this.x + this.width / 2 } },
    cy: { enumerable: true, get() { return this.y + this.height / 2 } }
  })
  return normalized
}

export function registerAnchor(appId, element) {
  if (appId && element) homeAnchors.set(appId, element)
}

export function unregisterAnchor(appId, element) {
  if (homeAnchors.get(appId) === element) homeAnchors.delete(appId)
}

export function getAnchorRect(appId, viewport) {
  const element = homeAnchors.get(appId)
  if (!element?.isConnected) return null
  return normalizeHomeAnchorRect(rectRelativeToScreen(element, viewport))
}

export function setLaunchRect(appId, rect) {
  pendingLaunch = rect ? { appId, rect: { ...rect } } : null
}

export function consumeLaunchRect(appId) {
  if (pendingLaunch?.appId !== appId) return null
  const rect = pendingLaunch.rect
  pendingLaunch = null
  return rect
}
