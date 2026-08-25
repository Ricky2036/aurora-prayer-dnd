import { defineStore } from 'pinia'

export const APP_NAMES = {
  zh: {
    phone: '电话',
    messages: '信息',
    safari: '浏览器',
    camera: '相机',
    weather: '天气',
    notes: '备忘录',
    files: '文件',
    voicememos: '语音备忘录',
    fitness: '健身',
    calculator: '计算器',
    theme: '主题',
    settings: '设置',
    calendar: '日历',
    photos: '照片',
    clock: '时钟',
    keynote: '演示',
    games: '游戏',
    tips: '提示',
    compass: '指南针'
  },
  en: {
    phone: 'Phone',
    messages: 'Messages',
    safari: 'Safari',
    camera: 'Camera',
    weather: 'Weather',
    notes: 'Notes',
    files: 'Files',
    voicememos: 'Voice Memos',
    fitness: 'Fitness',
    calculator: 'Calculator',
    theme: 'Themes',
    settings: 'Settings',
    calendar: 'Calendar',
    photos: 'Photos',
    clock: 'Clock',
    keynote: 'Keynote',
    games: 'Games',
    tips: 'Tips',
    compass: 'Compass'
  },
  bn: {
    phone: 'ফোন',
    messages: 'বার্তা',
    safari: 'সাফারি',
    camera: 'ক্যামেরা',
    weather: 'আবহাওয়া',
    notes: 'নোট',
    files: 'ফাইল',
    voicememos: 'ভয়েস মেমো',
    fitness: 'ফিটনেস',
    calculator: 'ক্যালকুলেটর',
    theme: 'থিম',
    settings: 'সেটিংস',
    calendar: 'ক্যালেন্ডার',
    photos: 'ছবি',
    clock: 'ঘড়ি',
    keynote: 'কিনোট',
    games: 'গেমস',
    tips: 'পরামর্শ',
    compass: 'কম্পাস'
  }
}

export const CATEGORIES_NAMES = {
  zh: {
    social: '社交与通信',
    productivity: '效率',
    creativity: '创意',
    utilities: '工具',
    searchResults: '搜索结果'
  },
  en: {
    social: 'Social & Communication',
    productivity: 'Productivity',
    creativity: 'Creativity',
    utilities: 'Utilities',
    searchResults: 'Search Results'
  },
  bn: {
    social: 'সামাজিক ও যোগাযোগ',
    productivity: 'উৎপাদনশীলতা',
    creativity: 'সৃজনশীলতা',
    utilities: 'সরঞ্জাম',
    searchResults: 'অনুসন্ধানের ফলাফল'
  }
}

