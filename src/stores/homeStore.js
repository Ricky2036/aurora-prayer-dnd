import { defineStore } from 'pinia'
import { APPS, dockApps, gridApps } from '../config/apps.js'
import {
  HOME_LAYOUT_VERSION,
  cloneHomeState,
  locateHomeItem,
  moveHomeItem,
  reflowHomePages,
  removeHomeItemFromPages
} from '../utils/homeLayout.js'

export const HOME_STORAGE_KEY = 'tos.home.layout.v1'

const appItemId = (appId) => `app:${appId}`
const folderItemId = (folderId) => `folder:${folderId}`

function defaultItems() {
  const items = {
    'widget:clock': { id: 'widget:clock', type: 'widget', widgetId: 'clock', w: 2, h: 2 },
    'widget:smart': { id: 'widget:smart', type: 'widget', widgetId: 'smart', w: 2, h: 2 }
  }
  for (const app of APPS) {
    const id = appItemId(app.id)
    items[id] = { id, type: 'app', appId: app.id, w: 1, h: 1 }
  }
  return items
}

export function createDefaultHomeState() {
  const items = defaultItems()
  const rawPages = [[
    'widget:clock',
    'widget:smart',
    ...gridApps.map((app) => appItemId(app.id))
  ]]
  const packed = reflowHomePages(rawPages, items)
  return {
    version: HOME_LAYOUT_VERSION,
    currentPage: 0,
    pages: packed.pages,
    positions: packed.positions,
    items,
    folders: {},
    dock: dockApps.map((app) => appItemId(app.id)).slice(0, 4),
    uninstalledAppIds: [],
    removedWidgetIds: [],
    hiddenIconId: null,
    editing: false,
    selectedItemIds: []
  }
}

function safeStorage() {
  try {
    const storage = globalThis.localStorage
    if (storage && typeof storage.getItem === 'function') return storage
  } catch {}
  return null
}

function reconcileStoredState(raw) {
  const defaults = createDefaultHomeState()
  if (!raw || raw.version !== HOME_LAYOUT_VERSION || !raw.items || !Array.isArray(raw.pages)) return defaults

  const knownApps = new Set(APPS.map((app) => app.id))
  const uninstalled = new Set((raw.uninstalledAppIds || []).filter((id) => knownApps.has(id)))
  const removedWidgets = new Set(raw.removedWidgetIds || [])
  const items = {}

  for (const [id, item] of Object.entries(raw.items)) {
    if (!item || typeof item !== 'object') continue
    if (item.type === 'app') {
      if (!knownApps.has(item.appId) || uninstalled.has(item.appId)) continue
      items[id] = { id, type: 'app', appId: item.appId, w: 1, h: 1 }
    } else if (item.type === 'folder' && raw.folders?.[item.folderId]) {
      items[id] = { id, type: 'folder', folderId: item.folderId, w: 1, h: 1 }
    } else if (item.type === 'widget' && !removedWidgets.has(item.widgetId)) {
      items[id] = { ...item, id, w: 2, h: 2 }
    }
  }

  const folders = {}
  for (const [id, folder] of Object.entries(raw.folders || {})) {
    const appIds = [...new Set((folder.appIds || []).filter((appId) => knownApps.has(appId) && !uninstalled.has(appId)))]
    if (!items[folderItemId(id)] || appIds.length === 0) continue
    folders[id] = {
      id,
      name: String(folder.name || '文件夹').slice(0, 24),
      appIds,
      width: Math.max(1, Math.min(2, Number(folder.width) || 1)),
      height: Math.max(1, Math.min(2, Number(folder.height) || 1))
    }
  }

  for (const [id, item] of Object.entries(items)) {
    if (item.type === 'folder' && !folders[item.folderId]) delete items[id]
  }

  let pages = raw.pages.map((page) => [...new Set((page || []).filter((id) => items[id]))])
  let dock = [...new Set((raw.dock || []).filter((id) => items[id]?.type === 'app'))].slice(0, 4)
  const inFolder = new Set(Object.values(folders).flatMap((folder) => folder.appIds.map(appItemId)))
  pages = pages.map((page) => page.filter((id) => !dock.includes(id) && !inFolder.has(id)))

  const located = new Set([...pages.flat(), ...dock, ...inFolder])
  for (const [id, item] of Object.entries(defaults.items)) {
    if (item.type === 'widget') {
      if (!removedWidgets.has(item.widgetId) && !items[id]) {
        items[id] = item
        pages[0] ||= []
        pages[0].push(id)
      }
      continue
    }
    if (uninstalled.has(item.appId) || located.has(id)) continue
    items[id] = item
    if (dock.length < 4 && dockApps.some((app) => app.id === item.appId)) dock.push(id)
    else {
      if (!pages.length) pages = [[]]
      pages.at(-1).push(id)
    }
  }

  const packed = reflowHomePages(pages, items, folders)
  return {
    ...defaults,
    currentPage: Math.max(0, Math.min(Number(raw.currentPage) || 0, packed.pages.length - 1)),
    pages: packed.pages,
    positions: packed.positions,
    items,
    folders,
    dock,
    uninstalledAppIds: [...uninstalled],
    removedWidgetIds: [...removedWidgets]
  }
}

