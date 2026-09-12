import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import {
  HOME_COLUMNS,
  HOME_ROWS,
  createHomeGridProfile,
  globalRankForPageIndex,
  homeItemMetrics,
  insertionIndexAtPoint,
  layoutHomeOrder,
  moveHomeItem,
  packHomePage,
  reflowHomePages,
  resolveDesktopPage
} from '../src/utils/homeLayout.js'
import {
  HOME_STORAGE_KEY,
  createDefaultHomeState,
  loadHomeState,
  useHomeStore
} from '../src/stores/homeStore.js'

function assertNoOverlap(result) {
  const cells = new Set()
  for (const position of Object.values(result.positions)) {
    assert.ok(position.col + position.w <= HOME_COLUMNS)
    assert.ok(position.row + position.h <= HOME_ROWS)
    for (let row = position.row; row < position.row + position.h; row += 1) {
      for (let col = position.col; col < position.col + position.w; col += 1) {
        const key = `${row}:${col}`
        assert.equal(cells.has(key), false, `cell ${key} is occupied twice`)
        cells.add(key)
      }
    }
  }
}

function assertFramesValid(layout, profile) {
  for (const pageFrames of Object.values(layout.frames)) {
    const frames = Object.values(pageFrames)
    for (const frame of frames) {
      assert.ok(frame.x >= profile.workspaceRect.left - .01)
      assert.ok(frame.y >= profile.workspaceRect.top - .01)
      assert.ok(frame.x + frame.width <= profile.workspaceRect.right + .01)
      assert.ok(frame.y + frame.height <= profile.workspaceRect.bottom + .01)
    }
    for (let i = 0; i < frames.length; i += 1) {
      for (let j = i + 1; j < frames.length; j += 1) {
        const a = frames[i], b = frames[j]
        const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        assert.equal(overlaps, false, `frames ${i} and ${j} overlap`)
      }
    }
  }
}

test('builds four-column profiles across supported portrait phone sizes', () => {
  for (const [width, height] of [[280,568],[320,640],[360,788],[393,852],[412,915],[480,960]]) {
    const profile = createHomeGridProfile({ width, height })
    assert.equal(profile.columns, 4)
    assert.ok(profile.iconSize >= 48 && profile.iconSize <= 60)
    assert.ok(profile.gapX >= 12 && profile.gapX <= 32)
    assert.ok(profile.gapY >= 14 && profile.gapY <= 20)
    assert.ok(profile.workspaceRect.bottom < profile.dockRect.top)
  }
})

test('adaptive skyline keeps mixed visual frames in bounds without overlap', () => {
  const items = {
    widget: { id:'widget', type:'widget', w:2, h:2 },
    folder: { id:'folder', type:'folder', folderId:'f', w:2, h:2 },
    ...Object.fromEntries(Array.from({length:24},(_,i)=>[`app:${i}`,{id:`app:${i}`,type:'app',w:1,h:1}]))
  }
  const folders = { f:{ id:'f', width:2, height:2, appIds:[] } }
  for (const [width,height] of [[280,568],[320,640],[360,788],[393,852],[412,915],[480,960]]) {
    const profile = createHomeGridProfile({width,height})
    const layout = layoutHomeOrder(Object.keys(items),items,folders,profile)
    assertFramesValid(layout,profile)
    const widget = layout.frames[0].widget
    assert.equal(Math.round(widget.width),Math.round(widget.height))
  }
})

test('short screens create more pages while preserving canonical order', () => {
  const items = Object.fromEntries(Array.from({length:30},(_,i)=>[`app:${i}`,{id:`app:${i}`,type:'app',w:1,h:1}]))
  const order = Object.keys(items)
  const short = layoutHomeOrder(order,items,{},createHomeGridProfile({width:360,height:568}))
  const tall = layoutHomeOrder(order,items,{},createHomeGridProfile({width:360,height:915}))
  assert.ok(short.pages.length > tall.pages.length)
  assert.deepEqual(short.pages.flat(),order)
  assert.deepEqual(tall.pages.flat(),order)
})

test('adaptive hit testing maps a page location back to global rank', () => {
  const items = Object.fromEntries(Array.from({length:20},(_,i)=>[`app:${i}`,{id:`app:${i}`,type:'app',w:1,h:1}]))
  const layout = layoutHomeOrder(Object.keys(items),items,{},createHomeGridProfile())
  const first = layout.frames[0]['app:0']
  const localIndex = insertionIndexAtPoint(layout.pages[0],layout.frames[0],first.x + first.width,first.y + first.height / 2)
  assert.equal(globalRankForPageIndex(layout.pages,0,localIndex),1)
})

