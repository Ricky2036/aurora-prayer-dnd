import { defineStore } from 'pinia'

/** 控制中心 / 状态栏 / 亮度滤镜共享的真实开关状态 */
export const useControlStore = defineStore('control', {
  state: () => ({
    brightness: 0.45,     // 0.25..1，驱动屏幕滤镜（默认与设计图 45% 一致）
    volume: 0.65,        // 默认与设计图 65% 一致
    airplane: true,
    wifi: true,
    bluetooth: true,
    cellular: true,
    doNotDisturb: false,
    rotationLock: false,
    flashlight: false,
    battery: 0.86,

    /* ---- 安卓控制中心扩展 ---- */
    soundMode: 'ring',    // 'ring' | 'vibrate' | 'mute'
    hotspot: false,
    location: true,
    screenRecord: false,
    darkMode: false,
    screenshot: false,
    batterySaver: false,
    share: false,
    sync: false,
    calculator: false,
    scan: false,
    nfc: false,
    boost: false,
    autoRotate: false,
    cast: false,
    dnd: false,
    mediaPlaying: true,

    /* ---- 控制台 / 编辑模式（与 App.vue 控制台共享） ---- */
    editing: false,        // 控制中心编辑模式（控制台可切换）
    dragMode: 'swap'       // 'swap' 绝对坐标沉降 | 'flow' 流式推挤（控制台切换）
  }),

  actions: {
    toggle(key) {
      if (typeof this[key] === 'boolean') this[key] = !this[key]
    },
    setEditing(v) { this.editing = v },
    setDragMode(m) { if (m === 'swap' || m === 'flow') this.dragMode = m },
    setBrightness(v) { this.brightness = Math.min(1, Math.max(0.25, v)) },
    setVolume(v) { this.volume = Math.min(1, Math.max(0, v)) },
    setSoundMode(mode) {
      if (['ring', 'vibrate', 'mute'].includes(mode)) this.soundMode = mode
    },
    cycleSoundMode() {
      const order = ['ring', 'vibrate', 'mute']
      const i = order.indexOf(this.soundMode)
      this.soundMode = order[(i + 1) % 3]
    }
  }
})
