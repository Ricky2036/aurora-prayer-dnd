import { defineStore } from 'pinia'
import { seedNotifications } from '../config/seedNotifications.js'

let nextId = 100

/** 通知中心数据：锁屏摘要 / 通知中心 / 角标三处共享 */
export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    list: seedNotifications(),
    targetView: null, // 'notifications' | null
    targetSubView: null, // 'dynamicBar' | 'appDetail' | 'main' | null
    targetIslandKey: null, // 'recorder' | 'alarm' | 'timer' | 'stopwatch' | 'prayer' | 'media' | null
    targetAppId: null, // 'whatsapp' | 'gmail' | 'spotify' ... | null
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
    /** 检查指定活动是否允许上灵动岛展示 */
    isIslandEnabled: (s) => (key) => {
      return s.islandSettings[key] !== false
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

    setIslandEnabled(key, enabled) {
      if (key in this.islandSettings) {
        this.islandSettings[key] = enabled
      }
    }
  }
})
