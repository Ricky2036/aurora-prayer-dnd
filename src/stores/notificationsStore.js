import { defineStore } from 'pinia'
import { seedNotifications } from '../config/seedNotifications'

let nextId = 100

/** 通知中心数据：锁屏摘要 / 通知中心 / 角标三处共享 */
export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    list: seedNotifications()
  }),

  getters: {
    unreadCount: (s) => s.list.length,
    /** 按应用分组的未读数（角标用） */
    countByApp: (s) => {
      const map = {}
      for (const n of s.list) map[n.appId] = (map[n.appId] || 0) + 1
      return map
    }
  },

  actions: {
    /** 新增一条通知 = push 一下，锁屏/通知中心/角标自动同步 */
    push({ appId, title, body, minutesAgo = 0 }) {
      this.list.unshift({
        id: nextId++,
        appId,
        title,
        body,
        time: Date.now() - minutesAgo * 60000
      })
    },

    remove(id) {
      const i = this.list.findIndex((n) => n.id === id)
      if (i !== -1) this.list.splice(i, 1)
    },

    clearAll() { this.list = [] }
  }
})
