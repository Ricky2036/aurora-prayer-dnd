/**
 * 预置通知（演示用）。minutesAgo 相对打开页面时刻偏移，
 * 保证每次演示都显示「刚刚 / x分钟前」的真实感。
 * 数据源自 notificationcenter.tsx 的高频社交与工具应用场景。
 *
 * 只存 appId 与时间偏移，标题正文在渲染时按当前语言取
 * （i18nStore.notifTitle / notifBody），这样切语言时已收到的通知也会跟着变。
 */
export function seedNotifications() {
  const now = Date.now()
  let id = 1
  const make = (appId, minutesAgo, iconType) => ({
    id: id++,
    appId,
    iconType: iconType || appId,
    minutesAgo,
    time: now - minutesAgo * 60000
  })

  return [
    make('whatsapp', 0),
    make('facebook', 12),
    make('tiktok', 18),
    make('spotify', 25),
    make('gmail', 35),
    make('amazon', 42),
    make('snapchat', 55),
    make('uber', 60),
    make('google', 90),
    make('pinterest', 120),
    make('wechat', 125),
    make('instagram', 180),
    make('x', 210),
    make('netflix', 240),
    make('telegram', 300),
    make('youtube', 360),
    make('weather', 480),
    make('system', 600),
    make('linkedin', 720),
    make('alipay', 1440)
  ]
}
