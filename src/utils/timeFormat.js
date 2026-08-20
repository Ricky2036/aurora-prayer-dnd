/** 相对时间：刚刚 / x分钟前 / x小时前 / 昨天 / x天前 */
export function formatRelativeTime(ts) {
  const diff = Date.now() - ts
  if (diff < 0) return '刚刚'
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const d = Math.floor(h / 24)
  if (d === 1) return '昨天'
  return `${d}天前`
}
