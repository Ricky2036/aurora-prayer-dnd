import { defineStore } from 'pinia'
import { APPS, dockApps, gridApps } from '../config/apps.js'
import { HOME_LAYOUT_VERSION, cloneHomeState, createHomeGridProfile, globalRankForPageIndex, layoutHomeOrder, locateHomeItem, moveHomeOrderItem } from '../utils/homeLayout.js'

export const HOME_STORAGE_KEY = 'tos.home.layout.v2'
export const LEGACY_HOME_STORAGE_KEY = 'tos.home.layout.v1'
const appItemId = (id) => `app:${id}`
const folderItemId = (id) => `folder:${id}`
const unique = (values) => [...new Set(values || [])]

function defaultItems() {
  const items = {
    'widget:clock': { id: 'widget:clock', type: 'widget', widgetId: 'clock', w: 2, h: 2 },
    'widget:smart': { id: 'widget:smart', type: 'widget', widgetId: 'smart', w: 2, h: 2 }
  }
  for (const app of APPS) items[appItemId(app.id)] = { id: appItemId(app.id), type: 'app', appId: app.id, w: 1, h: 1 }
  return items
}

function deriveLayout(state) {
  const result = layoutHomeOrder(state.order, state.items, state.folders, state.profile)
  state.pages = result.pages
  state.positions = result.frames
  state.currentPage = Math.max(0, Math.min(Number(state.currentPage) || 0, state.pages.length - 1))
}

export function createDefaultHomeState() {
  const state = {
    version: HOME_LAYOUT_VERSION, currentPage: 0,
    order: ['widget:clock', 'widget:smart', ...gridApps.map((app) => appItemId(app.id))],
    pages: [[]], positions: {}, profile: createHomeGridProfile(), items: defaultItems(), folders: {},
    dock: dockApps.map((app) => appItemId(app.id)).slice(0, 4),
    uninstalledAppIds: [], hiddenDesktopAppIds: [], removedWidgetIds: [], hiddenIconId: null,
    editing: false, selectedItemIds: []
  }
  deriveLayout(state)
  return state
}

function safeStorage() {
  try { return globalThis.localStorage?.getItem ? globalThis.localStorage : null } catch { return null }
}

function reconcile(raw) {
  const defaults = createDefaultHomeState()
  if (!raw?.items || (raw.version === 2 ? !Array.isArray(raw.order) : !Array.isArray(raw.pages))) return defaults
  const knownApps = new Set(APPS.map((app) => app.id))
  const uninstalled = new Set((raw.uninstalledAppIds || []).filter((id) => knownApps.has(id)))
  const hidden = new Set((raw.hiddenDesktopAppIds || []).filter((id) => knownApps.has(id) && !uninstalled.has(id)))
  const removedWidgets = new Set(raw.removedWidgetIds || [])
  const items = {}
  for (const [id, item] of Object.entries(raw.items)) {
    if (item?.type === 'app' && knownApps.has(item.appId) && !uninstalled.has(item.appId)) items[id] = { id, type: 'app', appId: item.appId, w: 1, h: 1 }
    else if (item?.type === 'folder' && raw.folders?.[item.folderId]) items[id] = { id, type: 'folder', folderId: item.folderId, w: 1, h: 1 }
    else if (item?.type === 'widget' && !removedWidgets.has(item.widgetId)) items[id] = { ...item, id, w: 2, h: 2 }
  }
  const folders = {}
  for (const [id, folder] of Object.entries(raw.folders || {})) {
    const appIds = unique(folder.appIds).filter((appId) => knownApps.has(appId) && !uninstalled.has(appId) && !hidden.has(appId))
    if (items[folderItemId(id)] && appIds.length) folders[id] = { id, name: String(folder.name || '文件夹').slice(0, 24), appIds, width: Math.max(1, Math.min(2, Number(folder.width) || 1)), height: Math.max(1, Math.min(2, Number(folder.height) || 1)) }
  }
  for (const [id, item] of Object.entries(items)) if (item.type === 'folder' && !folders[item.folderId]) delete items[id]
  const dock = unique(raw.dock).filter((id) => items[id]?.type === 'app' && !hidden.has(items[id].appId)).slice(0, 4)
  const nested = new Set(Object.values(folders).flatMap((folder) => folder.appIds.map(appItemId)))
  const sourceOrder = raw.version === 2 ? raw.order : raw.pages.flat()
  const order = unique(sourceOrder).filter((id) => items[id] && !dock.includes(id) && !nested.has(id) && !hidden.has(items[id]?.appId))
  const located = new Set([...order, ...dock, ...nested, ...[...hidden].map(appItemId)])
  for (const [id, item] of Object.entries(defaults.items)) {
    if (item.type === 'widget') {
      if (!removedWidgets.has(item.widgetId) && !items[id]) { items[id] = item; order.push(id) }
    } else if (!uninstalled.has(item.appId) && !located.has(id)) {
      items[id] = item
      if (dock.length < 4 && dockApps.some((app) => app.id === item.appId)) dock.push(id)
      else order.push(id)
    }
  }
  const state = { ...defaults, currentPage: Number(raw.currentPage) || 0, order, items, folders, dock, uninstalledAppIds: [...uninstalled], hiddenDesktopAppIds: [...hidden], removedWidgetIds: [...removedWidgets] }
  deriveLayout(state)
  return state
}

