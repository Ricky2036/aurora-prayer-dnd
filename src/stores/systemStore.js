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
    overlays: {
      notificationCenter: { status: 'closed', progress: 0 },
      controlCenter: { status: 'closed', progress: 0 },
      appLibrary: { status: 'closed', progress: 0 }
    }
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
      // 打开应用时收起所有叠层
      for (const key of Object.keys(this.overlays)) {
        if (this.overlays[key].status !== 'closed') {
          this.overlays[key] = { status: 'closed', progress: 0 }
        }
      }
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
