import { clamp } from './math.js'

export const NOTIFICATION_STACK_BOTTOM_INSET = 76

/**
 * Shared bottom-stack geometry for Notification Center and Lock Screen.
 * `cardBottom` and `viewportHeight` must use the same coordinate space.
 */
export function getNotificationStackLayout({
  cardBottom,
  viewportHeight,
  bottomInset = NOTIFICATION_STACK_BOTTOM_INSET,
  maxVisualOffset = 68,
  baseBackgroundAlpha = 0.14,
  deepBackgroundAlpha = 0.22,
  backgroundFadeStart = 0
}) {
  const bottomThreshold = viewportHeight - bottomInset
  if (cardBottom <= bottomThreshold) {
    return {
      stacked: false,
      translateY: 0,
      scale: 1,
      opacity: 1,
      backgroundAlpha: null,
      interactive: true
    }
  }

  const excess = cardBottom - bottomThreshold
  const stackIndex = excess / 48
  const maxVisualY = Math.max(0, maxVisualOffset)
  let visualY
  if (stackIndex <= 1) {
    visualY = stackIndex * 16
  } else if (stackIndex <= 2) {
    visualY = 16 + (stackIndex - 1) * 20
  } else if (stackIndex <= 3) {
    visualY = 36 + (stackIndex - 2) * 18
  } else {
    visualY = Math.min(maxVisualY, 54 + (stackIndex - 3) * 16)
  }

  const opacity = stackIndex > 1.6
    ? clamp(1 - (stackIndex - 1.6) / 2.2, 0, 1)
    : 1
  const backgroundProgress = clamp(stackIndex - backgroundFadeStart, 0, 1)

  return {
    stacked: true,
    translateY: -excess + visualY,
    scale: Math.max(0.78, 1 - stackIndex * 0.055),
    opacity,
    backgroundAlpha: clamp(
      baseBackgroundAlpha + backgroundProgress * (deepBackgroundAlpha - baseBackgroundAlpha),
      Math.min(baseBackgroundAlpha, deepBackgroundAlpha),
      Math.max(baseBackgroundAlpha, deepBackgroundAlpha)
    ),
    interactive: opacity >= 0.08
  }
}