export function loadHomeState(storage = safeStorage()) {
  if (!storage) return createDefaultHomeState()
  try {
    const current = storage.getItem(HOME_STORAGE_KEY)
    if (current) return reconcile(JSON.parse(current))
    const legacy = storage.getItem(LEGACY_HOME_STORAGE_KEY)
    return legacy ? reconcile(JSON.parse(legacy)) : createDefaultHomeState()
  } catch { return createDefaultHomeState() }
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
      const storage = safeStorage(); if (!storage) return
      try { storage.setItem(HOME_STORAGE_KEY, JSON.stringify(cloneHomeState({ version: this.version, currentPage: this.currentPage, order: this.order, items: this.items, folders: this.folders, dock: this.dock, uninstalledAppIds: this.uninstalledAppIds, hiddenDesktopAppIds: this.hiddenDesktopAppIds, removedWidgetIds: this.removedWidgetIds }))) } catch {}
    },
    reflow() { deriveLayout(this) },
    setLayoutProfile(profile) { this.profile = profile; this.reflow() },
    setViewport(metrics) { this.setLayoutProfile(createHomeGridProfile(metrics)) },
    setPage(index) { this.currentPage = Math.max(0, Math.min(Number(index) || 0, this.pages.length - 1)); this.persist() },
    setEditing(value) { this.editing = Boolean(value); if (!this.editing) this.selectedItemIds = [] },
    toggleSelected(id) { if (this.items[id]) this.selectedItemIds = this.selectedItemIds.includes(id) ? this.selectedItemIds.filter((value) => value !== id) : [...this.selectedItemIds, id] },
    rankAt(page, index) { return globalRankForPageIndex(this.pages, page, index) },
    insertAt(itemId, page, index) { this.order = moveHomeOrderItem(this.order, itemId, this.rankAt(page, index)) },
    moveItem(itemId, page, index) {
      const item = this.items[itemId]; if (!item) return false
      if (item.type === 'app') this.hiddenDesktopAppIds = this.hiddenDesktopAppIds.filter((id) => id !== item.appId)
      this.insertAt(itemId, page, index); this.reflow(); this.currentPage = Math.min(page, this.pages.length - 1); this.persist(); return true
    },
    createFolder(ids, page = this.currentPage, index = 0) {
      const apps = unique(ids).map((id) => this.items[id]).filter((item) => item?.type === 'app'); if (apps.length < 2) return null
      const rank = this.rankAt(page, index), folderId = `home-folder-${Date.now()}-${folderSequence += 1}`, id = folderItemId(folderId)
      for (const item of apps) { this.order = this.order.filter((value) => value !== item.id); this.dock = this.dock.filter((value) => value !== item.id); for (const folder of Object.values(this.folders)) folder.appIds = folder.appIds.filter((appId) => appId !== item.appId) }
      this.folders[folderId] = { id: folderId, name: '文件夹', appIds: apps.map((item) => item.appId), width: 1, height: 1 }; this.items[id] = { id, type: 'folder', folderId, w: 1, h: 1 }
      this.order = moveHomeOrderItem(this.order, id, rank); this.selectedItemIds = []; this.reflow(); this.persist(); return id
    },
    addAppToFolder(appItem, folderItemIdValue) {
      const item = typeof appItem === 'string' ? this.items[appItem] : appItem, folderItem = this.items[folderItemIdValue], folder = folderItem?.type === 'folder' ? this.folders[folderItem.folderId] : null
      if (!item || item.type !== 'app' || !folder) return false
      this.order = this.order.filter((id) => id !== item.id); this.dock = this.dock.filter((id) => id !== item.id); for (const other of Object.values(this.folders)) other.appIds = other.appIds.filter((id) => id !== item.appId)
      folder.appIds.push(item.appId); this.hiddenDesktopAppIds = this.hiddenDesktopAppIds.filter((id) => id !== item.appId); this.reflow(); this.persist(); return true
    },
    removeAppFromFolder(appId, folderId, page = this.currentPage, index = 0) {
      const folder = this.folders[folderId], id = appItemId(appId); if (!folder?.appIds.includes(appId) || !this.items[id]) return false
      folder.appIds = folder.appIds.filter((value) => value !== appId); this.hiddenDesktopAppIds = this.hiddenDesktopAppIds.filter((value) => value !== appId); this.insertAt(id, page, index)
      if (!folder.appIds.length) this.removeFolder(folderId, false); else this.reflow(); this.persist(); return true
    },
    resizeFolder(id, width, height) { const folder = this.folders[id]; if (!folder) return false; folder.width = Math.max(1, Math.min(2, Number(width) || 1)); folder.height = Math.max(1, Math.min(2, Number(height) || 1)); this.reflow(); this.persist(); return true },
    renameFolder(id, name) { const folder = this.folders[id]; if (!folder) return false; folder.name = String(name || '文件夹').trim().slice(0, 24) || '文件夹'; this.persist(); return true },
    removeFolder(folderId, releaseApps = true) {
      const folder = this.folders[folderId], id = folderItemId(folderId); if (!folder) return false
      const rank = Math.max(0, this.order.indexOf(id)); this.order = this.order.filter((value) => value !== id); delete this.items[id]; delete this.folders[folderId]
      if (releaseApps) this.order.splice(rank, 0, ...folder.appIds.map(appItemId).filter((itemId) => this.items[itemId])); this.reflow(); this.persist(); return true
    },
    moveToDock(itemId, targetIndex = this.dock.length) {
      const item = this.items[itemId]; if (!item || item.type !== 'app') return false
      this.hiddenDesktopAppIds = this.hiddenDesktopAppIds.filter((id) => id !== item.appId); this.order = this.order.filter((id) => id !== itemId); for (const folder of Object.values(this.folders)) folder.appIds = folder.appIds.filter((id) => id !== item.appId)
      this.dock = this.dock.filter((id) => id !== itemId); const index = Math.max(0, Math.min(Number(targetIndex) || 0, this.dock.length)); let displaced = null
      if (this.dock.length >= 4) displaced = this.dock.splice(Math.min(index, 3), 1)[0]
      this.dock.splice(Math.min(index, 3), 0, itemId); if (displaced) this.insertAt(displaced, this.currentPage, 0); this.reflow(); this.persist(); return displaced
    },
    moveFromDock(itemId, page = this.currentPage, index = 0) { if (!this.dock.includes(itemId)) return false; const item = this.items[itemId]; if (item?.type === 'app') this.hiddenDesktopAppIds = this.hiddenDesktopAppIds.filter((id) => id !== item.appId); this.dock = this.dock.filter((id) => id !== itemId); this.insertAt(itemId, page, index); this.reflow(); this.persist(); return true },
    removeFromDesktop(itemId) { const item = this.items[itemId]; if (!item || item.type !== 'app') return false; this.order = this.order.filter((id) => id !== itemId); this.dock = this.dock.filter((id) => id !== itemId); for (const folder of Object.values(this.folders)) folder.appIds = folder.appIds.filter((id) => id !== item.appId); if (!this.hiddenDesktopAppIds.includes(item.appId)) this.hiddenDesktopAppIds.push(item.appId); this.selectedItemIds = this.selectedItemIds.filter((id) => id !== itemId); this.reflow(); this.persist(); return true },
    uninstallApp(appId) {
      if (!this.canUninstall(appId)) return false
      const itemId = appItemId(appId); this.order = this.order.filter((id) => id !== itemId); this.dock = this.dock.filter((id) => id !== itemId); for (const folder of Object.values(this.folders)) folder.appIds = folder.appIds.filter((id) => id !== appId)
      for (const [folderId, folder] of Object.entries(this.folders)) if (!folder.appIds.length) this.removeFolder(folderId, false)
      delete this.items[itemId]; this.hiddenDesktopAppIds = this.hiddenDesktopAppIds.filter((id) => id !== appId); if (!this.uninstalledAppIds.includes(appId)) this.uninstalledAppIds.push(appId); this.selectedItemIds = this.selectedItemIds.filter((id) => id !== itemId); this.reflow(); this.persist(); return true
    },
    removeWidget(widgetId) { const itemId = `widget:${widgetId}`; if (!this.items[itemId]) return false; this.order = this.order.filter((id) => id !== itemId); delete this.items[itemId]; if (!this.removedWidgetIds.includes(widgetId)) this.removedWidgetIds.push(widgetId); this.reflow(); this.persist(); return true },
    hideIcon(appId) { this.hiddenIconId = appId }, showIcon() { this.hiddenIconId = null },
    resetLayout() { Object.assign(this, createDefaultHomeState()); this.persist() }
  }
})
