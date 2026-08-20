import { defineStore } from 'pinia'

const DEFAULT_PRAYERS = [
  {
    id: 'fajr',
    name: 'Fajr',
    cnName: '晨礼',
    standardTime: '05:30',
    startTime: '05:15',
    endTime: '05:45',
    enabled: true,
    repeatType: 'everyday',
    repeatLabel: '每天',
    repeatDays: [1, 2, 3, 4, 5, 6, 0] // 0=Sun, 1=Mon...
  },
  {
    id: 'dhuhr',
    name: 'Dhuhr',
    cnName: '晌礼',
    standardTime: '12:30',
    startTime: '12:15',
    endTime: '12:45',
    enabled: true,
    repeatType: 'weekday',
    repeatLabel: '工作日启用 · 周末关闭',
    repeatDays: [1, 2, 3, 4, 5]
  },
  {
    id: 'asr',
    name: 'Asr',
    cnName: '晡礼',
    standardTime: '15:45',
    startTime: '15:30',
    endTime: '16:00',
    enabled: true,
    repeatType: 'everyday',
    repeatLabel: '每天',
    repeatDays: [1, 2, 3, 4, 5, 6, 0]
  },
  {
    id: 'maghrib',
    name: 'Maghrib',
    cnName: '昏礼',
    standardTime: '18:15',
    startTime: '18:10',
    endTime: '18:30',
    enabled: true,
    repeatType: 'everyday',
    repeatLabel: '每天',
    repeatDays: [1, 2, 3, 4, 5, 6, 0]
  },
  {
    id: 'isha',
    name: 'Isha',
    cnName: '宵礼',
    standardTime: '19:45',
    startTime: '19:30',
    endTime: '20:00',
    enabled: true,
    repeatType: 'everyday',
    repeatLabel: '每天',
    repeatDays: [1, 2, 3, 4, 5, 6, 0]
  }
]

export const usePrayerStore = defineStore('prayer', {
  state: () => ({
    masterEnabled: true,
    targetView: 'main', // 'main' | 'prayer'
    advanceMins: 15,
    extendMins: 15,
    allowRepeatedCalls: true,
    prayers: JSON.parse(JSON.stringify(DEFAULT_PRAYERS)),

    /* ---- 智慧建议与用户模式 ---- */
    userMode: 'normal', // 'normal' (普通用户: 默认天气) | 'muslim' (穆斯林用户: 穆斯林卡片)

    /* ---- 灵动岛与控制台模拟状态 ---- */
    simulatedPrayerId: 'fajr', // 默认初始化为晨礼，方便即时预览
    islandExpanded: false,
    islandCountdownSeconds: 1800 // 30 分钟倒计时 (1800秒)
  }),

  getters: {
    enabledCount: (s) => s.prayers.filter((p) => p.enabled).length,
    activePrayer: (s) => {
      if (!s.masterEnabled) return null
      const now = new Date()
      const currentMins = now.getHours() * 60 + now.getMinutes()
      const currentDay = now.getDay()
      
      return s.prayers.find((p) => {
        if (!p.enabled) return false
        if (!p.repeatDays.includes(currentDay)) return false
        const [sh, sm] = p.startTime.split(':').map(Number)
        const [eh, em] = p.endTime.split(':').map(Number)
        const start = sh * 60 + sm
        const end = eh * 60 + em
        return currentMins >= start && currentMins <= end
      }) || null
    },
    // 当前灵动岛生效的礼拜（优先取控制台模拟项，其次取真实时间项）
    currentIslandPrayer: (s) => {
      if (!s.masterEnabled) return null
      if (s.simulatedPrayerId) {
        return s.prayers.find((p) => p.id === s.simulatedPrayerId) || null
      }
      return s.activePrayer
    }
  },

  actions: {
    setTargetView(view) {
      this.targetView = view
    },

    toggleMaster() {
      this.masterEnabled = !this.masterEnabled
    },

    togglePrayer(id) {
      const p = this.prayers.find((item) => item.id === id)
      if (p) p.enabled = !p.enabled
    },

    updatePrayer(id, updates) {
      const index = this.prayers.findIndex((item) => item.id === id)
      if (index !== -1) {
        this.prayers[index] = { ...this.prayers[index], ...updates }
      }
    },

    setUserMode(mode) {
      this.userMode = mode
    },

    /* 灵动岛控制 */
    setSimulatedPrayer(id) {
      this.simulatedPrayerId = id
      this.islandCountdownSeconds = 1800
      if (id) {
        this.islandExpanded = true
      }
    },

    toggleSimulatedPrayer(id) {
      if (this.simulatedPrayerId === id) {
        this.closeIsland()
      } else {
        this.setSimulatedPrayer(id)
      }
    },

    closeIsland() {
      this.simulatedPrayerId = null
      this.islandExpanded = false
      this.islandCountdownSeconds = 1800
    },

    toggleIslandExpanded() {
      this.islandExpanded = !this.islandExpanded
    },

    decrementCountdown() {
      if (this.islandCountdownSeconds > 1) {
        this.islandCountdownSeconds--
      } else {
        this.islandCountdownSeconds = 0
        this.closeIsland()
      }
    },

    resetDefaults() {
      this.prayers = JSON.parse(JSON.stringify(DEFAULT_PRAYERS))
      this.masterEnabled = true
      this.simulatedPrayerId = 'fajr'
      this.islandCountdownSeconds = 1800
    }
  }
})