export function loadHomeState(storage = safeStorage()) {
  if (!storage) return createDefaultHomeState()
  try {
    return reconcileStoredState(JSON.parse(storage.getItem(HOME_STORAGE_KEY)))
  } catch {
    return createDefaultHomeState()
  }
}

let folderSequence = 0

export const useHomeStore = defineStore('home', {
  state: () => loadHomeState(),

  getters: {
    pageCount: (state) => state.pages.length,
    currentItems: (state) => state.pages[state.currentPage] || [],
    appInstalled: (state) => (appId) => !state.uninstalledAppIds.includes(appId),
    canUninstall: () => (appId) => APPS.find((app) => app.id === appId)?.depth !== 'core',
    itemLocation: (state) => (itemId) => locateHomeItem(state.pages, itemId)
  },

  actions: {
    persist() {
      const storage = safeStorage()
      if (!storage) return
      try {
        const data = cloneHomeState({
          version: this.version,
          currentPage: this.currentPage,
          pages: this.pages,
          items: this.items,
          folders: this.folders,
          dock: this.dock,
          uninstalledAppIds: this.uninstalledAppIds,
          removedWidgetIds: this.removedWidgetIds
        })
        storage.setItem(HOME_STORAGE_KEY, JSON.stringify(data))
      } catch {}
    },

    reflow() {
      const packed = reflowHomePages(this.pages, this.items, this.folders)
      this.pages = packed.pages
      this.positions = packed.positions
      this.currentPage = Math.max(0, Math.min(this.currentPage, this.pages.length - 1))
    },

    setPage(index) {
      this.currentPage = Math.max(0, Math.min(Number(index) || 0, this.pages.length - 1))
      this.persist()
    },

    setEditing(value) {
      this.editing = Boolean(value)
      if (!this.editing) this.selectedItemIds = []
    },

    toggleSelected(itemId) {
      if (!this.items[itemId]) return
      this.selectedItemIds = this.selectedItemIds.includes(itemId)
        ? this.selectedItemIds.filter((id) => id !== itemId)
        : [...this.selectedItemIds, itemId]
    },

    moveItem(itemId, targetPage, targetIndex) {
      if (!this.items[itemId]) return false
      this.pages = moveHomeItem(this.pages, itemId, targetPage, targetIndex)
      this.reflow()
      this.currentPage = Math.max(0, Math.min(targetPage, this.pages.length - 1))
      this.persist()
      return true
    },

    createFolder(itemIds, targetPage = this.currentPage, targetIndex = 0) {
      const apps = [...new Set(itemIds)].map((id) => this.items[id]).filter((item) => item?.type === 'app')
      if (apps.length < 2) return null
      const folderId = `home-folder-${Date.now()}-${folderSequence += 1}`
      const id = folderItemId(folderId)
      const appIds = apps.map((item) => item.appId)
      for (const item of apps) {
        this.pages = removeHomeItemFromPages(this.pages, item.id)
        this.dock = this.dock.filter((dockId) => dockId !== item.id)
        for (const folder of Object.values(this.folders)) folder.appIds = folder.appIds.filter((appId) => appId !== item.appId)
      }
      this.folders[folderId] = { id: folderId, name: '文件夹', appIds, width: 1, height: 1 }
      this.items[id] = { id, type: 'folder', folderId, w: 1, h: 1 }
      this.pages = moveHomeItem(this.pages, id, targetPage, targetIndex)
      this.selectedItemIds = []
      this.reflow()
      this.persist()
      return id
    },

    addAppToFolder(appItem, folderItemIdValue) {
      const item = typeof appItem === 'string' ? this.items[appItem] : appItem
      const folderItem = this.items[folderItemIdValue]
      const folder = folderItem?.type === 'folder' ? this.folders[folderItem.folderId] : null
      if (!item || item.type !== 'app' || !folder) return false
      this.pages = removeHomeItemFromPages(this.pages, item.id)
      this.dock = this.dock.filter((id) => id !== item.id)
      for (const other of Object.values(this.folders)) other.appIds = other.appIds.filter((id) => id !== item.appId)
      folder.appIds.push(item.appId)
      this.reflow()
      this.persist()
      return true
    },

    removeAppFromFolder(appId, folderId, targetPage = this.currentPage, targetIndex = 0) {
      const folder = this.folders[folderId]
      const id = appItemId(appId)
      if (!folder?.appIds.includes(appId) || !this.items[id]) return false
      folder.appIds = folder.appIds.filter((value) => value !== appId)
      this.pages = moveHomeItem(this.pages, id, targetPage, targetIndex)
      if (folder.appIds.length === 0) this.removeFolder(folderId, false)
      else this.reflow()
      this.persist()
      return true
    },

    resizeFolder(folderId, width, height) {
      const folder = this.folders[folderId]
      if (!folder) return false
      folder.width = Math.max(1, Math.min(2, Number(width) || 1))
      folder.height = Math.max(1, Math.min(2, Number(height) || 1))
      this.reflow()
      this.persist()
      return true
    },

    renameFolder(folderId, name) {
      const folder = this.folders[folderId]
      if (!folder) return false
      folder.name = String(name || '文件夹').trim().slice(0, 24) || '文件夹'
      this.persist()
      return true
    },

    removeFolder(folderId, releaseApps = true) {
      const folder = this.folders[folderId]
      const id = folderItemId(folderId)
      if (!folder) return false
      const location = locateHomeItem(this.pages, id) || { page: this.currentPage, index: 0 }
      this.pages = removeHomeItemFromPages(this.pages, id)
      delete this.items[id]
      delete this.folders[folderId]
      if (releaseApps) {
        let index = location.index
        for (const appId of folder.appIds) {
          const itemId = appItemId(appId)
          if (!this.items[itemId]) continue
          this.pages = moveHomeItem(this.pages, itemId, location.page, index)
          index += 1
        }
      }
      this.reflow()
      this.persist()
      return true
    },

    moveToDock(itemId, targetIndex = this.dock.length) {
      const item = this.items[itemId]
      if (!item || item.type !== 'app') return false
      this.pages = removeHomeItemFromPages(this.pages, itemId)
      for (const folder of Object.values(this.folders)) folder.appIds = folder.appIds.filter((id) => id !== item.appId)
      this.dock = this.dock.filter((id) => id !== itemId)
      const index = Math.max(0, Math.min(Number(targetIndex) || 0, this.dock.length))
      let displaced = null
      if (this.dock.length >= 4) displaced = this.dock.splice(Math.min(index, 3), 1)[0]
      this.dock.splice(Math.min(index, 3), 0, itemId)
      if (displaced) this.pages = moveHomeItem(this.pages, displaced, this.currentPage, 0)
      this.reflow()
      this.persist()
      return displaced
    },

    moveFromDock(itemId, targetPage = this.currentPage, targetIndex = 0) {
      if (!this.dock.includes(itemId)) return false
      this.dock = this.dock.filter((id) => id !== itemId)
      this.pages = moveHomeItem(this.pages, itemId, targetPage, targetIndex)
      this.reflow()
      this.persist()
      return true
    },

    uninstallApp(appId) {
      if (!this.canUninstall(appId)) return false
      const itemId = appItemId(appId)
      this.pages = removeHomeItemFromPages(this.pages, itemId)
      this.dock = this.dock.filter((id) => id !== itemId)
      for (const folder of Object.values(this.folders)) folder.appIds = folder.appIds.filter((id) => id !== appId)
      for (const [folderId, folder] of Object.entries(this.folders)) {
        if (folder.appIds.length === 0) this.removeFolder(folderId, false)
      }
      delete this.items[itemId]
      if (!this.uninstalledAppIds.includes(appId)) this.uninstalledAppIds.push(appId)
      this.selectedItemIds = this.selectedItemIds.filter((id) => id !== itemId)
      this.reflow()
      this.persist()
      return true
    },

    removeWidget(widgetId) {
      const itemId = `widget:${widgetId}`
      if (!this.items[itemId]) return false
      this.pages = removeHomeItemFromPages(this.pages, itemId)
      delete this.items[itemId]
      if (!this.removedWidgetIds.includes(widgetId)) this.removedWidgetIds.push(widgetId)
      this.reflow()
      this.persist()
      return true
    },

    hideIcon(appId) { this.hiddenIconId = appId },
    showIcon() { this.hiddenIconId = null },

    resetLayout() {
      Object.assign(this, createDefaultHomeState())
      this.persist()
    }
  }
})
