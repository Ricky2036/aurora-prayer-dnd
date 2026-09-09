import { defineStore } from 'pinia'

/**
 * 辅助函数：计算距离下一次响铃的分钟数与描述文本
 * 支持：仅一次、每天、工作日、周末或指定星期
 */
export function calculateTimeUntilAlarm(alarm, now = new Date()) {
  if (!alarm || !alarm.time) return ''
  const [targetH, targetM] = alarm.time.split(':').map(Number)
  const currentDay = now.getDay() // 0=Sun, 1=Mon...
  const currentH = now.getHours()
  const currentM = now.getMinutes()
  const currentTotalMins = currentH * 60 + currentM

  let candidateDays = []
  if (!alarm.days || alarm.days.length === 0) {
    // 仅一次：若今天目标时间已过，则是明天；否则是今天
    candidateDays = [currentDay]
    if (targetH * 60 + targetM <= currentTotalMins) {
      candidateDays = [(currentDay + 1) % 7]
    }
  } else {
    candidateDays = [...alarm.days]
  }

  // 寻找最近符合的天数
  let minDiffMinutes = Infinity
  for (let offset = 0; offset < 8; offset++) {
    const day = (currentDay + offset) % 7
    if (candidateDays.includes(day)) {
      let diff = offset * 24 * 60 + (targetH * 60 + targetM) - currentTotalMins
      if (diff > 0 && diff < minDiffMinutes) {
        minDiffMinutes = diff
        break
      }
    }
  }

  if (minDiffMinutes === Infinity || minDiffMinutes <= 0) {
    return '即将响铃'
  }

  const hours = Math.floor(minDiffMinutes / 60)
  const mins = minDiffMinutes % 60
  if (hours === 0) {
    return `${mins}分钟后响铃`
  }
  return `${hours}小时${mins}分钟后响铃`
}

