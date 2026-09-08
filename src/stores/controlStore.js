import { defineStore, acceptHMRUpdate } from 'pinia'

/* ---- 控制中心图标/底板默认尺寸基准表 ---- */
export const DEFAULT_ICON_SIZES = {
  wifi: 26,
  data: 26,
  bluetooth: 26,
  darkMode: 40,
  oneLeap: 20,
  health: 20,
  calculator: 31,
  boost: 32,
  dnd: 34,
  location: 32,
  scan: 31,
  hotspot: 32,
  airplane: 31,
  rotationLock: 33,
  batterySaver: 31,
  screenshot: 31,
  share: 33,
  cast: 32,
  flashlight: 32,
  flashlight_on: 32,
  flashlight_off: 27,
  sound: 24,
  sound_ring_2x1: 22,
  sound_vibrate_2x1: 26,
  sound_mute_2x1: 24,
  sound_ring_1x1: 27,
  sound_vibrate_1x1: 32,
  sound_mute_1x1: 32,
  sound_ring: 20,
  sound_vibrate: 20,
  sound_mute: 20,
  headerEdit: 15,
  headerSettings: 15,
  screenRecord: 26,
  autoRotate: 30,
  mediaCast: 18,
  motionComfort: 34,
  liquidCooling: 32,
  shoulderKey: 32,
  jbl: 32
}

export const DEFAULT_BG_SIZES = {
  wifi: 38,
  data: 38,
  bluetooth: 38,
  oneLeap: 38,
  health: 38,
  headerEdit: 30,
  headerSettings: 30,
  mediaCast: 28
}

export const ITEM_LABELS = {
  mediaCast: '播放器投播',
  wifi: '无线网络',
  data: '蜂窝网络',
  oneLeap: '设备中心',
  health: '心率血氧',
  bluetooth: '蓝牙',
  hotspot: '热点',
  airplane: '飞行模式',
  location: '定位',
  screenshot: '截屏',
  darkMode: '深色主题',
  dnd: '勿扰',
  sound: '响铃/静音',
  sound_ring_2x1: '响铃 (2x1展开)',
  sound_vibrate_2x1: '振动 (2x1展开)',
  sound_mute_2x1: '静音 (2x1展开)',
  sound_ring_1x1: '响铃 (1x1)',
  sound_vibrate_1x1: '振动 (1x1)',
  sound_mute_1x1: '静音 (1x1)',
  sound_ring: '响铃状态',
  sound_vibrate: '振动状态',
  sound_mute: '静音状态',
  headerEdit: '顶部编辑',
  headerSettings: '顶部设置',
  rotationLock: '旋转锁定',
  screenRecord: '录屏',
  batterySaver: '省电模式',
  autoRotate: '红外遥控',
  // cast 位现在挂的是「快速分享」图标，share 位原来叫快速分享，改名极速互传避免两个同名
  share: '极速互传',
  cast: '快速分享',
  flashlight: '手电筒',
  flashlight_on: '手电筒 (开启)',
  flashlight_off: '手电筒 (关闭)',
  calculator: '钱包',
  scan: '扫一扫',
  boost: '加速',
  motionComfort: '晕动舒缓',
  liquidCooling: '液冷散热',
  shoulderKey: '肩键',
  jbl: 'JBL'
}

/* ---- 宫格整体缩放（gridScale）：格子 + 间距 + 图标 + 底板一起等比缩放 ----
 * 基准几何：格子 62、间距 14、4 列 → 网格宽 290、360 屏两侧留白各 35。
 * 图标/底板/格子/间距全部由这一个倍率驱动，不再单独调图标 ——
 * 分开调会导致图标相对底板漂移（底板居中是按 12+38+12=62 算的）。 */
