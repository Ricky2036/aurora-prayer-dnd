import { defineStore } from 'pinia'
import { seedNotifications } from '../config/seedNotifications.js'

let nextId = 100

/**
 * 根据应用 ID 获取其关联的灵动岛活动键列表
 */
export function getIslandKeysForApp(appId) {
  if (!appId) return []
  if (appId === 'recorder' || appId === 'voicememos') return ['recorder']
  if (appId === 'clock') return ['alarm', 'timer', 'stopwatch']
  if (appId === 'alarm') return ['alarm']
  if (appId === 'timer') return ['timer']
  if (appId === 'stopwatch') return ['stopwatch']
  if (appId === 'media' || appId === 'music' || appId === 'spotify') return ['media']
  if (appId === 'prayer') return ['prayer']
  return []
}

/**
 * 根据灵动岛活动键获取其对应的父级应用 ID 列表
 */
export function getParentAppsForIslandKey(islandKey) {
  switch (islandKey) {
    case 'recorder':
      return ['recorder', 'voicememos']
    case 'alarm':
    case 'timer':
    case 'stopwatch':
      return ['clock', islandKey]
    case 'prayer':
      return ['prayer', 'clock']
    case 'media':
      return ['media', 'music', 'spotify']
    default:
      return []
  }
}

/** 通知中心数据：锁屏摘要 / 通知中心 / 角标三处共享 */
export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    list: seedNotifications(),
    targetView: null, // 'notifications' | null
    targetSubView: null, // 'dynamicBar' | 'appDetail' | 'main' | null
    targetIslandKey: null, // 'recorder' | 'alarm' | 'timer' | 'stopwatch' | 'prayer' | 'media' | null
    targetAppId: null, // 'whatsapp' | 'gmail' | 'spotify' ... | null
    appSettings: {}, // appId -> boolean (true: 允许通知, false: 关闭通知)
    permissionPrompted: {}, // appId -> boolean (是否已弹出过通知权限授权弹窗)
    islandSettings: {
      master: true,
      alarm: true,
      recorder: true,
      timer: true,
      stopwatch: true,
      prayer: true,
      media: true
    }
  }),

  getters: {
    unreadCount: (s) => s.list.length,
    /** 按应用分组的未读数（角标用） */
    countByApp: (s) => {
      const map = {}
      for (const n of s.list) map[n.appId] = (map[n.appId] || 0) + 1
      return map
    },
    /** 查询应用是否允许通知（总开关），默认允许 */
    isAppNotificationEnabled: (s) => (appId) => {
      if (!appId) return true
      if (s.appSettings[appId] !== undefined) {
        return s.appSettings[appId]
      }
      if (appId === 'voicememos' && s.appSettings['recorder'] !== undefined) {
        return s.appSettings['recorder']
      }
      if (appId === 'recorder' && s.appSettings['voicememos'] !== undefined) {
        return s.appSettings['voicememos']
      }
      return true
    },
    /** 检查指定活动是否允许上灵动岛展示 */
    isIslandEnabled: (s) => (key) => {
      if (s.islandSettings[key] === false) return false
      // 若该活动所属父应用的通知总开关被关闭，灵动岛也不允许展示
      const parentApps = getParentAppsForIslandKey(key)
      for (const p of parentApps) {
        if (s.appSettings[p] === false) {
          return false
        }
      }
      return true
    }
  },

  actions: {
    /** 新增一条通知 = push 一下，锁屏/通知中心/角标自动同步 */
    push({ appId, title, body, minutesAgo = 0, iconType }) {
      this.list.unshift({
        id: nextId++,
        appId,
        iconType: iconType || appId,
        title,
        body,
        time: Date.now() - minutesAgo * 60000
      })
    },

    remove(id) {
      const i = this.list.findIndex((n) => n.id === id)
      if (i !== -1) this.list.splice(i, 1)
    },

    clearAll() { this.list = [] },

    setTargetView(view, subView = null, islandKey = null) {
      this.targetView = view
      this.targetSubView = subView
      this.targetIslandKey = islandKey
      this.targetAppId = null
    },

    setAppTarget(appId) {
      this.targetView = 'notifications'
      this.targetSubView = 'appDetail'
      this.targetAppId = appId
      this.targetIslandKey = null
    },

    /**
     * 设置应用的通知权限（总开关）。
     * 当关闭应用的通知总开关时，若该应用具有灵动岛实时活动，灵动岛开关同步关闭。
     * 当重新开启通知总开关时，灵动岛开关同步开启。
     */
    setAppNotificationEnabled(appId, enabled) {
      if (!appId) return
      this.appSettings[appId] = enabled
      if (appId === 'voicememos') this.appSettings['recorder'] = enabled
      if (appId === 'recorder') this.appSettings['voicememos'] = enabled

      const islandKeys = getIslandKeysForApp(appId)
      for (const key of islandKeys) {
        if (key in this.islandSettings) {
          this.islandSettings[key] = enabled
        }
      }
    },

    toggleAppNotification(appId) {
      const next = !this.isAppNotificationEnabled(appId)
      this.setAppNotificationEnabled(appId, next)
      return next
    },

    setIslandEnabled(key, enabled) {
      if (key in this.islandSettings) {
        this.islandSettings[key] = enabled
        // 若单独打开灵动岛开关，确保对应的应用通知总开关也是开启的
        if (enabled) {
          const parentApps = getParentAppsForIslandKey(key)
          for (const p of parentApps) {
            if (this.appSettings[p] === false) {
              this.appSettings[p] = true
            }
          }
        }
      }
    },

    /**
     * 检查指定应用是否已提示过通知授权弹窗。
     * 若应用在设置中已有明确配置，则视为已授权/拒绝（不重复提示）。
     */
    hasPromptedPermission(appId) {
      if (!appId) return false
      if (this.permissionPrompted[appId] !== undefined) return this.permissionPrompted[appId]
      if (appId === 'voicememos' && this.permissionPrompted['recorder'] !== undefined) {
        return this.permissionPrompted['recorder']
      }
      if (appId === 'recorder' && this.permissionPrompted['voicememos'] !== undefined) {
        return this.permissionPrompted['voicememos']
      }
      if (this.appSettings[appId] !== undefined) return true
      if (appId === 'voicememos' && this.appSettings['recorder'] !== undefined) return true
      if (appId === 'recorder' && this.appSettings['voicememos'] !== undefined) return true
      return false
    },

    /**
     * 标记应用已完成通知授权弹窗提示
     */
    markPermissionPrompted(appId, prompted = true) {
      if (!appId) return
      this.permissionPrompted[appId] = prompted
      if (appId === 'voicememos') this.permissionPrompted['recorder'] = prompted
      if (appId === 'recorder') this.permissionPrompted['voicememos'] = prompted
    },

    /**
     * 重置应用的通知授权状态（方便开发者在 DevConsole 重复体验授权弹窗）
     */
    resetPermissionPrompt(appId) {
      if (!appId) return
      delete this.permissionPrompted[appId]
      delete this.appSettings[appId]
      if (appId === 'voicememos' || appId === 'recorder') {
        delete this.permissionPrompted['voicememos']
        delete this.permissionPrompted['recorder']
        delete this.appSettings['voicememos']
        delete this.appSettings['recorder']
      }
    }
  }
})