test('packs mixed app and widget sizes without overlap', () => {
  const items = {
    widget: { id: 'widget', type: 'widget', w: 2, h: 2 },
    a: { id: 'a', type: 'app', w: 1, h: 1 },
    b: { id: 'b', type: 'app', w: 1, h: 1 }
  }
  const result = packHomePage(['widget', 'a', 'b'], items)
  assert.deepEqual(result.overflow, [])
  assertNoOverlap(result)
})

test('flows overflow to following pages and removes empty tail pages', () => {
  const items = Object.fromEntries(
    Array.from({ length: 26 }, (_, index) => [`app:${index}`, { id: `app:${index}`, type: 'app', w: 1, h: 1 }])
  )
  const result = reflowHomePages([Object.keys(items), []], items)
  assert.equal(result.pages.length, 2)
  assert.equal(result.pages[0].length, 24)
  assert.equal(result.pages[1].length, 2)
  assertNoOverlap({ positions: result.positions[0] })
  assertNoOverlap({ positions: result.positions[1] })
})

test('moves an item between pages at a stable insertion index', () => {
  assert.deepEqual(moveHomeItem([['a', 'b'], ['c']], 'b', 1, 1), [['a'], ['c', 'b']])
})

test('settles page swipes and opens the library beyond the final page', () => {
  assert.deepEqual(resolveDesktopPage({ currentPage: 0, pageCount: 3, delta: -90 }), { page: 1, openLibrary: false })
  assert.deepEqual(resolveDesktopPage({ currentPage: 2, pageCount: 3, delta: -90 }), { page: 2, openLibrary: true })
  assert.deepEqual(resolveDesktopPage({ currentPage: 0, pageCount: 3, delta: 90 }), { page: 0, openLibrary: false })
  assert.deepEqual(resolveDesktopPage({ currentPage: 1, pageCount: 3, delta: 10 }), { page: 1, openLibrary: false })
})

test('creates, resizes and dissolves a folder without losing its apps', () => {
  setActivePinia(createPinia())
  const store = useHomeStore()
  store.resetLayout()
  const folderItemId = store.createFolder(['app:weather', 'app:notes'], 0, 0)
  assert.ok(folderItemId)
  const folderId = store.items[folderItemId].folderId
  assert.deepEqual(store.folders[folderId].appIds, ['weather', 'notes'])
  assert.equal(store.resizeFolder(folderId, 2, 1), true)
  assert.equal(store.positions[0][folderItemId].w, 2)
  assert.equal(store.removeFolder(folderId), true)
  assert.ok(store.itemLocation('app:weather'))
  assert.ok(store.itemLocation('app:notes'))
})

test('replaces a full dock slot and returns the displaced app to the page', () => {
  setActivePinia(createPinia())
  const store = useHomeStore()
  store.resetLayout()
  const displaced = store.moveToDock('app:weather', 1)
  assert.equal(store.dock.length, 4)
  assert.equal(store.dock[1], 'app:weather')
  assert.ok(displaced)
  assert.ok(store.itemLocation(displaced))
})

test('protects core apps while allowing regular apps to be uninstalled', () => {
  setActivePinia(createPinia())
  const store = useHomeStore()
  store.resetLayout()
  assert.equal(store.uninstallApp('settings'), false)
  assert.equal(store.uninstallApp('weather'), true)
  assert.equal(store.items['app:weather'], undefined)
  assert.ok(store.uninstalledAppIds.includes('weather'))
})

test('removes an app from the desktop without uninstalling it', () => {
  setActivePinia(createPinia())
  const store = useHomeStore()
  store.resetLayout()
  assert.equal(store.removeFromDesktop('app:weather'), true)
  assert.equal(store.itemLocation('app:weather'), null)
  assert.ok(store.items['app:weather'])
  assert.equal(store.appInstalled('weather'), true)
  assert.ok(store.hiddenDesktopAppIds.includes('weather'))

  const restored = loadHomeState({ getItem: () => JSON.stringify(store.$state) })
  assert.equal(restored.pages.flat().includes('app:weather'), false)
  assert.ok(restored.items['app:weather'])
})

test('restores valid persisted state and falls back from malformed data', () => {
  const valid = createDefaultHomeState()
  valid.uninstalledAppIds = ['weather']
  valid.pages = valid.pages.map((page) => page.filter((id) => id !== 'app:weather'))
  delete valid.items['app:weather']
  const storage = { getItem: () => JSON.stringify(valid) }
  const restored = loadHomeState(storage)
  assert.equal(restored.items['app:weather'], undefined)
  assert.ok(restored.uninstalledAppIds.includes('weather'))

  const fallback = loadHomeState({ getItem: () => '{broken' })
  assert.equal(fallback.version, 1)
  assert.ok(fallback.pages.length >= 1)
  assert.equal(HOME_STORAGE_KEY, 'tos.home.layout.v1')
})
