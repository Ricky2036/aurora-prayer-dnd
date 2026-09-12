export const HOME_LAYOUT_VERSION = 1
export const HOME_COLUMNS = 4
export const HOME_ROWS = 6
export const HOME_PAGE_CAPACITY = HOME_COLUMNS * HOME_ROWS

const clamp = (min, value, max) => Math.max(min, Math.min(max, value))

/**
 * Builds a launcher-style layout profile from the unscaled screen box.
 * Stage transforms deliberately do not participate in this calculation.
 */
export function createHomeGridProfile({ width = 360, height = 788, safeTop = 54, safeBottom = 34 } = {}) {
  const viewportWidth = Math.max(240, Number(width) || 360)
  const viewportHeight = Math.max(420, Number(height) || 788)
  const minimumInset = 16
  const minimumGap = 12
  const iconSize = clamp(48, (viewportWidth - minimumInset * 2 - minimumGap * 3) / HOME_COLUMNS, 60)
  const gapX = clamp(minimumGap, (viewportWidth - minimumInset * 2 - iconSize * HOME_COLUMNS) / 3, 32)
  const workspaceWidth = iconSize * HOME_COLUMNS + gapX * 3
  const insetX = (viewportWidth - workspaceWidth) / 2
  const gapY = clamp(14, 14 + ((viewportHeight - 568) / 220) * 6, 20)
  const dockHeight = iconSize + 32
  const dockBottom = Math.max(20, (Number(safeBottom) || 34) - 6)
  const dockTop = viewportHeight - dockBottom - dockHeight
  const workspaceTop = (Number(safeTop) || 54) + 12
  const workspaceBottom = Math.max(workspaceTop + 150, dockTop - 40)
  const workspaceHeight = workspaceBottom - workspaceTop
  const largestDefaultItem = iconSize * 2 + gapX
  const compactScale = clamp(.8, workspaceHeight / largestDefaultItem, 1)

  return {
    columns: HOME_COLUMNS,
    width: viewportWidth,
    height: viewportHeight,
    iconSize,
    gapX,
    gapY,
    insetX,
    compactScale,
    workspaceRect: { left: insetX, top: workspaceTop, right: insetX + workspaceWidth, bottom: workspaceBottom, width: workspaceWidth, height: workspaceHeight },
    dockRect: { left: 14, top: dockTop, right: viewportWidth - 14, bottom: viewportHeight - dockBottom, height: dockHeight },
    indicatorY: dockTop - 20
  }
}

export function homeItemMetrics(item, folders = {}, profile = createHomeGridProfile()) {
  const span = itemSpan(item, folders)
  const scale = profile.compactScale || 1
  const unit = profile.iconSize * scale
  const gapX = profile.gapX * scale
  const gapY = profile.gapY * scale
  const width = span.w * unit + (span.w - 1) * gapX
  const appHeight = unit + 21 * scale
  let height = appHeight
  if (item?.type === 'widget') height = width
  else if (item?.type === 'folder' && span.h > 1) height = span.h * appHeight + (span.h - 1) * gapY
  return { spanX: span.w, spanY: span.h, width, height, unit, gapX, gapY }
}

function findSkylinePosition(bottoms, metrics, profile) {
  let best = null
  for (let col = 0; col <= profile.columns - metrics.spanX; col += 1) {
    const y = Math.max(...bottoms.slice(col, col + metrics.spanX))
    if (y + metrics.height > profile.workspaceRect.bottom + .01) continue
    if (!best || y < best.y - .01 || (Math.abs(y - best.y) < .01 && col < best.col)) best = { col, y }
  }
  return best
}

/** Packs canonical item order into viewport-derived pages and pixel frames. */
export function layoutHomeOrder(order, items, folders = {}, profile = createHomeGridProfile()) {
  const source = [...new Set((order || []).filter((id) => items[id]))]
  const pages = []
  const frames = {}
  let index = 0

  while (index < source.length || pages.length === 0) {
    const pageIndex = pages.length
    const page = []
    const pageFrames = {}
    const bottoms = Array(profile.columns).fill(profile.workspaceRect.top)

    while (index < source.length) {
      const id = source[index]
      const metrics = homeItemMetrics(items[id], folders, profile)
      const position = findSkylinePosition(bottoms, metrics, profile)
      if (!position && page.length) break

      const fallbackHeight = Math.min(metrics.height, profile.workspaceRect.height)
      const resolved = position || { col: 0, y: profile.workspaceRect.top }
      const frame = {
        x: profile.workspaceRect.left + resolved.col * (profile.iconSize * profile.compactScale + profile.gapX * profile.compactScale),
        y: resolved.y,
        width: metrics.width,
        height: fallbackHeight,
        col: resolved.col,
        spanX: metrics.spanX,
        spanY: metrics.spanY
      }
      page.push(id)
      pageFrames[id] = frame
      const nextBottom = frame.y + frame.height + metrics.gapY
      for (let col = frame.col; col < frame.col + frame.spanX; col += 1) bottoms[col] = nextBottom
      index += 1
    }

    pages.push(page)
    frames[pageIndex] = pageFrames
  }

  return { pages, frames, positions: frames }
}

