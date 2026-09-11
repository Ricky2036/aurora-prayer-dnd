import { defineStore } from 'pinia'
/* 词条数据 2026-09-11 起分包到 src/locales/，这里只做组装。
 * 新增应用词条：新建 src/locales/<app>.js 并在 loader 里注册，别往 messages.js 塞。 */
import { APP_NAMES } from '../locales/app-names.js'
import { CC_LABELS } from '../locales/cc-labels.js'
import { CATEGORIES_NAMES } from '../locales/categories-names.js'
import { MESSAGES } from '../locales/messages.js'

/* 保持原有导出，历史代码里若有直接 import 常量的地方不受影响 */
export { APP_NAMES, CC_LABELS, CATEGORIES_NAMES, MESSAGES }

export const useI18nStore = defineStore('i18n', {
  state: () => ({
    locale: 'zh' // 'zh' | 'en' | 'bn'
  }),
  getters: {
    t: (s) => (key) => MESSAGES[s.locale]?.[key] || MESSAGES.zh[key] || key,
    islandSub: (s) => (prayerId) => {
      const pName = MESSAGES[s.locale]?.prayers?.[prayerId]?.name || prayerId
      const fn = MESSAGES[s.locale]?.islandActiveSub || MESSAGES.zh.islandActiveSub
      return fn(pName)
    },
    prayerName: (s) => (prayerId) => MESSAGES[s.locale]?.prayers?.[prayerId]?.name || prayerId,
    prayerFull: (s) => (prayerId) => MESSAGES[s.locale]?.prayers?.[prayerId]?.full || prayerId,
    monthNames: (s) => MESSAGES[s.locale]?.monthNames || MESSAGES.zh.monthNames,
    ccLabel: (s) => (id) => CC_LABELS[s.locale]?.[id] || CC_LABELS.zh[id] || id,
    longWeekDays: (s) => MESSAGES[s.locale]?.longWeekDays || MESSAGES.zh.longWeekDays,
    /* 通知种子文案按 appId 索引：存 key 而不是写死文本，切语言时已收的通知也会跟着变 */
    notifTitle: (s) => (id) => MESSAGES[s.locale]?.demoNotifTitles?.[id] || MESSAGES.zh.demoNotifTitles?.[id] || id,
    notifBody: (s) => (id) => MESSAGES[s.locale]?.demoNotifBodies?.[id] || MESSAGES.zh.demoNotifBodies?.[id] || '',
    /* 演示数据：电话通讯录 / 通话记录 / 信息会话 */
    demoChat: (s) => MESSAGES[s.locale]?.demoChat || MESSAGES.zh.demoChat,
    demoRecents: (s) => MESSAGES[s.locale]?.demoRecents || MESSAGES.zh.demoRecents,
    demoContacts: (s) => MESSAGES[s.locale]?.demoContacts || MESSAGES.zh.demoContacts,
    currentWeekDays: (s) => MESSAGES[s.locale]?.weekDays || MESSAGES.zh.weekDays,
    calWeekDays: (s) => MESSAGES[s.locale]?.calWeekDays || MESSAGES.zh.calWeekDays,
    appName: (s) => (appId) => APP_NAMES[s.locale]?.[appId] || APP_NAMES.zh[appId] || appId,
    categoryName: (s) => (catKey) => CATEGORIES_NAMES[s.locale]?.[catKey] || CATEGORIES_NAMES.zh[catKey] || catKey
  },
  actions: {
    setLocale(loc) {
      this.locale = loc
    }
  }
})
