import { defineStore } from 'pinia'

/** 桌面状态：当前分页与 hero 期间隐藏的真实图标。锚点 DOM 由独立注册表管理。 */
export const useHomeStore = defineStore('home', {
  state: () => ({
    currentPage: 0,
    hiddenIconId: null  // hero 动画期间隐藏图标本体防重影
  }),

  actions: {
    setPage(i) { this.currentPage = i },

    hideIcon(appId) { this.hiddenIconId = appId },
    showIcon() { this.hiddenIconId = null }
  }
})
