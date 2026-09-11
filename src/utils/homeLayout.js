export const HOME_LAYOUT_VERSION = 1
export const HOME_COLUMNS = 4
export const HOME_ROWS = 6
export const HOME_PAGE_CAPACITY = HOME_COLUMNS * HOME_ROWS

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