/* ---- 默认布局预设：机型 + 系统版本（tOS16 / tOS17）的默认宫格差异 ----
 * only 里的磁贴只有该机型才有，其余磁贴三机型通用（CAMON 没有独占项）。
 * id 与 ControlCenter 的 baseItems / TOGGLES 对齐：
 *   joyHeart = 心率血氧胶囊，jbl = JBL 开关，liquidCooling = 液冷散热，shoulderKey = 肩键
 * 注意：jbl 已按需求从默认布局下线（Ricky 2026-09-08），所以它既不在这里的 only 里，
 *   也不在 ControlCenter 的 DEFAULT_TOGGLE_IDS 里 —— 只删一处会让它泄漏到别的机型，别踩。
 * series：'16' = tOS16（顶行），'17' = tOS17（底行，用于与 tOS16 对比）。
 * removed：在「基础布局」之上额外剔除的开关（tOS17 相对 tOS16 去掉的开关）。
 *   当前 NOTE/GT 的 tOS17 版相对 tOS16 去掉：深色模式(darkMode) / 红外遥控(autoRotate) /
 *   晕动舒缓(motionComfort)。CAMON 的 tOS17 沿用 HiOS 17 的固定清单（HIOS17_ITEMS）。 */
export const LAYOUT_PRESETS = [
  { id: 'camon', label: 'CAMON', series: '16', only: [] },
  { id: 'note', label: 'NOTE', series: '16', only: ['joyHeart'] },
  { id: 'gt', label: 'GT', series: '16', only: ['liquidCooling', 'shoulderKey'] },
  { id: 'hios17', label: 'HiOS 17', series: '17', only: [] },
  { id: 'note17', label: 'NOTE 17', series: '17', only: ['joyHeart'], removed: ['darkMode', 'autoRotate', 'motionComfort'] },
  { id: 'gt17', label: 'GT 17', series: '17', only: ['liquidCooling', 'shoulderKey'], removed: ['darkMode', 'autoRotate', 'motionComfort'] }
]
/** 所有「机型独有」磁贴：通用布局里要把它们全部排除 */
export const PRESET_EXCLUSIVE_IDS = LAYOUT_PRESETS.flatMap((p) => p.only)

export const BASE_CELL = 62
export const BASE_GAP = 14
export const GRID_COLS = 4
export const GRID_SCALE_MIN = 0.9
export const GRID_SCALE_MAX = 1.24

function clampScale(v, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 1
  return Math.min(max, Math.max(min, n))
}

function loadStorageOverrides() {
  try {
    const raw = localStorage.getItem('aurora_cc_fine_tuning')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        icons: parsed.icons || {},
        bgs: parsed.bgs || {},
        gridScale: parsed.gridScale
      }
    }
  } catch (e) {
    console.warn('Failed to load fine tuning overrides:', e)
  }
  return { icons: {}, bgs: {} }
}

function loadStoredDefaults() {
  try {
    const raw = localStorage.getItem('aurora_cc_custom_defaults')
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        icons: parsed.icons || {},
        bgs: parsed.bgs || {}
      }
    }
  } catch (e) {
    console.warn('Failed to load custom defaults:', e)
  }
  return { icons: {}, bgs: {} }
}

const initialOverrides = loadStorageOverrides()
const initialDefaults = loadStoredDefaults()

