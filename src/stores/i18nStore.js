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
    locale: 'zh'
  }),
  getters: {
    t: (s) => (key) => MESSAGES[s.locale]?.[key] ?? MESSAGES.zh[key] ?? key,
    appName: (s) => (appId) => APP_NAMES[s.locale]?.[appId] || APP_NAMES.zh[appId] || appId,
    categoryName: (s) => (catKey) => CATEGORIES_NAMES[s.locale]?.[catKey] || CATEGORIES_NAMES.zh[catKey] || catKey,
    currentWeekDays: (s) => MESSAGES[s.locale]?.weekDays || MESSAGES.zh.weekDays,
    calWeekDays: (s) => MESSAGES[s.locale]?.calWeekDays || MESSAGES.zh.calWeekDays,
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
