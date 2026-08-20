/**
 * 预置通知（演示用）。minutesAgo 相对打开页面时刻偏移，
 * 保证每次演示都显示「刚刚 / x分钟前」的真实感。
 * 数据源自 notificationcenter.tsx 的高频社交与工具应用场景。
 */
export function seedNotifications() {
  const now = Date.now()
  let id = 1
  const make = (appId, title, body, minutesAgo, iconType) => ({
    id: id++,
    appId,
    iconType,
    title,
    body,
    time: now - minutesAgo * 60000
  })

  return [
    make('whatsapp', 'WhatsApp', '周末有空聚聚吗？想带你去那家新餐厅。', 0, 'whatsapp'),
    make('facebook', 'Facebook', '你关注的"周末车友会"将于明天下午举行。', 12, 'facebook'),
    make('tiktok', 'TikTok', '@李四 刚刚发布了新视频，快来看看吧。', 18, 'tiktok'),
    make('spotify', 'Spotify', '您每周的新发现播放列表已更新。', 25, 'spotify'),
    make('gmail', 'Gmail', '团队例会纪要：会议记录及后续排期已整理完毕。', 35, 'gmail'),
    make('amazon', 'Amazon', '您的包裹已发货，预计明天送达。', 42, 'amazon'),
    make('snapchat', 'Snapchat', '小明 给你发送了一个 Snap！快来查看他在做什么。', 55, 'snapchat'),
    make('uber', 'Uber', '您的司机正在路上。预计3分钟后到达。', 60, 'uber'),
    make('google', 'Google', '今日当地热搜：2026年交互设计趋势报告发布。', 90, 'google'),
    make('pinterest', 'Pinterest', '探索属于你的生活美学与极简家居灵感。', 120, 'pinterest'),
    make('wechat', '微信', 'John: 最新的交互原型我发群里了，大家看看有没有问题。', 125, 'wechat'),
    make('instagram', 'Instagram', 'john_doe 刚刚赞了你的帖子：风景真不错。', 180, 'instagram'),
    make('x', 'X', '游戏已迎来重磅更新！更多设备支持，快来体验。', 210, 'x'),
    make('netflix', 'Netflix', '为您推荐《三体》：这部备受瞩目的科幻巨制已经上线。', 240, 'netflix'),
    make('telegram', 'Telegram', '群聊设置了新的隐私规则，请管理员及时更新配置。', 300, 'telegram'),
    make('youtube', 'YouTube', '你关注的极客影视刚刚发布了长达一小时的硬核评测。', 360, 'youtube'),
    make('weather', '天气预警', '当前城市发布大风蓝色预警，请注意出行安全，避免在高处逗留。', 480, 'weather'),
    make('system', '系统更新', '系统更新已准备就绪。版本 15.4.1 修复了已知的安全漏洞并提升了响应速度。', 600, 'system'),
    make('linkedin', 'LinkedIn', '恭喜王五晋升为高级产品经理。', 720, 'linkedin'),
    make('alipay', '支付宝', '您的蚂蚁森林有能量可收集，已有好友帮你浇水。', 1440, 'alipay')
  ]
}
