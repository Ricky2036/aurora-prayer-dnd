import { defineStore } from 'pinia'

/**
 * 辅助函数：将星期数组格式化为用户友好的重复描述
 */
export function formatDaysRepeat(days = []) {
  if (!days || days.length === 0) return '仅一次'
  if (days.length === 7) return '每天'
  const sorted = [...days].sort((a, b) => a - b)
  const isWorkdays = sorted.length === 5 && sorted.every((d, i) => d === i + 1)
  if (isWorkdays) return '周一至周五'
  const isWeekend = sorted.length === 2 && sorted.includes(0) && sorted.includes(6)
  if (isWeekend) return '周日, 周六'
  const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return sorted.map((d) => DAY_NAMES[d]).join(', ')
}

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
        label: '',
        ringDateEnabled: false,
        ringDate: '',
        ringtone: '默认铃声',
        snooze: '10 分钟, 3 次',
        vibration: '跟随音乐节奏',
        folaxBroadcast: '已关闭'
      },
      {
        id: 'a2',
        time: '07:10',
        days: [1, 2, 3, 4, 5],
        repeatLabel: '周一至周五',
        enabled: true,
        label: '',
        ringDateEnabled: false,
        ringDate: '',
        ringtone: '默认铃声',
        snooze: '10 分钟, 3 次',
        vibration: '跟随音乐节奏',
        folaxBroadcast: '已关闭'
      },
      {
        id: 'a3',
        time: '07:40',
        days: [],
        repeatLabel: '仅一次',
        enabled: false,
        label: '',
        ringDateEnabled: false,
        ringDate: '',
        ringtone: '默认铃声',
        snooze: '10 分钟, 3 次',
        vibration: '跟随音乐节奏',
        folaxBroadcast: '已关闭'
      },
      {
        id: 'a4',
        time: '08:00',
        days: [0, 1, 2, 3, 4, 5, 6],
        repeatLabel: '每天',
        enabled: true,
        label: '收菜',
        ringDateEnabled: false,
        ringDate: '',
        ringtone: '默认铃声',
        snooze: '10 分钟, 3 次',
        vibration: '跟随音乐节奏',
        folaxBroadcast: '已关闭'
      },
      {
        id: 'a5',
        time: '19:35',
        days: [0, 1, 2, 3, 4, 5, 6],
        repeatLabel: '每天',
        enabled: true,
        label: '',
        ringDateEnabled: false,
        ringDate: '',
        ringtone: '默认铃声',
        snooze: '10 分钟, 3 次',
        vibration: '跟随音乐节奏',
        folaxBroadcast: '已关闭'
      },
      {
        id: 'a6',
        time: '20:43',
        days: [],
        repeatLabel: '仅一次',
        enabled: false,
        label: '',
        ringDateEnabled: false,
        ringDate: '',
        ringtone: '默认铃声',
        snooze: '10 分钟, 3 次',
        vibration: '跟随音乐节奏',
        folaxBroadcast: '已关闭'
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

    // 闹钟响铃与灵动岛提醒状态
    ringingAlarm: null, // null | { id, time, label, snooze, remainingSnoozeSeconds, status: 'ringing' | 'snoozing', snoozeCount }
    _lastTriggeredMinute: '',
    _alarmTickerId: null,

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

    isAlarmActive: (state) => Boolean(state.ringingAlarm),
    isAlarmRinging: (state) => state.ringingAlarm?.status === 'ringing',
    isAlarmSnoozing: (state) => state.ringingAlarm?.status === 'snoozing',
    formattedSnoozeCountdown: (state) => {
      if (!state.ringingAlarm || state.ringingAlarm.status !== 'snoozing') return ''
      const s = Math.max(0, state.ringingAlarm.remainingSnoozeSeconds || 0)
      const m = Math.floor(s / 60)
      const sec = s % 60
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    },

    isTimerActive: (state) => state.timer.status === 'running' || state.timer.status === 'paused',
    isStopwatchActive: (state) => state.stopwatch.status === 'running' || state.stopwatch.status === 'paused',
    hasActiveClockIsland: (state) =>
      Boolean(state.ringingAlarm) ||
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
      const days = alarm.days || []
      const repeatLabel = alarm.repeatLabel || formatDaysRepeat(days)
      const newAlarm = {
        id: alarm.id || `a_${Date.now()}`,
        time: alarm.time || '08:00',
        days,
        repeatLabel,
        enabled: alarm.enabled ?? true,
        label: alarm.label || '',
        ringDateEnabled: alarm.ringDateEnabled ?? false,
        ringDate: alarm.ringDate || '',
        ringtone: alarm.ringtone || '默认铃声',
        snooze: alarm.snooze || '10 分钟, 3 次',
        vibration: alarm.vibration || '跟随音乐节奏',
        folaxBroadcast: alarm.folaxBroadcast || '已关闭'
      }
      this.alarms.push(newAlarm)
      return newAlarm
    },

    updateAlarm(id, patch) {
      const idx = this.alarms.findIndex((a) => a.id === id)
      if (idx !== -1) {
        const current = this.alarms[idx]
        const merged = { ...current, ...patch }
        if (patch.days && !patch.repeatLabel) {
          merged.repeatLabel = formatDaysRepeat(patch.days)
        }
        this.alarms[idx] = merged
        return this.alarms[idx]
      }
      return null
    },

    deleteAlarm(id) {
      const idx = this.alarms.findIndex((a) => a.id === id)
      if (idx !== -1) {
        this.alarms.splice(idx, 1)
      }
    },

    /* ---- 闹钟响铃与灵动岛联动 ---- */
    triggerAlarm(alarmOrId = null) {
      let target = null
      if (typeof alarmOrId === 'string') {
        target = this.alarms.find((a) => a.id === alarmOrId)
      } else if (alarmOrId && typeof alarmOrId === 'object') {
        target = alarmOrId
      }
      if (!target) {
        // 优先使用启用的闹钟，兜底 20:44（对齐最新参考截图）
        target = this.alarms.find((a) => a.enabled) || {
          id: 'alarm_2044',
          time: '20:44',
          label: '闹钟',
          snooze: '10 分钟, 3 次'
        }
      }

      this.ringingAlarm = {
        id: target.id || 'alarm_active',
        time: target.time || '20:44',
        label: target.label || '闹钟',
        snooze: target.snooze || '10 分钟, 3 次',
        status: 'ringing',
        remainingSnoozeSeconds: 0,
        snoozeCount: (this.ringingAlarm?.id === target.id ? this.ringingAlarm.snoozeCount : 0) || 0
      }
      this.islandExpanded = true
      this.startAlarmTicker()
      return this.ringingAlarm
    },

    snoozeAlarm(customSeconds = null) {
      if (!this.ringingAlarm) return
      let duration = 600 // 默认 10 分钟
      if (typeof customSeconds === 'number' && customSeconds > 0) {
        duration = customSeconds
      } else {
        const match = String(this.ringingAlarm.snooze).match(/(\d+)\s*分钟/)
        if (match) {
          duration = parseInt(match[1], 10) * 60
        }
      }

      this.ringingAlarm.status = 'snoozing'
      this.ringingAlarm.remainingSnoozeSeconds = duration
      this.ringingAlarm.totalSnoozeSeconds = duration
      this.ringingAlarm.snoozeCount = (this.ringingAlarm.snoozeCount || 0) + 1
      this.islandExpanded = false // 延时后收起为灵动岛胶囊倒计时
      this.startAlarmTicker()
    },

    dismissAlarm() {
      if (this.ringingAlarm) {
        const target = this.alarms.find((a) => a.id === this.ringingAlarm.id)
        if (target && (!target.days || target.days.length === 0)) {
          target.enabled = false
        }
      }
      this.ringingAlarm = null
      this.islandExpanded = false
    },

    startAlarmTicker() {
      if (this._alarmTickerId) return
      this._alarmTickerId = setInterval(() => {
        // 1. 处理延时倒计时
        if (this.ringingAlarm && this.ringingAlarm.status === 'snoozing') {
          if (this.ringingAlarm.remainingSnoozeSeconds > 1) {
            this.ringingAlarm.remainingSnoozeSeconds--
          } else {
            // 倒计时完成，再次触发响铃提醒！
            this.ringingAlarm.remainingSnoozeSeconds = 0
            this.ringingAlarm.status = 'ringing'
            this.islandExpanded = true
          }
        }

        // 2. 检查真实时间是否触发已启用的闹钟
        const now = new Date()
        const hh = String(now.getHours()).padStart(2, '0')
        const mm = String(now.getMinutes()).padStart(2, '0')
        const currentHM = `${hh}:${mm}`
        if (now.getSeconds() === 0 && this._lastTriggeredMinute !== currentHM) {
          const matched = this.alarms.find((a) => a.enabled && a.time === currentHM)
          if (matched && !this.ringingAlarm) {
            this._lastTriggeredMinute = currentHM
            this.triggerAlarm(matched)
          }
        }
      }, 1000)
    },

    stopAlarmTicker() {
      if (this._alarmTickerId) {
        clearInterval(this._alarmTickerId)
        this._alarmTickerId = null
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
