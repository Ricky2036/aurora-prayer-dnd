import { ref, computed, onMounted, onUnmounted } from 'vue'

/** 实时时钟：状态栏 / 锁屏 / 时钟 Widget 共用 */
export function useClock() {
  const now = ref(new Date())
  let timer = null

  onMounted(() => {
    timer = setInterval(() => { now.value = new Date() }, 1000)
  })
  onUnmounted(() => clearInterval(timer))

  const pad = (n) => String(n).padStart(2, '0')

  /** 状态栏用：9:41 */
  const timeShort = computed(() => `${now.value.getHours()}:${pad(now.value.getMinutes())}`)

  /** 锁屏用：时分秒针角度（时钟 Widget） */
  const hourDeg = computed(() => (now.value.getHours() % 12) * 30 + now.value.getMinutes() * 0.5)
  const minuteDeg = computed(() => now.value.getMinutes() * 6 + now.value.getSeconds() * 0.1)
  const secondDeg = computed(() => now.value.getSeconds() * 6)

  const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

  /** 锁屏用：8月2日 星期日 */
  const dateLong = computed(() =>
    `${now.value.getMonth() + 1}月${now.value.getDate()}日 ${WEEKDAYS[now.value.getDay()]}`
  )

  /** 日历用 */
  const today = computed(() => ({
    year: now.value.getFullYear(),
    month: now.value.getMonth(),
    date: now.value.getDate()
  }))

  return { now, timeShort, dateLong, hourDeg, minuteDeg, secondDeg, today }
}