/** 控制中心 / 状态栏 / 亮度滤镜共享的真实开关状态 */
export const useControlStore = defineStore('control', {
  state: () => ({
    brightness: 1.0,     // 0.25..1，驱动屏幕滤镜（默认全亮纯白）
    volume: 0.65,        // 默认与设计图 65% 一致
    airplane: false,
    wifi: true,
    bluetooth: true,
    cellular: true,
    doNotDisturb: false,
    rotationLock: false,
    flashlight: false,
    battery: 0.86,

    /* ---- 安卓控制中心扩展 ---- */
    soundMode: 'ring',    // 'ring' | 'vibrate' | 'mute'
    soundItemSize: '1x1', // 当前响铃开关卡片规格：'1x1' | '2x1'
    hotspot: false,
    location: false,
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
    motionComfort: false,
    liquidCooling: false,
    shoulderKey: false,
    jbl: false,
    dnd: false,
    mediaPlaying: true,

    /* ---- 控制台 / 编辑模式（与 App.vue 控制台共享） ---- */
    editing: false,        // 控制中心编辑模式（控制台可切换）
    dragMode: 'swap',      // 'swap' 绝对坐标沉降 | 'flow' 流式推挤（控制台切换）
    layoutPreset: 'camon', // 'camon' | 'note' | 'gt' —— 默认布局（控制台切换）
    showPrivacyIndicators: false, // 控制中心顶部隐私图标（默认不显示）
    showDualSim: false,           // 控制中心双卡显示切换（默认单卡，开启显示双卡双行）

    /* ---- 像素级微调模式 (Fine-Tuning Mode) ---- */
    fineTuningMode: false,
    selectedTarget: 'wifi',
    selectedSubTarget: 'icon', // 'icon' | 'bg'，默认选中修改图标尺寸
    customDefaultIconSizes: { ...DEFAULT_ICON_SIZES, ...initialDefaults.icons },
    customDefaultBgSizes: { ...DEFAULT_BG_SIZES, ...initialDefaults.bgs },
    iconSizeOverrides: { ...initialOverrides.icons },
    bgSizeOverrides: { ...initialOverrides.bgs },
    /** 宫格整体缩放倍率：格子 + 间距 + 图标 + 底板一起等比放大 */
    gridScale: clampScale(initialOverrides.gridScale, GRID_SCALE_MIN, GRID_SCALE_MAX)
  }),

  getters: {
    /** 格子边长（px） */
    cellSize() { return BASE_CELL * this.gridScale },
    /** 行列间距（px） */
    gridGap() { return BASE_GAP * this.gridScale },
    /** 一个格子的步距（格子 + 间距），拖拽换算全靠它 */
    cellPitch() { return this.cellSize + this.gridGap },
    /** 网格总宽 = 4 列 + 3 间距 */
    gridWidth() { return GRID_COLS * this.cellSize + (GRID_COLS - 1) * this.gridGap },
    /** 图标与底板的倍率：与格子同一个倍率，保证始终居中 */
    iconFactor() { return this.gridScale }
  },

  actions: {
    toggle(key) {
      if (typeof this[key] === 'boolean') this[key] = !this[key]
    },
    /** 精确赋值（录屏状态需要与真实录制状态同步，不能用取反的 toggle） */
    setFlag(key, value) {
      if (typeof this[key] === 'boolean') this[key] = !!value
    },
    setEditing(v) { this.editing = v },
    setDragMode(m) { if (m === 'swap' || m === 'flow') this.dragMode = m },
    setLayoutPreset(id) {
      if (LAYOUT_PRESETS.some((p) => p.id === id)) this.layoutPreset = id
    },
    setShowPrivacyIndicators(v) { this.showPrivacyIndicators = !!v },
    setShowDualSim(v) { this.showDualSim = !!v },
    setBrightness(v) { this.brightness = Math.min(1, Math.max(0.25, v)) },
    setVolume(v) { this.volume = Math.min(1, Math.max(0, v)) },
    setSoundItemSize(size) {
      if (size === '1x1' || size === '2x1') this.soundItemSize = size
    },
    setSoundMode(mode) {
      if (['ring', 'vibrate', 'mute'].includes(mode)) {
        this.soundMode = mode
        const suffix = this.soundItemSize === '1x1' ? '1x1' : '2x1'
        this.selectedTarget = `sound_${mode}_${suffix}`
      }
    },
    cycleSoundMode() {
      const order = ['ring', 'vibrate', 'mute']
      const i = order.indexOf(this.soundMode)
      this.setSoundMode(order[(i + 1) % 3])
    },

    /* ---- 微调模式相关 Actions ---- */
    setFineTuningMode(v) {
      this.fineTuningMode = !!v
      if (this.fineTuningMode) {
        if (!this.selectedTarget) {
          this.selectedTarget = 'wifi'
        } else if (this.selectedTarget.startsWith('sound_') || this.selectedTarget === 'sound') {
          // 再次进入微调模式时，选中的声音目标与当前实际处于的 soundMode 及卡片规格保持强一致
          const suffix = this.soundItemSize === '1x1' ? '1x1' : '2x1'
          this.selectedTarget = `sound_${this.soundMode}_${suffix}`
        }
      }
    },
    selectTarget(id, subTarget = 'icon') {
      this.selectedTarget = id
      this.selectedSubTarget = subTarget || 'icon'
      if (id.startsWith('sound_ring')) {
        this.soundMode = 'ring'
      } else if (id.startsWith('sound_vibrate')) {
        this.soundMode = 'vibrate'
      } else if (id.startsWith('sound_mute')) {
        this.soundMode = 'mute'
      } else if (id === 'sound') {
        const suffix = this.soundItemSize === '1x1' ? '1x1' : '2x1'
        this.selectedTarget = `sound_${this.soundMode}_${suffix}`
      }
      if (id === 'flashlight_on') {
        this.flashlight = true
      } else if (id === 'flashlight_off') {
        this.flashlight = false
      }
    },
    setSelectedSubTarget(sub) {
      if (sub === 'icon' || sub === 'bg') {
        this.selectedSubTarget = sub
      }
    },
    getDefaultIconSize(id) {
      if (this.customDefaultIconSizes[id] !== undefined) return this.customDefaultIconSizes[id]
      if (DEFAULT_ICON_SIZES[id] !== undefined) return DEFAULT_ICON_SIZES[id]
      if (id === 'sound_ring_2x1') return this.customDefaultIconSizes.sound_ring ?? DEFAULT_ICON_SIZES.sound_ring ?? 20
      if (id === 'sound_vibrate_2x1') return this.customDefaultIconSizes.sound_vibrate ?? DEFAULT_ICON_SIZES.sound_vibrate ?? 20
      if (id === 'sound_mute_2x1') return this.customDefaultIconSizes.sound_mute ?? DEFAULT_ICON_SIZES.sound_mute ?? 20
      if (id === 'sound_ring_1x1' || id === 'sound_vibrate_1x1' || id === 'sound_mute_1x1') {
        return this.customDefaultIconSizes.sound ?? DEFAULT_ICON_SIZES.sound ?? 24
      }
      if (id === 'flashlight_on' || id === 'flashlight_off') {
        return this.customDefaultIconSizes.flashlight ?? DEFAULT_ICON_SIZES.flashlight ?? 32
      }
      return 24
    },
    getDefaultBgSize(id) {
      return this.customDefaultBgSizes[id] ?? DEFAULT_BG_SIZES[id] ?? 38
    },
    getIconSize(id) {
      if (this.iconSizeOverrides[id] !== undefined) {
        return this.iconSizeOverrides[id]
      }
      return this.getDefaultIconSize(id)
    },
    getBgSize(id) {
      if (this.bgSizeOverrides[id] !== undefined) {
        return this.bgSizeOverrides[id]
      }
      return this.getDefaultBgSize(id)
    },
    setIconSize(id, size) {
      const clamped = Math.max(8, Math.min(64, Math.round(size)))
      this.iconSizeOverrides[id] = clamped
      this.saveFineTuning()
    },
    setBgSize(id, size) {
      const clamped = Math.max(16, Math.min(100, Math.round(size)))
      this.bgSizeOverrides[id] = clamped
      this.saveFineTuning()
    },
    setGridScale(k) {
      this.gridScale = clampScale(k, GRID_SCALE_MIN, GRID_SCALE_MAX)
      this.saveFineTuning()
    },
    resetGridScale() {
      this.gridScale = 1
      this.saveFineTuning()
    },
    adjustCurrent(delta) {
      const targetId = this.selectedTarget
      if (!targetId) return
      if (this.selectedSubTarget === 'icon') {
        const cur = this.getIconSize(targetId)
        this.setIconSize(targetId, cur + delta)
      } else {
        const cur = this.getBgSize(targetId)
        this.setBgSize(targetId, cur + delta)
      }
    },
    resetItem(id) {
      const targetId = id || this.selectedTarget
      if (!targetId) return
      delete this.iconSizeOverrides[targetId]
      delete this.bgSizeOverrides[targetId]
      this.saveFineTuning()
    },
    resetAllOverrides() {
      this.iconSizeOverrides = {}
      this.bgSizeOverrides = {}
      this.saveFineTuning()
    },
    setAsDefault(targetId) {
      const id = targetId || this.selectedTarget
      if (!id) return
      // 将该图标当前调整后的尺寸替换为代码中的默认基准值
      const curIcon = this.getIconSize(id)
      DEFAULT_ICON_SIZES[id] = curIcon
      this.customDefaultIconSizes[id] = curIcon
      delete this.iconSizeOverrides[id]

      let curBg = undefined
      if (this.bgSizeOverrides[id] !== undefined || this.customDefaultBgSizes[id] !== undefined || DEFAULT_BG_SIZES[id] !== undefined) {
        curBg = this.getBgSize(id)
        DEFAULT_BG_SIZES[id] = curBg
        this.customDefaultBgSizes[id] = curBg
        delete this.bgSizeOverrides[id]
      }

      try {
        localStorage.setItem('aurora_cc_custom_defaults', JSON.stringify({
          icons: this.customDefaultIconSizes,
          bgs: this.customDefaultBgSizes
        }))
      } catch (e) {
        console.warn('Failed to save custom defaults:', e)
      }

      // 请求 Vite 后端中间件，物理更新 src/stores/controlStore.js 中的 DEFAULT_ICON_SIZES 写死默认值
      try {
        fetch('/__api/save-defaults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, iconSize: curIcon, bgSize: curBg })
        }).catch(() => {})
      } catch (e) {}

      this.saveFineTuning()
    },
    /* 保存所有微调到默认值并退出微调模式 */
    saveAllAndExit() {
      const itemsMap = {}

      // 合并 iconSizeOverrides
      for (const [id, size] of Object.entries(this.iconSizeOverrides)) {
        DEFAULT_ICON_SIZES[id] = size
        this.customDefaultIconSizes[id] = size
        if (!itemsMap[id]) itemsMap[id] = { id }
        itemsMap[id].iconSize = size
      }
      // 合并 bgSizeOverrides
      for (const [id, size] of Object.entries(this.bgSizeOverrides)) {
        DEFAULT_BG_SIZES[id] = size
        this.customDefaultBgSizes[id] = size
        if (!itemsMap[id]) itemsMap[id] = { id }
        itemsMap[id].bgSize = size
      }

      // 如果当前选中项有微调但没被记录，确保也一并处理
      const curId = this.selectedTarget
      if (curId) {
        if (this.iconSizeOverrides[curId] !== undefined) {
          if (!itemsMap[curId]) itemsMap[curId] = { id: curId }
          itemsMap[curId].iconSize = this.iconSizeOverrides[curId]
        }
        if (this.bgSizeOverrides[curId] !== undefined) {
          if (!itemsMap[curId]) itemsMap[curId] = { id: curId }
          itemsMap[curId].bgSize = this.bgSizeOverrides[curId]
        }
      }

      const items = Object.values(itemsMap)
      if (items.length > 0) {
        try {
          fetch('/__api/save-defaults', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          }).catch(() => {})
        } catch (e) {}
      }

      // 清空 overrides
      this.iconSizeOverrides = {}
      this.bgSizeOverrides = {}
      // 持久化
      try {
        localStorage.setItem('aurora_cc_custom_defaults', JSON.stringify({
          icons: this.customDefaultIconSizes,
          bgs: this.customDefaultBgSizes
        }))
      } catch (e) {
        console.warn('Failed to save custom defaults:', e)
      }
      this.saveFineTuning()
      // 退出微调模式
      this.fineTuningMode = false
    },
    saveFineTuning() {
      try {
        localStorage.setItem('aurora_cc_fine_tuning', JSON.stringify({
          icons: this.iconSizeOverrides,
          bgs: this.bgSizeOverrides,
          gridScale: this.gridScale
        }))
      } catch (e) {
        console.warn('Failed to save fine tuning overrides:', e)
      }
    },
    exportConfig() {
      return {
        defaultIconSizes: { ...this.customDefaultIconSizes },
        defaultBgSizes: { ...this.customDefaultBgSizes },
        iconSizes: { ...this.iconSizeOverrides },
        bgSizes: { ...this.bgSizeOverrides },
        gridScale: this.gridScale
      }
    }
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useControlStore, import.meta.hot))
}
