/**
 * 控制中心网格布局引擎（移植自 android_control_center.tsx）。
 * 4 列绝对二维坐标系：打包排版 / 碰撞检测 / swap 模式虚拟显示引擎 / FLIP 动画。
 */

const GRID_COLS = 4
const MAX_GRID_ROWS = 128

/** 把 w/h 规范化到 [1, max]：NaN / undefined / 0 / 负数 / 超界一律钳制。
 *  这是 packLayout 不死循环的前提——保证内层 `c <= GRID_COLS - w` 至少执行一次。 */
function normalizeSpan(value, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  const i = Math.trunc(n)
  if (i < 1) return 1
  return i > max ? max : i
}

/**
 * 紧凑打包：按数组顺序把卡片塞入 4 列网格，返回带 r/c 坐标的布局。
 * 入口防御：w/h 先规范化，保证内层至少执行一次、外层行数有上界，循环必然收敛。
 * 返回结构与防御前完全一致：元素顺序不变，仍是 {...item, r, c}。
 */
export function packLayout(items) {
  const grid = []
  const packed = []
  if (!Array.isArray(items)) return packed

  items.forEach((item) => {
    if (!item) return
    const newItem = { ...item }
    // 钳制后写回：避免下游 cellStyle 生成 `span NaN` 这类无效 CSS
    const w = normalizeSpan(newItem.w, GRID_COLS)
    const h = normalizeSpan(newItem.h, MAX_GRID_ROWS)
    newItem.w = w
    newItem.h = h

    let placed = false
    let r = 0
    for (; !placed && r < MAX_GRID_ROWS; r++) {
      if (!grid[r]) grid[r] = [null, null, null, null]
      for (let c = 0; c <= GRID_COLS - w; c++) {
        let free = true
        for (let ir = 0; ir < h && free; ir++) {
          if (!grid[r + ir]) grid[r + ir] = [null, null, null, null]
          for (let ic = 0; ic < w; ic++) {
            if (grid[r + ir][c + ic]) { free = false; break }
          }
        }
        if (free) {
          for (let ir = 0; ir < h; ir++) {
            for (let ic = 0; ic < w; ic++) {
              grid[r + ir][c + ic] = newItem.id
            }
          }
          newItem.r = r
          newItem.c = c
          packed.push(newItem)
          placed = true
          break
        }
      }
    }
    // 兜底（正常数据不可达）：保证 packed 数量与输入一致，
    // 否则 computeDisplayLayout 的 find-by-id 会漏项、FLIP 会错位
    if (!placed) {
      newItem.r = r
      newItem.c = 0
      packed.push(newItem)
    }
  })
  return packed
}

/** 碰撞检测雷达 */
export function isOverlapping(a, b) {
  return !(a.c >= b.c + b.w || a.c + a.w <= b.c || a.r >= b.r + b.h || a.r + a.h <= b.r)
}

/**
 * 虚拟显示引擎：拖拽中实时推演排版（不落库）。
 * mode 'swap'：1v1 等比交换 / 垂直隧道打压下落 / 空位直接落户（绝对坐标沉降）；
 * mode 'flow'：经典流式推挤——按插入位置重排数组后整体紧凑打包（后续卡片顺延、空位吸附）。
 */
export function computeDisplayLayout(layout, dragState, mode = 'swap') {
  if (!dragState) return layout
  const preview = JSON.parse(JSON.stringify(layout))
  const dragged = preview.find((i) => i.id === dragState.id)
  if (!dragged) return layout

  // 拖回原位：不做任何排挤
  if (dragState.curR === dragState.startR && dragState.curC === dragState.startC) {
    return preview
  }

  if (mode === 'flow') {
    dragged.r = dragState.curR
    dragged.c = dragState.curC
    const sorted = preview
      .filter((i) => i.id !== dragged.id)
      .sort((a, b) => (a.r !== b.r ? a.r - b.r : a.c - b.c))
    const insertWeight = dragState.curR * 4 + dragState.curC
    let insertIdx = sorted.findIndex((i) => i.r * 4 + i.c >= insertWeight)
    if (insertIdx === -1) insertIdx = sorted.length
    sorted.splice(insertIdx, 0, dragged)
    return packLayout(sorted)
  }

  const tempDragged = { ...dragged, r: dragState.curR, c: dragState.curC }
  const colliding = preview.filter((i) => i.id !== dragged.id && isOverlapping(i, tempDragged))

  if (colliding.length === 1 && colliding[0].w === dragged.w && colliding[0].h === dragged.h) {
    // 完美 1v1 等比例位置交换
    colliding[0].r = dragState.startR
    colliding[0].c = dragState.startC
    dragged.r = dragState.curR
    dragged.c = dragState.curC
  } else if (colliding.length > 0) {
    // 精准垂直打压下落（垂直隧道算法）
    const pushAmount = dragged.h
    const itemsToPush = new Set(colliding.map((i) => i.id))
    let done = false
    while (!done) {
      done = true
      for (const item of preview) {
        if (item.id === dragged.id || itemsToPush.has(item.id)) continue
        for (const pushedId of itemsToPush) {
          const pushedItem = preview.find((i) => i.id === pushedId)
          const tempPushed = { ...pushedItem, r: pushedItem.r + pushAmount }
          if (isOverlapping(tempPushed, item)) {
            itemsToPush.add(item.id)
            done = false
            break
          }
        }
      }
    }
    preview.forEach((item) => {
      if (itemsToPush.has(item.id)) item.r += pushAmount
    })
    dragged.r = dragState.curR
    dragged.c = dragState.curC
  } else {
    dragged.r = dragState.curR
    dragged.c = dragState.curC
  }
  return preview
}

/** FLIP：记录网格子节点当前位置（数据改变后对比播动画） */
export function recordPositions(gridEl, store) {
  const nodes = gridEl?.children
  if (!nodes) return
  const pos = {}
  for (const node of nodes) {
    if (node.dataset?.id) pos[node.dataset.id] = node.getBoundingClientRect()
  }
  store.positions = pos
}

/** FLIP：对比上一次记录的位置，位移节点播放补间 */
export function applyFlip(gridEl, store) {
  const nodes = gridEl?.children
  if (!nodes || !store.positions) return
  for (const node of nodes) {
    const id = node.dataset?.id
    if (!id) continue
    const oldRect = store.positions[id]
    if (!oldRect) continue
    const newRect = node.getBoundingClientRect()
    const dx = oldRect.left - newRect.left
    const dy = oldRect.top - newRect.top
    if (dx !== 0 || dy !== 0) {
      // 取消上一次未播完的补间，避免 120ms 防抖间隔内动画叠加产生"跳变"观感
      node.getAnimations().forEach((a) => a.cancel())
      node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }],
        { duration: 350, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
      )
    }
  }
  store.positions = null
}
