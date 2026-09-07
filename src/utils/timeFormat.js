/**
 * 相对时间：刚刚 / x分钟前 / x小时前 / 昨天 / x天前
 *
 * 第二个参数传 i18nStore 的 t（也就是 (key) => string | fn）。
 * 不传就退回中文，只为兼容历史调用 —— 新代码请一律传 t。
 */
export function formatRelativeTime(ts, t) {
  const FALLBACK = {
    justNow: () => '刚刚',
    minutesAgo: (n) => `${n}分钟前`,
    hoursAgo: (n) => `${n}小时前`,
    yesterday: '昨天',
    daysAgo: (n) => `${n}天前`
  }
  const tr = (key) => (typeof t === 'function' ? t(key) : FALLBACK[key])
  const call = (key, arg) => {
    const v = tr(key)
    return typeof v === 'function' ? v(arg) : v
  }

  const diff = Date.now() - ts
  const m = Math.floor(Math.abs(diff) / 60000)
  if (m < 1) return call('justNow')
  if (m < 60) return call('minutesAgo', m)
  const h = Math.floor(m / 60)
  if (h < 24) return call('hoursAgo', h)
  const d = Math.floor(h / 24)
  if (d === 1) return call('yesterday')
  return call('daysAgo', d)
}
