import test from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import {
  HOME_COLUMNS,
  HOME_ROWS,
  moveHomeItem,
  packHomePage,
  reflowHomePages
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