/** 毫秒格式化为 00:00.00 */
export function formatStopwatchTime(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const hundredths = Math.floor((ms % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`
}

/** 秒数格式化为 00:00:00 或 00:00 */
export function formatTimerSeconds(totalSecs, withHours = true) {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (withHours || h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const useClockStore = defineStore('clock', {
  state: () => ({
    // 闹钟列表
    alarms: [
      {
        id: 'a1',
        time: '07:00',
        days: [0, 6],
        repeatLabel: '周日, 周六',
        enabled: false,
        label: ''
      },
      {
        id: 'a2',
        time: '07:10',
        days: [1, 2, 3, 4, 5],
        repeatLabel: '周一至周五',
        enabled: true,
        label: ''
      },
      {
        id: 'a3',
        time: '07:40',
        days: [],
        repeatLabel: '仅一次',
        enabled: false,
        label: ''
      },
      {
        id: 'a4',
        time: '08:00',
        days: [0, 1, 2, 3, 4, 5, 6],
        repeatLabel: '每天',
        enabled: true,
        label: '收菜'
      },
      {
        id: 'a5',
        time: '19:35',
        days: [0, 1, 2, 3, 4, 5, 6],
        repeatLabel: '每天',
        enabled: true,
        label: ''
      },
      {
        id: 'a6',
        time: '20:43',
        days: [],
        repeatLabel: '仅一次',
        enabled: false,
        label: ''
      }
    ],

    // 世界时钟
    worldClocks: [
      { id: 'bj', city: '北京', country: '中国', timezone: 'Asia/Shanghai', offset: 8, isLocal: true },
      { id: 'mecca', city: '麦加', country: '沙特阿拉伯', timezone: 'Asia/Riyadh', offset: 3, isLocal: false },
      { id: 'london', city: '伦敦', country: '英国', timezone: 'Europe/London', offset: 1, isLocal: false },
      { id: 'ny', city: '纽约', country: '美国', timezone: 'America/New_York', offset: -4, isLocal: false },
      { id: 'tokyo', city: '东京', country: '日本', timezone: 'Asia/Tokyo', offset: 9, isLocal: false },
      { id: 'dubai', city: '迪拜', country: '阿联酋', timezone: 'Asia/Dubai', offset: 4, isLocal: false }
    ],

    // 定时器
    timer: {
      selectedHours: 0,
      selectedMinutes: 5,
      selectedSeconds: 0,
      totalDuration: 300,
      remainingSeconds: 300,
      status: 'idle', // 'idle' | 'running' | 'paused'
      intervalId: null,
      presets: [
        { id: 'p1', name: '会议', duration: 20 * 60 },
        { id: 'p2', name: '睡眠', duration: 10 * 60 },
        { id: 'p3', name: '健身', duration: 15 * 60 }
      ]
    },

    // 秒表
    stopwatch: {
      status: 'idle', // 'idle' | 'running' | 'paused'
      elapsedMs: 0,
      startTime: 0,
      pausedOffset: 0,
      intervalId: null,
      laps: [] // { id, lapNumber, lapMs, totalMs }
    },

    // 当前激活的 Tab
    activeTab: 'alarm',

    // 灵动岛展开状态
    islandExpanded: false,

    // 设置项
    settings: {
      muslimAlarmEnabled: true,
      calcMethod: '穆斯林世界联盟',
      prayerTimeMethod: '莎菲懿法学派',
      ramadanAdjustDays: 0,
      ringtone: '默认铃声 (Rise Slowly)',
      dualClock: true,
      holidayRegion: '中国',
      timerSound: true,
      stopwatchSound: true,
      version: '16.3.0.078'
    }
  }),

  getters: {
    // 格式化闹钟剩余描述
    alarmRemainingMap: (state) => {
      const now = new Date()
      const map = {}
      for (const a of state.alarms) {
        if (a.enabled) {
          map[a.id] = calculateTimeUntilAlarm(a, now)
        }
      }
      return map
    },

    timerProgress: (state) => {
      if (state.timer.totalDuration <= 0) return 1
      return state.timer.remainingSeconds / state.timer.totalDuration
    },

    isTimerActive: (state) => state.timer.status === 'running' || state.timer.status === 'paused',
    isStopwatchActive: (state) => state.stopwatch.status === 'running' || state.stopwatch.status === 'paused',
    hasActiveClockIsland: (state) =>
      state.timer.status === 'running' ||
      state.timer.status === 'paused' ||
      state.stopwatch.status === 'running' ||
      state.stopwatch.status === 'paused',

    formattedTimerIsland: (state) => {
      const s = state.timer.remainingSeconds
      const m = Math.floor(s / 60)
      const sec = s % 60
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    },

    formattedStopwatchIsland: (state) => {
      const totalSec = Math.floor(state.stopwatch.elapsedMs / 1000)
      const m = Math.floor(totalSec / 60)
      const sec = totalSec % 60
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    }
  },

  actions: {
    /* ---- 闹钟逻辑 ---- */
    toggleAlarm(id) {
      const alarm = this.alarms.find((a) => a.id === id)
      if (alarm) {
        alarm.enabled = !alarm.enabled
      }
    },

    addAlarm(alarm) {
      this.alarms.push({
        id: `a_${Date.now()}`,
        time: alarm.time || '08:00',
        days: alarm.days || [],
        repeatLabel: alarm.repeatLabel || '仅一次',
        enabled: true,
        label: alarm.label || ''
      })
    },

    deleteAlarm(id) {
      const idx = this.alarms.findIndex((a) => a.id === id)
      if (idx !== -1) {
        this.alarms.splice(idx, 1)
      }
    },

    /* ---- 定时器逻辑 ---- */
    setTimerDuration(h, m, s) {
      this.timer.selectedHours = h
      this.timer.selectedMinutes = m
      this.timer.selectedSeconds = s
      const total = h * 3600 + m * 60 + s
      this.timer.totalDuration = total
      this.timer.remainingSeconds = total
    },

    applyTimerPreset(preset) {
      const h = Math.floor(preset.duration / 3600)
      const m = Math.floor((preset.duration % 3600) / 60)
      const s = preset.duration % 60
      this.setTimerDuration(h, m, s)
      this.startTimer()
    },

    startTimer() {
      const total = this.timer.selectedHours * 3600 + this.timer.selectedMinutes * 60 + this.timer.selectedSeconds
      if (total <= 0) return
      this.timer.totalDuration = total
      this.timer.remainingSeconds = total
      this.timer.status = 'running'
      this._clearTimerInterval()
      this.timer.intervalId = setInterval(() => {
        if (this.timer.remainingSeconds > 1) {
          this.timer.remainingSeconds--
        } else {
          this.timer.remainingSeconds = 0
          this.timer.status = 'idle'
          this._clearTimerInterval()
        }
      }, 1000)
    },

    pauseTimer() {
      if (this.timer.status === 'running') {
        this.timer.status = 'paused'
        this._clearTimerInterval()
      }
    },

    resumeTimer() {
      if (this.timer.status === 'paused' && this.timer.remainingSeconds > 0) {
        this.timer.status = 'running'
        this._clearTimerInterval()
        this.timer.intervalId = setInterval(() => {
          if (this.timer.remainingSeconds > 1) {
            this.timer.remainingSeconds--
          } else {
            this.timer.remainingSeconds = 0
            this.timer.status = 'idle'
            this._clearTimerInterval()
          }
        }, 1000)
      }
    },

    cancelTimer() {
      this.timer.status = 'idle'
      this._clearTimerInterval()
      this.timer.remainingSeconds = this.timer.totalDuration
    },

    _clearTimerInterval() {
      if (this.timer.intervalId) {
        clearInterval(this.timer.intervalId)
        this.timer.intervalId = null
      }
    },

    /* ---- 秒表逻辑 ---- */
    startStopwatch() {
      if (this.stopwatch.status === 'running') return
      this.stopwatch.status = 'running'
      this.stopwatch.startTime = performance.now() - this.stopwatch.elapsedMs
      this._clearStopwatchInterval()
      this.stopwatch.intervalId = setInterval(() => {
        this.stopwatch.elapsedMs = performance.now() - this.stopwatch.startTime
      }, 30)
    },

    pauseStopwatch() {
      if (this.stopwatch.status === 'running') {
        this.stopwatch.status = 'paused'
        this._clearStopwatchInterval()
      }
    },

    resetStopwatch() {
      this.stopwatch.status = 'idle'
      this.stopwatch.elapsedMs = 0
      this.stopwatch.startTime = 0
      this.stopwatch.laps = []
      this._clearStopwatchInterval()
    },

    recordLap() {
      if (this.stopwatch.status === 'idle') return
      const totalMs = this.stopwatch.elapsedMs
      const previousTotalMs = this.stopwatch.laps.length > 0 ? this.stopwatch.laps[0].totalMs : 0
      const lapMs = totalMs - previousTotalMs
      const lapNumber = this.stopwatch.laps.length + 1
      this.stopwatch.laps.unshift({
        id: `lap_${lapNumber}_${Date.now()}`,
        lapNumber: String(lapNumber).padStart(2, '0'),
        lapMs,
        totalMs
      })
    },

    _clearStopwatchInterval() {
      if (this.stopwatch.intervalId) {
        clearInterval(this.stopwatch.intervalId)
        this.stopwatch.intervalId = null
      }
    },

    /* ---- 灵动岛与标签切换 ---- */
    setActiveTab(tab) {
      this.activeTab = tab
    },

    toggleIslandExpanded() {
      this.islandExpanded = !this.islandExpanded
    },

    setIslandExpanded(val) {
      this.islandExpanded = val
    }
  }
})
