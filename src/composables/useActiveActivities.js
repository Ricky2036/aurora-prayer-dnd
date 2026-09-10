import { computed } from 'vue'
import { useClockStore } from '../stores/clockStore.js'
import { useRecorderStore } from '../stores/recorderStore.js'
import { usePrayerStore } from '../stores/prayerStore.js'
import { useSystemStore } from '../stores/systemStore.js'
import { useI18nStore } from '../stores/i18nStore.js'
import { useNotificationsStore } from '../stores/notificationsStore.js'
import { useControlStore } from '../stores/controlStore.js'

/**
 * 集中管理所有处于活动状态的灵动岛 Live Activity
 * 供灵动岛、通知中心、锁屏通知共用
 */
export function useActiveActivities() {
  const clockStore = useClockStore()
  const recorderStore = useRecorderStore()
  const prayerStore = usePrayerStore()
  const system = useSystemStore()
  const i18n = useI18nStore()
  const notificationsStore = useNotificationsStore()
  const control = useControlStore()

  prayerStore.startTicker()

  const isAlarmActive = computed(() => {
    return notificationsStore.isIslandEnabled('alarm') && clockStore.isAlarmActive
  })

  const isRecorderActive = computed(() => {
    return notificationsStore.isIslandEnabled('recorder') && recorderStore.isRecording && system.activeAppId !== 'voicememos'
  })

  const isTimerActive = computed(() => {
    return notificationsStore.isIslandEnabled('timer') && clockStore.isTimerActive && system.activeAppId !== 'clock'
  })

  const isStopwatchActive = computed(() => {
    return notificationsStore.isIslandEnabled('stopwatch') && clockStore.isStopwatchActive && system.activeAppId !== 'clock'
  })

  const isPrayerActive = computed(() => {
    return notificationsStore.isIslandEnabled('prayer') && Boolean(prayerStore.currentIslandPrayer)
  })

  const isMediaActive = computed(() => {
    return notificationsStore.isIslandEnabled('media') && Boolean(control.mediaActive)
  })

  const formattedPrayerCountdown = computed(() => {
    const s = prayerStore.islandCountdownSeconds
    const hrs = Math.floor(s / 3600)
    const mins = Math.floor((s % 3600) / 60)
    const secs = s % 60
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  })

  const prayerSubtitle = computed(() => {
    const prayerId = prayerStore.currentIslandPrayer?.id || 'fajr'
    return i18n.islandSub ? i18n.islandSub(prayerId) : '晨礼勿扰已开启'
  })

  /**
   * 全部处于活动状态的活动列表（不设数量上限，有几个就显示几个）
   * 排序顺序：闹钟 > 定时器 > 秒表 > 录音 > 礼拜
   */
  const activeActivities = computed(() => {
    const list = []
    if (isAlarmActive.value && clockStore.ringingAlarm) {
      list.push({
        id: 'alarm',
        type: 'alarm',
        appId: 'clock',
        title: clockStore.ringingAlarm.status === 'snoozing'
          ? clockStore.formattedSnoozeCountdown
          : (clockStore.ringingAlarm.time || '20:44'),
        subtitle: clockStore.ringingAlarm.status === 'snoozing'
          ? '稍后提醒倒计时'
          : (clockStore.ringingAlarm.label || '闹钟'),
        status: clockStore.ringingAlarm.status
      })
    }
    if (isTimerActive.value) {
      list.push({
        id: 'timer',
        type: 'timer',
        appId: 'clock',
        title: clockStore.formattedTimerIsland,
        subtitle: clockStore.timer.status === 'paused' ? '已暂停' : '倒计时',
        status: clockStore.timer.status
      })
    }
    if (isStopwatchActive.value) {
      list.push({
        id: 'stopwatch',
        type: 'stopwatch',
        appId: 'clock',
        title: clockStore.formattedStopwatchIsland,
        subtitle: clockStore.stopwatch.status === 'paused' ? '秒表 · 已暂停' : '秒表 · 计时中',
        status: clockStore.stopwatch.status
      })
    }
    if (isRecorderActive.value) {
      list.push({
        id: 'recorder',
        type: 'recorder',
        appId: 'voicememos',
        title: recorderStore.formattedTime,
        subtitle: recorderStore.isPaused ? '录音已暂停' : '正在录音',
        status: recorderStore.isPaused ? 'paused' : 'recording'
      })
    }
    if (isPrayerActive.value) {
      list.push({
        id: 'prayer',
        type: 'prayer',
        appId: 'clock',
        title: formattedPrayerCountdown.value,
        subtitle: prayerSubtitle.value,
        status: 'active'
      })
    }
    return list
  })

  return {
    isAlarmActive,
    isRecorderActive,
    isTimerActive,
    isStopwatchActive,
    isPrayerActive,
    isMediaActive,
    formattedPrayerCountdown,
    prayerSubtitle,
    activeActivities
  }
}
