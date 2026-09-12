import { defineStore } from 'pinia'
/* 词条数据 2026-09-11 起分包到 src/locales/，这里只做组装。
 * 新增应用词条：新建 src/locales/<app>.js 并在 loader 里注册，别往 messages.js 塞。 */
import { APP_NAMES } from '../locales/app-names.js'
import { CC_LABELS } from '../locales/cc-labels.js'
import { CATEGORIES_NAMES } from '../locales/categories-names.js'
import { MESSAGES } from '../locales/messages.js'

export { APP_NAMES, CC_LABELS, CATEGORIES_NAMES, MESSAGES }

export const useI18nStore = defineStore('i18n', {
  state: () => ({
    locale: 'zh' // 'zh' | 'en' | 'bn'
  }),
  getters: {
    t: (s) => (key) => MESSAGES[s.locale]?.[key] ?? MESSAGES.zh[key] ?? key,
    islandSub: (s) => (prayerId) => {
      const pName = MESSAGES[s.locale]?.prayers?.[prayerId]?.name || prayerId
      const fn = MESSAGES[s.locale]?.islandActiveSub || MESSAGES.zh.islandActiveSub
      return typeof fn === 'function' ? fn(pName) : pName
    },
    prayerName: (s) => (prayerId) => MESSAGES[s.locale]?.prayers?.[prayerId]?.name || prayerId,
    prayerFull: (s) => (prayerId) => MESSAGES[s.locale]?.prayers?.[prayerId]?.full || prayerId,
    monthNames: (s) => MESSAGES[s.locale]?.monthNames || MESSAGES.zh.monthNames || [],
    ccLabel: (s) => (id) => CC_LABELS[s.locale]?.[id] || CC_LABELS.zh[id] || id,
    longWeekDays: (s) => MESSAGES[s.locale]?.longWeekDays || MESSAGES.zh.longWeekDays || [],
    notifTitle: (s) => (id) => MESSAGES[s.locale]?.demoNotifTitles?.[id] || MESSAGES.zh.demoNotifTitles?.[id] || id,
    notifBody: (s) => (id) => MESSAGES[s.locale]?.demoNotifBodies?.[id] || MESSAGES.zh.demoNotifBodies?.[id] || '',
    demoChat: (s) => MESSAGES[s.locale]?.demoChat || MESSAGES.zh.demoChat,
    demoRecents: (s) => MESSAGES[s.locale]?.demoRecents || MESSAGES.zh.demoRecents,
    demoContacts: (s) => MESSAGES[s.locale]?.demoContacts || MESSAGES.zh.demoContacts,
    currentWeekDays: (s) => MESSAGES[s.locale]?.weekDays || MESSAGES.zh.weekDays || [],
    calWeekDays: (s) => MESSAGES[s.locale]?.calWeekDays || MESSAGES.zh.calWeekDays || [],
    appName: (s) => (appId) => APP_NAMES[s.locale]?.[appId] || APP_NAMES.zh[appId] || appId,
    categoryName: (s) => (catKey) => CATEGORIES_NAMES[s.locale]?.[catKey] || CATEGORIES_NAMES.zh[catKey] || catKey,
    notifAuthPrompt: (s) => (app) => {
      const fn = MESSAGES[s.locale]?.notifAuthPrompt || MESSAGES.zh.notifAuthPrompt
      return typeof fn === 'function' ? fn(app) : `要允许“${app}”向您发送通知吗？`
    }
  },
  actions: {
    setLocale(loc) {
      if (['zh', 'en', 'bn'].includes(loc)) {
        this.locale = loc
      }
    }
  }
})
