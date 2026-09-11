import { defineStore } from 'pinia'

/**
 * 系统状态机：基础层（互斥）+ 正交叠层（各自独立进度）。
 * 所有状态转移收敛在 action 中，组件不直接改 state。
 */
export const useSystemStore = defineStore('system', {
  state: () => ({
    baseLayer: 'lock',            // 'lock' | 'home' | 'app'
    activeAppId: null,
    unlockProgress: 0,            // 解锁手势进度 0..1（桌面入场动效联动用）
    homeGestureProgress: 0,       // 应用内底部上滑返回手势进度（AppWindow 缩放预览）
    screenOn: true,               // 亮/灭屏（控制台控制；灭屏=黑屏，亮屏回锁屏）
    navigationMode: 'gesture',    // 'gesture' (手势导航) | 'threeButton' (三键导航)
    overlays: {
      notificationCenter: { status: 'closed', progress: 0 },
      controlCenter: { status: 'closed', progress: 0 },
      appLibrary: { status: 'closed', progress: 0 }
    },
    /* ---- 最近任务（App Switcher / Recent） ----
     * recentApps：最近使用的 appId 列表，LIFO 去重，最多 5 个。
     *   注意它**包含**当前 activeAppId（列表第 0 项），渲染切换器时按此排列。
     *   openApp 时自动 touchRecent，无需应用自己维护。
     * appSwitcherOpen：切换器是否展开（手势驱动时由 HomeIndicator 直写）。
     * switcherProgress：进入切换器的跟手进度 0..1（HomeIndicator 上滑时实时写），
     *   AppSwitcher 用它做「前台应用从全屏连续缩放到卡位」的跟手动画。 */
    recentApps: [],
    appSwitcherOpen: false,
    switcherProgress: 0,
    switcherDwell: false // 手势悬停已达成（5%+ 停 0.2s），邻居可以进场
  }),

  getters: {
    overlay: (s) => (name) => s.overlays[name],
    isOverlayActive: (s) => (name) => s.overlays[name].status !== 'closed'
  },

  actions: {
    setUnlockProgress(p) {
      this.unlockProgress = p
    },

    setHomeGestureProgress(p) {
      this.homeGestureProgress = p
    },

    setNavigationMode(mode) {
      if (mode === 'gesture' || mode === 'threeButton') {
        this.navigationMode = mode
      }
    },

    /** 解锁完成：lock → home */
    unlock() {
      if (this.baseLayer !== 'lock') return
      this.baseLayer = 'home'
      this.unlockProgress = 0
    },

    /** 重新锁定（电源键 / 演示用 / 亮屏） */
    lock() {
      this.baseLayer = 'lock'
      this.activeAppId = null
      this.appSwitcherOpen = false
      for (const key of Object.keys(this.overlays)) {
        this.overlays[key] = { status: 'closed', progress: 0 }
      }
    },

    /** 灭屏：全黑覆盖（屏幕事件全部失效） */
    powerOff() {
      this.screenOn = false
    },

    /** 亮屏：回到锁屏界面 */
    powerOn() {
      this.screenOn = true
      this.lock()
    },

    /** 任一叠层是否打开（Home 手势 / 侧滑返回判断用） */
    anyOverlayOpen() {
      return Object.values(this.overlays).some((o) => o.status !== 'closed')
    },

    /** 打开应用：home → app */
    openApp(appId) {
      if (this.baseLayer === 'lock') return
      this.baseLayer = 'app'
      this.activeAppId = appId
      this.touchRecent(appId)
      // 打开应用时收起所有叠层与切换器
      this.appSwitcherOpen = false
      for (const key of Object.keys(this.overlays)) {
        if (this.overlays[key].status !== 'closed') {
          this.overlays[key] = { status: 'closed', progress: 0 }
        }
      }
    },

    /* ---- 最近任务 ---- */

    /** 把 appId 提到最近列表最前（LIFO 去重，上限 5 个） */
    touchRecent(appId) {
      if (!appId) return
      this.recentApps = [appId, ...this.recentApps.filter((id) => id !== appId)].slice(0, 5)
    },

    /** 打开切换器（无最近任务时不打开）。
     *  手势路径：进度由 HomeIndicator 在松手时铺到 ~0.5，
     *  AppSwitcher 接手弹簧推到 1（前台应用连续缩进卡位，无跳变）；
     *  直开路径（桌面/调试）：AppSwitcher 检测到无 activeAppId 会把进度直接置 1。 */
    openSwitcher() {
      if (this.recentApps.length === 0) return
      this.appSwitcherOpen = true
    },

    /** 关闭切换器，回到 baseLayer（home 或 app） */
    closeSwitcher() {
      this.appSwitcherOpen = false
      this.switcherProgress = 0
      this.switcherDwell = false
    },

    /** 手势跟手进度：0 = 未进入，1 = 完全进入。
     *  上限放到 1.35：拖到最终大小之后还可以继续过拉（卡片继续缩小变透明），
     *  松手弹簧回到 1（Ricky 2026-09-11 四轮要求）。 */
    setSwitcherProgress(p) {
      this.switcherProgress = Math.max(0, Math.min(1.35, p))
    },

    /** 切换器里上滑移除某个应用卡片 */
    dismissApp(appId) {
      this.recentApps = this.recentApps.filter((id) => id !== appId)
      // 移除的是当前应用：若列表还有剩余就回到桌面，桌面兜底
      if (this.activeAppId === appId) {
        this.activeAppId = null
        this.baseLayer = 'home'
      }
      if (this.recentApps.length === 0) this.closeSwitcher()
    },

    /** 底部垃圾桶：清空全部最近任务，回桌面 */
    dismissAll() {
      this.recentApps = []
      this.activeAppId = null
      this.baseLayer = 'home'
      this.closeSwitcher()
    },

    /** 切换器里点卡片恢复某个应用 */
    resumeApp(appId) {
      if (!this.recentApps.includes(appId)) return
      this.activeAppId = appId
      this.baseLayer = 'app'
      this.touchRecent(appId)
      this.appSwitcherOpen = false
    },

    /** 返回桌面：app → home（hero 收缩完成后由 AppWindow 调用 finishGoHome） */
    goHome() {
      if (this.baseLayer !== 'app') return
      this.baseLayer = 'home'
    },
    finishGoHome() {
      this.activeAppId = null
    },

    /* ---- 叠层 ---- */

    setOverlayProgress(name, progress) {
      const o = this.overlays[name]
      o.status = 'dragging'
      o.progress = progress
    },

    /** 手势松手后由 spring 推进，到位后调用 settle 落定终态 */
    beginSettle(name, progress) {
      const o = this.overlays[name]
      o.status = 'settling'
      o.progress = progress
    },

    /** spring 推进中：只更新进度，保持 settling 状态 */
    updateSettleProgress(name, progress) {
      this.overlays[name].progress = progress
    },

    settleOverlay(name, open) {
      const o = this.overlays[name]
      if (open) {
        // 互斥：开 NC 时关 CC，反之亦然
        if (name === 'notificationCenter') this.closeOverlay('controlCenter')
        if (name === 'controlCenter') this.closeOverlay('notificationCenter')
        // 打开叠层时收起切换器（层级语义：叠层更高）
        this.appSwitcherOpen = false
        o.status = 'open'
        o.progress = 1
      } else {
        o.status = 'closed'
        o.progress = 0
      }
    },

    closeOverlay(name) {
      const o = this.overlays[name]
      if (o.status === 'closed') return
      o.status = 'closed'
      o.progress = 0
    },

    /** 请求关闭（动画路径）：置 closing，由 ScreenView 的 spring 播完收起动画后 settle */
    requestCloseOverlay(name) {
      const o = this.overlays[name]
      if (o.status === 'open' || o.status === 'settling') o.status = 'closing'
    }
  }
})