export function globalRankForPageIndex(pages, pageIndex, itemIndex) {
  const before = (pages || []).slice(0, Math.max(0, pageIndex)).reduce((sum, page) => sum + page.length, 0)
  return before + clamp(0, Number(itemIndex) || 0, pages?.[pageIndex]?.length || 0)
}

export function insertionIndexAtPoint(page, frames, x, y) {
  if (!page?.length) return 0
  const ranked = page.map((id, index) => {
    const frame = frames?.[id]
    if (!frame) return { index, distance: Infinity }
    const cx = frame.x + frame.width / 2
    const cy = frame.y + frame.height / 2
    return { index, distance: Math.hypot(x - cx, y - cy), after: y > cy || (Math.abs(y - cy) < frame.height * .3 && x > cx) }
  }).sort((a, b) => a.distance - b.distance)[0]
  return clamp(0, ranked.index + (ranked.after ? 1 : 0), page.length)
}

const clampSpan = (value) => Math.max(1, Math.min(2, Number(value) || 1))

export function itemSpan(item, folders = {}) {
  if (!item) return { w: 1, h: 1 }
  if (item.type === 'folder') {
    const folder = folders[item.folderId]
    return {
      w: clampSpan(folder?.width ?? item.w),
      h: clampSpan(folder?.height ?? item.h)
    }
  }
  return { w: clampSpan(item.w), h: clampSpan(item.h) }
}

function canPlace(occupied, row, col, w, h) {
  if (col + w > HOME_COLUMNS || row + h > HOME_ROWS) return false
  for (let r = row; r < row + h; r += 1) {
    for (let c = col; c < col + w; c += 1) {
      if (occupied[r][c]) return false
    }
  }
  return true
}

function occupy(occupied, row, col, w, h) {
  for (let r = row; r < row + h; r += 1) {
    for (let c = col; c < col + w; c += 1) occupied[r][c] = true
  }
}

export function packHomePage(ids, items, folders = {}) {
  const occupied = Array.from({ length: HOME_ROWS }, () => Array(HOME_COLUMNS).fill(false))
  const placed = []
  const overflow = []
  const positions = {}

  for (const id of ids || []) {
    const item = items[id]
    if (!item) continue
    const { w, h } = itemSpan(item, folders)
    let found = null
    for (let row = 0; row < HOME_ROWS && !found; row += 1) {
      for (let col = 0; col < HOME_COLUMNS; col += 1) {
        if (canPlace(occupied, row, col, w, h)) {
          found = { row, col, w, h }
          break
        }
      }
    }
    if (!found) {
      overflow.push(id)
      continue
    }
    occupy(occupied, found.row, found.col, found.w, found.h)
    placed.push(id)
    positions[id] = found
  }

  return { ids: placed, positions, overflow }
}

export function reflowHomePages(rawPages, items, folders = {}) {
  const source = Array.isArray(rawPages) && rawPages.length ? rawPages : [[]]
  const pages = []
  const positions = {}
  let carry = []

  for (const rawPage of source) {
    const unique = []
    for (const id of [...carry, ...(Array.isArray(rawPage) ? rawPage : [])]) {
      if (items[id] && !unique.includes(id)) unique.push(id)
    }
    const packed = packHomePage(unique, items, folders)
    pages.push(packed.ids)
    positions[pages.length - 1] = packed.positions
    carry = packed.overflow
  }

  while (carry.length) {
    const packed = packHomePage(carry, items, folders)
    if (!packed.ids.length) break
    pages.push(packed.ids)
    positions[pages.length - 1] = packed.positions
    carry = packed.overflow
  }

  while (pages.length > 1 && pages.at(-1).length === 0) pages.pop()
  return { pages: pages.length ? pages : [[]], positions }
}

export function locateHomeItem(pages, itemId) {
  for (let page = 0; page < (pages || []).length; page += 1) {
    const index = pages[page]?.indexOf(itemId) ?? -1
    if (index >= 0) return { page, index }
  }
  return null
}

export function removeHomeItemFromPages(pages, itemId) {
  return (pages || []).map((page) => (page || []).filter((id) => id !== itemId))
}

export function moveHomeItem(pages, itemId, targetPage, targetIndex) {
  const next = removeHomeItemFromPages(pages, itemId).map((page) => [...page])
  while (next.length <= targetPage) next.push([])
  const index = Math.max(0, Math.min(Number(targetIndex) || 0, next[targetPage].length))
  next[targetPage].splice(index, 0, itemId)
  return next
}

export function cloneHomeState(value) {
  return JSON.parse(JSON.stringify(value))
}

export function resolveDesktopPage({ currentPage, pageCount, delta, velocity = 0, threshold = 72 }) {
  const lastPage = Math.max(0, pageCount - 1)
  if (delta < -threshold || velocity < -0.55) {
    if (currentPage >= lastPage) return { page: lastPage, openLibrary: true }
    return { page: currentPage + 1, openLibrary: false }
  }
  if (delta > threshold || velocity > 0.55) {
    return { page: Math.max(0, currentPage - 1), openLibrary: false }
  }
  return { page: currentPage, openLibrary: false }
}