export const MESSAGES = {
  zh: {
    // 智慧建议与桌面卡片
    weatherCity: '深圳',
    weatherCondition: '多云转晴',
    weatherHigh: '33',
    weatherLow: '26',
    prayerWidgetTitle1: '设置礼拜',
    prayerWidgetTitle2: '勿扰时段',
    prayerWidgetSub1: '礼拜前后自动进入',
    prayerWidgetSub2: '退出勿扰模式',
    prayerWidgetBtn: '立即设置',
    suggestionTitle: '智慧建议',

    // 灵动岛
    islandActiveSub: (name) => `${name}勿扰已开启，结束后自动退出`,

    // 5个礼拜
    prayers: {
      fajr: { name: '晨礼', full: '晨礼 Fajr' },
      dhuhr: { name: '晌礼', full: '晌礼 Dhuhr' },
      asr: { name: '晡礼', full: '晡礼 Asr' },
      maghrib: { name: '昏礼', full: '昏礼 Maghrib' },
      isha: { name: '宵礼', full: '宵礼 Isha' }
    },

    // 星期与重复
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    calWeekDays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    repeatEveryday: '每天',
    repeatWeekday: '工作日',
    repeatWeekend: '周末',
    repeatCustom: '自定义',

    // 设置主页
    settings: '设置',
    appleIdName: 'Apple 账户',
    appleIdSub: '已登录 · 云端备份与同步',
    wifi: '无线局域网',
    soundAndVibration: '声音与振动',
    displayAndBrightness: '显示与亮度',
    general: '通用',
    notifications: '通知',

    // 声音与振动
    soundRing: '铃声',
    soundVibrate: '振动',
    soundMute: '静音',
    dnd: '勿扰模式',
    dndScheduled: '定时开启',
    dndEnabled: '已开启',
    volumeSection: '音量调节',
    media: '媒体',
    ringtone: '铃声',
    notificationVolume: '通知',
    alarm: '闹钟',
    haptics: '触感反馈',
    hapticsOn: '开启',
    ringtoneSettings: '铃声设置',

    // 勿扰模式与礼拜模式
    dndDesc: '勿扰模式开启后，除允许的内容外，来电和提醒都将静音。',
    prayerDnd: '礼拜模式',
    prayerMode: '礼拜模式',
    prayerDndDesc: '开启后系统将在设定的时间自动开启、关闭勿扰模式。',
    allowDisturb: '允许打扰',
    allowCalls: '来电提醒',
    allowCallsSub: '所有人',
    allowApps: '应用提醒',
    allowAppsSub: '无',
    allowRepeatedCalls: '允许显示重复来电者',
    allowRepeatedCallsDesc: '相同号码在三分钟内再次来电将不会被静音。',

    // 礼拜模式
    prayerSlots: '礼拜时段',
    startTime: '开始时间',
    endTime: '结束时间',
    repeat: '重复',
    confirm: '完成',
    cancel: '取消',

    // 智能识别与AI自动接听
    autoEnableHeader: '智能识别',
    autoGeofenceTitle: '自动启用',
    autoGeofenceDesc: '进入、离开清真寺范围自动启用/退出勿扰模式。',
    aiAnswerHeader: 'AI 通话助理',
    aiAutoAnswerDesc: '礼拜中来电，指定联系人启用AI自动接听回复',
    aiAutoAnswerTitle: 'AI自动接听',
    aiDesignatedContacts: '选择联系人',
    aiContactsCount: '老婆、老板等3人',

    // 联系人选择
    searchContactsPlaceholder: '搜索姓名或电话号码',
    selectedCountLabel: (n) => `已选择 ${n} 人`,
    selectAll: '全选',
    clearAll: '清空',
    noContactsFound: '未找到匹配的联系人'
  },
  en: {
    // Widgets & Smart Suggestion
    weatherCity: 'Shenzhen',
    weatherCondition: 'Partly Cloudy',
    weatherHigh: '33',
    weatherLow: '26',
    prayerWidgetTitle1: 'Prayer Mode',
    prayerWidgetTitle2: 'Schedule',
    prayerWidgetSub1: 'Auto on or off',
    prayerWidgetSub2: 'on prayer times',
    prayerWidgetBtn: 'Set Up',
    suggestionTitle: 'Suggestions',

    // Dynamic Island
    islandActiveSub: (name) => `${name} DND is active · Auto exits`,

    // Prayers
    prayers: {
      fajr: { name: 'Fajr', full: 'Fajr 晨礼' },
      dhuhr: { name: 'Dhuhr', full: 'Dhuhr 晌礼' },
      asr: { name: 'Asr', full: 'Asr 晡礼' },
      maghrib: { name: 'Maghrib', full: 'Maghrib 昏礼' },
      isha: { name: 'Isha', full: 'Isha 宵礼' }
    },

    // Weekdays & Repeat
    weekDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    calWeekDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    repeatEveryday: 'Everyday',
    repeatWeekday: 'Weekdays',
    repeatWeekend: 'Weekends',
    repeatCustom: 'Custom',

    // Settings Main
    settings: 'Settings',
    appleIdName: 'Apple Account',
    appleIdSub: 'Signed in · Cloud Sync',
    wifi: 'Wi-Fi',
    soundAndVibration: 'Sound & Vibration',
    displayAndBrightness: 'Display & Brightness',
    general: 'General',
    notifications: 'Notifications',

    // Sound & Vibration
    soundRing: 'Ring',
    soundVibrate: 'Vibrate',
    soundMute: 'Mute',
    dnd: 'Do Not Disturb',
    dndScheduled: 'Scheduled',
    dndEnabled: 'On',
    volumeSection: 'Volume',
    media: 'Media',
    ringtone: 'Ringtone',
    notificationVolume: 'Notifications',
    alarm: 'Alarm',
    haptics: 'Haptic Feedback',
    hapticsOn: 'On',
    ringtoneSettings: 'Ringtone Settings',

    // DND
    dndDesc: 'When Do Not Disturb is enabled, incoming calls and alerts will be silenced except for allowed items.',
    prayerDnd: 'Prayer Mode',
    prayerMode: 'Prayer Mode',
    prayerDndDesc: 'Automatically turn Do Not Disturb on and off at prayer times.',
    allowDisturb: 'ALLOW NOTIFICATIONS',
    allowCalls: 'Allow Calls From',
    allowCallsSub: 'Everyone',
    allowApps: 'Allowed Apps',
    allowAppsSub: 'None',
    allowRepeatedCalls: 'Repeated Calls',
    allowRepeatedCallsDesc: 'A second call from the same person within three minutes will not be silenced.',

    // Prayer Settings
    prayerSlots: 'PRAYER SLOTS',
    startTime: 'Start Time',
    endTime: 'End Time',
    repeat: 'Repeat',
    confirm: 'Done',
    cancel: 'Cancel',

    // New features: Auto-Enable & AI Auto-Answer
    autoEnableHeader: 'SMART RECOGNITION',
    autoGeofenceTitle: 'Auto-Enable',
    autoGeofenceDesc: 'Enable/exit DND when entering or leaving mosque area.',
    aiAnswerHeader: 'AI CALL ASSISTANT',
    aiAutoAnswerDesc: 'Auto-answer calls from selected contacts during prayer',
    aiAutoAnswerTitle: 'AI Auto-Answer',
    aiDesignatedContacts: 'Select Contacts',
    aiContactsCount: 'Wife, Boss & 1 other',

    // Contacts
    searchContactsPlaceholder: 'Search name or phone number',
    selectedCountLabel: (n) => `${n} selected`,
    selectAll: 'Select All',
    clearAll: 'Clear',
    noContactsFound: 'No contacts found'
  },
  bn: {
    // বাংলা (Bengali) - 精简凝练，地道自然
    // Widgets & Smart Suggestion
    weatherCity: 'শেনজেন',
    weatherCondition: 'মেঘলা ও রোদ',
    weatherHigh: '৩৩',
    weatherLow: '২৬',
    prayerWidgetTitle1: 'নামাজ মোড',
    prayerWidgetTitle2: 'সময়সূচী',
    prayerWidgetSub1: 'নামাজে স্বয়ংক্রিয়',
    prayerWidgetSub2: 'নীরব মোড',
    prayerWidgetBtn: 'সেট করুন',
    suggestionTitle: 'পরামর্শ',

    // Dynamic Island
    islandActiveSub: (name) => `${name} ডিএনডি সক্রিয় · অটো এক্সিট`,

    // Prayers
    prayers: {
      fajr: { name: 'ফজর', full: 'ফজর Fajr' },
      dhuhr: { name: 'যোহর', full: 'যোহর Dhuhr' },
      asr: { name: 'আসর', full: 'আসর Asr' },
      maghrib: { name: 'মাগরিব', full: 'মাগরিব Maghrib' },
      isha: { name: 'ইশা', full: 'ইশা Isha' }
    },

    // Weekdays & Repeat
    weekDays: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'],
    calWeekDays: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'],
    repeatEveryday: 'প্রতিদিন',
    repeatWeekday: 'কার্যদিবস',
    repeatWeekend: 'ছুটির দিন',
    repeatCustom: 'কাস্টম',

    // Settings Main
    settings: 'সেটিংস',
    appleIdName: 'অ্যাপল অ্যাকাউন্ট',
    appleIdSub: 'সাইন ইন করা আছে',
    wifi: 'ওয়াই-ফাই',
    soundAndVibration: 'শব্দ ও কম্পন',
    displayAndBrightness: 'ডিসপ্লে ও উজ্জ্বলতা',
    general: 'সাধারণ',
    notifications: 'বিজ্ঞপ্তি',

    // Sound & Vibration
    soundRing: 'রিং',
    soundVibrate: 'কম্পন',
    soundMute: 'নীরব',
    dnd: 'বিরক্ত করবেন না',
    dndScheduled: 'নির্ধারিত',
    dndEnabled: 'চালু',
    volumeSection: 'ভলিউম',
    media: 'মিডিয়া',
    ringtone: 'রিংটোন',
    notificationVolume: 'বিজ্ঞপ্তি',
    alarm: 'অ্যালার্ম',
    haptics: 'স্পর্শ প্রতিক্রিয়া',
    hapticsOn: 'চালু',
    ringtoneSettings: 'রিংটোন সেটিংস',

    // DND
    dndDesc: 'বিরক্ত করবেন না মোড চালু থাকলে অনুমোদিত আইটেম ছাড়া সব কল ও বিজ্ঞপ্তি নীরব থাকবে।',
    prayerDnd: 'নামাজ মোড',
    prayerMode: 'নামাজ মোড',
    prayerDndDesc: 'নামাজের সময় স্বয়ংক্রিয়ভাবে ডিএনডি চালু ও বন্ধ হবে।',
    allowDisturb: 'বিজ্ঞপ্তির অনুমতি',
    allowCalls: 'কলের অনুমতি',
    allowCallsSub: 'সবাই',
    allowApps: 'অনুমোদিত অ্যাপ',
    allowAppsSub: 'নেই',
    allowRepeatedCalls: 'পুনরাবৃত্ত কলার',
    allowRepeatedCallsDesc: 'তিন মিনিটের মধ্যে একই ব্যক্তি আবার কল করলে রিং বাজবে।',

    // Prayer Settings
    prayerSlots: 'নামাজের সময়সূচী',
    startTime: 'শুরুর সময়',
    endTime: 'শেষের সময়',
    repeat: 'পুনরাবৃত্তি',
    confirm: 'সম্পন্ন',
    cancel: 'বাতিল',

    // New features: Auto-Enable & AI Auto-Answer
    autoEnableHeader: 'স্মার্ট সনাক্তকরণ',
    autoGeofenceTitle: 'স্বয়ংক্রিয় চালু',
    autoGeofenceDesc: 'মসজিদে প্রবেশ বা প্রস্থান করলে স্বয়ংক্রিয়ভাবে ডিএনডি চালু/বন্ধ হবে।',
    aiAnswerHeader: 'এআই কল সহকারী',
    aiAutoAnswerDesc: 'নামাজের সময় নির্দিষ্ট পরিচিতিদের কলে এআই স্বয়ংক্রিয় উত্তর দেবে',
    aiAutoAnswerTitle: 'এআই স্বয়ংক্রিয় উত্তর',
    aiDesignatedContacts: 'পরিচিতি নির্বাচন',
    aiContactsCount: 'স্ত্রী, বসসহ ৩ জন',

    // Contacts
    searchContactsPlaceholder: 'নাম বা ফোন নম্বর খুঁজুন',
    selectedCountLabel: (n) => `${n} জন নির্বাচিত`,
    selectAll: 'সব নির্বাচন',
    clearAll: 'মুছুন',
    noContactsFound: 'কোনো পরিচিতি পাওয়া যায়নি'
  }
}

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
