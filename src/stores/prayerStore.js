import { defineStore } from 'pinia'
import { useI18nStore } from './i18nStore'

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
    repeatDays: [0, 1, 2, 3, 4]
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

export const SEED_CONTACTS = [
  { id: 'c1', name: '老婆', enName: 'Wife', bnName: 'স্ত্রী', pinyin: 'laopo', phone: '138 0013 8000', tag: '家人', avatarBg: '#FF2D55' },
  { id: 'c2', name: '老板', enName: 'Boss', bnName: 'বস', pinyin: 'laoban', phone: '139 8888 6666', tag: '工作', avatarBg: '#007AFF' },
  { id: 'c3', name: '妈妈', enName: 'Mom', bnName: 'মা', pinyin: 'mama', phone: '136 1234 5678', tag: '家人', avatarBg: '#FF9500' },
  { id: 'c4', name: '爸爸', enName: 'Dad', bnName: 'বাবা', pinyin: 'baba', phone: '137 8765 4321', tag: '家人', avatarBg: '#5856D6' },
  { id: 'c5', name: '姐姐', enName: 'Sister', bnName: 'বোন', pinyin: 'jiejie', phone: '135 2233 4455', tag: '家人', avatarBg: '#AF52DE' },
  { id: 'c6', name: '陈总 (客户)', enName: 'Mr. Chen', bnName: 'জনাব চেন', pinyin: 'chenzong', phone: '186 9988 7766', tag: '客户', avatarBg: '#34C759' },
  { id: 'c7', name: '李助理', enName: 'Assistant Li', bnName: 'সহকারী লি', pinyin: 'lizhuli', phone: '158 3344 5566', tag: '工作', avatarBg: '#5AC8FA' },
  { id: 'c8', name: '张工 (研发)', enName: 'Engineer Zhang', bnName: 'প্রকৌশলী ঝাং', pinyin: 'zhanggong', phone: '150 1122 3344', tag: '工作', avatarBg: '#30B0C7' },
  { id: 'c9', name: '王医生', enName: 'Dr. Wang', bnName: 'ডাঃ ওয়াং', pinyin: 'wangyisheng', phone: '189 6677 8899', tag: '常用', avatarBg: '#FF3B30' },
  { id: 'c10', name: '紧急联系人', enName: 'Emergency', bnName: 'জরুরী পরিচিতি', pinyin: 'jinji', phone: '110 0000 0000', tag: '紧急', avatarBg: '#FF453A' }
]

export function getPrayerDurationSeconds(prayer) {
  if (!prayer || !prayer.startTime || !prayer.endTime) return 1800
  const [sh, sm] = prayer.startTime.split(':').map(Number)
  const [eh, em] = prayer.endTime.split(':').map(Number)
  let startMins = sh * 60 + sm
  let endMins = eh * 60 + em
  if (endMins < startMins) {
    endMins += 24 * 60 // 跨午夜
  }
  const diffMinutes = endMins - startMins
  return Math.max(diffMinutes * 60, 60)
}

export const usePrayerStore = defineStore('prayer', {
  state: () => {
    const defaultFajr = DEFAULT_PRAYERS.find((p) => p.id === 'fajr')
    return {
      masterEnabled: true,
      targetView: 'main', // 'main' | 'prayer'
      advanceMins: 15,
      extendMins: 15,
      allowRepeatedCalls: true,
      prayers: JSON.parse(JSON.stringify(DEFAULT_PRAYERS)),

      /* ---- 智慧建议与用户模式 ---- */
      userMode: 'normal', // 'normal' (普通用户: 默认天气) | 'muslim' (穆斯林用户: 穆斯林卡片)

      /* ---- 自动启用与AI自动接听 ---- */
      geoAutoEnable: true, // 进入、离开清真寺范围自动启用/退出勿扰模式
      aiAutoAnswer: true,  // 指定联系人来电时自动启用AI接听回复
      selectedContactIds: ['c1', 'c2', 'c3'], // 默认选择：老婆、老板、妈妈 (3人)

      /* ---- 灵动岛与控制台模拟状态 ---- */
      simulatedPrayerId: null, // 默认不显示灵动岛，点击控制台按钮再显示
      islandExpanded: false,
      islandCountdownSeconds: getPrayerDurationSeconds(defaultFajr)
    }
  },

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
    // 当前灵动岛生效的礼拜（仅当控制台选中时显示）
    currentIslandPrayer: (s) => {
      if (!s.masterEnabled) return null
      if (s.simulatedPrayerId) {
        return s.prayers.find((p) => p.id === s.simulatedPrayerId) || null
      }
      return null
    },
    // 动态生成联系人选择摘要标签（如：老婆、老板等3人）
    selectedContactsSummary(s) {
      const i18n = useI18nStore()
      const list = SEED_CONTACTS.filter((c) => s.selectedContactIds.includes(c.id))
      if (list.length === 0) {
        return i18n.locale === 'zh' ? '未选择' : i18n.locale === 'en' ? 'None' : 'কোনটি নয়'
      }
      const getName = (c) => {
        if (i18n.locale === 'en') return c.enName || c.name
        if (i18n.locale === 'bn') return c.bnName || c.name
        return c.name
      }
      if (list.length === 1) {
        return getName(list[0])
      }
      if (list.length === 2) {
        return `${getName(list[0])}、${getName(list[1])}`
      }
      return i18n.locale === 'zh'
        ? `${getName(list[0])}、${getName(list[1])}等${list.length}人`
        : i18n.locale === 'en'
        ? `${getName(list[0])}, ${getName(list[1])} & ${list.length - 2} other`
        : `${getName(list[0])}, ${getName(list[1])}সহ ${list.length} জন`
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
        // 动态联动：若当前灵动岛正是该礼拜，实时刷新倒计时为新的时间差
        if (this.currentIslandPrayer?.id === id) {
          this.islandCountdownSeconds = getPrayerDurationSeconds(this.prayers[index])
        }
      }
    },

    setUserMode(mode) {
      this.userMode = mode
    },

    /* 联系人多选与管理 */
    toggleContact(id) {
      const idx = this.selectedContactIds.indexOf(id)
      if (idx > -1) {
        this.selectedContactIds.splice(idx, 1)
      } else {
        this.selectedContactIds.push(id)
      }
    },

    selectAllContacts() {
      this.selectedContactIds = SEED_CONTACTS.map((c) => c.id)
    },

    clearAllContacts() {
      this.selectedContactIds = []
    },

    /* 灵动岛控制：切换礼拜时精确关联对应时间间隔 */
    setSimulatedPrayer(id) {
      this.simulatedPrayerId = id
      const prayer = this.prayers.find((p) => p.id === id)
      this.islandCountdownSeconds = getPrayerDurationSeconds(prayer)
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
      const prayer = this.prayers.find((p) => p.id === 'fajr')
      this.islandCountdownSeconds = getPrayerDurationSeconds(prayer)
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
      this.simulatedPrayerId = null
      this.selectedContactIds = ['c1', 'c2', 'c3']
      const prayer = this.prayers.find((p) => p.id === 'fajr')
      this.islandCountdownSeconds = getPrayerDurationSeconds(prayer)
    }
  }
})
