/**
 * 应用注册表 —— 原型的「单一事实来源」。
 * 新增一个应用 = 在这里加一条注册项（+ 深度应用再补一个组件文件），
 * 桌面 / Dock / 应用抽屉 / 搜索自动生效。
 *
 * depth: 'core' 有二级功能页；'placeholder' 打开为占位页
 * special: 'calendar' | 'clock' | 'photos' 图标需自绘（非渐变+glyph 模式）
 */
export const APPS = [
  {
    id: 'phone',
    name: '电话',
    depth: 'core',
    heroBackground: 'linear-gradient(180deg,#20D759 0%,#12B83F 100%)',
    image: '/icons/phone.png',
    dock: true
  },
  {
    id: 'messages',
    name: '信息',
    depth: 'core',
    heroBackground: 'linear-gradient(180deg,#28DF61 0%,#13B943 100%)',
    image: '/icons/messages.png',
    dock: true
  },
  {
    id: 'safari',
    name: '浏览器',
    depth: 'placeholder',
    heroBackground: 'linear-gradient(180deg,#22B8F5 0%,#0A78F0 100%)',
    image: '/icons/safari.png',
    dock: true
  },
  {
    id: 'camera',
    name: '相机',
    depth: 'core',
    heroBackground: 'linear-gradient(180deg,#F0F0F2 0%,#D6D6DA 100%)',
    image: '/icons/camera.png',
    dock: true
  },
  {
    id: 'weather',
    name: '天气',
    depth: 'placeholder',
    heroBackground: 'linear-gradient(180deg,#38ADF5 0%,#1675D8 100%)',
    image: '/icons/weather.png',
    page: 0
  },
  {
    id: 'notes',
    name: '备忘录',
    depth: 'placeholder',
    heroBackground: 'linear-gradient(180deg,#FFD33A 0%,#F4AA00 100%)',
    image: '/icons/notes.png',
    page: 0
  },
  {
    id: 'files',
    name: '文件',
    depth: 'placeholder',
    heroBackground: '#F4F4F6',
    image: '/icons/files.png',
    page: 0
  },
  {
    id: 'voicememos',
    name: '语音备忘录',
    depth: 'placeholder',
    heroBackground: 'linear-gradient(180deg,#F65A62 0%,#E82636 100%)',
    image: '/icons/voicememos.png',
    page: 0
  },
  {
    id: 'fitness',
    name: '健身',
    depth: 'placeholder',
    heroBackground: 'linear-gradient(180deg,#F8C61B 0%,#EFA500 100%)',
    image: '/icons/fitness.png',
    page: 0
  },
  {
    id: 'calculator',
    name: '计算器',
    depth: 'placeholder',
    heroBackground: '#ECECEF',
    image: '/icons/calculator.png',
    page: 0
  },
  {
    id: 'theme',
    name: '主题',
    depth: 'placeholder',
    heroBackground: 'linear-gradient(135deg,#FF4272 0%,#FFB44A 45%,#19B9E5 100%)',
    image: '/icons/theme.png',
    page: 0
  },
  {
    id: 'settings',
    name: '设置',
    depth: 'core',
    heroBackground: 'linear-gradient(145deg,#AEB3BC 0%,#6F7784 100%)',
    image: '/icons/settings.png',
    page: 0
  },
  {
    id: 'calendar',
    name: '日历',
    depth: 'core',
    heroBackground: '#F7F7F8',
    special: 'calendar',
    page: 0
  },
  {
    id: 'photos',
    name: '照片',
    depth: 'placeholder',
    heroBackground: '#F5F5F7',
    image: '/icons/photos.png',
    page: 0
  },
  {
    id: 'clock',
    name: '时钟',
    depth: 'placeholder',
    heroBackground: '#1C1C1E',
    special: 'clock',
    page: 0
  },
  {
    id: 'keynote',
    name: '演示',
    depth: 'placeholder',
    heroBackground: '#F5F5F7',
    image: '/icons/keynote.png',
    page: 0
  },
  {
    id: 'games',
    name: '游戏',
    depth: 'placeholder',
    heroBackground: 'linear-gradient(180deg,#F89242 0%,#EF5A17 100%)',
    image: '/icons/games.png',
    page: 0
  },
  {
    id: 'tips',
    name: '提示',
    depth: 'placeholder',
    heroBackground: 'linear-gradient(180deg,#FFD43B 0%,#F2AC00 100%)',
    image: '/icons/tips.png',
    page: 0
  },
  {
    id: 'compass',
    name: '指南针',
    depth: 'placeholder',
    heroBackground: '#F5F5F7',
    image: '/icons/compass.png',
    page: 0
  }
]

export const getApp = (id) => APPS.find((a) => a.id === id)

/** 桌面网格图标（非 Dock），按注册顺序 */
export const gridApps = APPS.filter((a) => !a.dock)

/** Dock 图标 */
export const dockApps = APPS.filter((a) => a.dock)
