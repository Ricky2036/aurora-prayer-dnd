import { ref, computed, shallowRef, onMounted, onUnmounted } from 'vue'
import { useI18nStore } from '../stores/i18nStore'

/** 实时时钟：状态栏 / 锁屏 / 时钟 Widget 共用。
 *
 * 模块级单例设计：所有 useClock() 消费者共享同一个 now ref 与同一个 interval
 * （引用计数，最后一个消费者卸载时才 clear）。
 * AppIcon 在桌面 / Dock / 资源库被渲染 30~60 次，若每实例各起一个 setInterval，
 * 会产生几十个定时器与几十条重复的 computed 链。
 */

const pad = (n) => String(n).padStart(2, '0')
const dayKeyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const todayOf = (d) => ({ year: d.getFullYear(), month: d.getMonth(), date: d.getDate() })

/* ---- 单例状态 ---- */
const now = ref(new Date())

/* 日期粒度单独一个 shallowRef：只在跨天时赋新值。
   若用 computed(now)，日历图标会因 now 每秒变化而每秒重算。 */
const today = shallowRef(todayOf(now.value))
let todayKey = dayKeyOf(now.value)

let timer = null
let refCount = 0

/* ---- 共享 computed：只有被真正访问到的才会重算 ---- */
const timeShort = computed(() => `${now.value.getHours()}:${pad(now.value.getMinutes())}`)

/** 锁屏用：时分秒针角度（时钟 Widget） */
const hourDeg = computed(() => (now.value.getHours() % 12) * 30 + now.value.getMinutes() * 0.5)
const minuteDeg = computed(() => now.value.getMinutes() * 6 + now.value.getSeconds() * 0.1)
const secondDeg = computed(() => now.value.getSeconds() * 6)

/** 锁屏用：9月6日 星期日 / September 6 Sunday / ৬ সেপ্টেম্বর রবিবার */
const dateLong = computed(() => {
  const i18n = useI18nStore()
  const d = now.value
  const monthName = i18n.monthNames[d.getMonth()] || d.getMonth() + 1
  return `${i18n.t('monthDay')(monthName, d.getDate())} ${i18n.longWeekDays[d.getDay()] || ''}`.trim()
})

export function useClock() {
  onMounted(() => {
    refCount++
    if (timer === null) {
      timer = setInterval(() => {
        const d = new Date()
        now.value = d
        const key = dayKeyOf(d)
        if (key !== todayKey) {
          todayKey = key
          today.value = todayOf(d)
        }
      }, 1000)
    }
  })

  onUnmounted(() => {
    refCount--
    if (refCount <= 0 && timer !== null) {
      clearInterval(timer)
      timer = null
      refCount = 0
    }
  })

  return { now, timeShort, dateLong, hourDeg, minuteDeg, secondDeg, today }
}
