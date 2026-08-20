<script setup>
import { computed, ref } from 'vue'

/**
 * 日历：真实当月月视图（今天红圆高亮、可选中、预置事件圆点）。
 * 底部显示选中日的事件列表。
 */
const props = defineProps({ app: Object })

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth()) // 0-based
const selected = ref(now.getDate())

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

/** 当月网格：42 格（6×7），含前后月补齐 */
const days = computed(() => {
  const first = new Date(year.value, month.value, 1)
  // 周一为首列：getDay() 0=周日 → 偏移 (day+6)%7
  const offset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
  const daysInPrev = new Date(year.value, month.value, 0).getDate()
  const cells = []
  for (let i = 0; i < 42; i++) {
    const dayNum = i - offset + 1
    if (dayNum < 1) {
      cells.push({ num: daysInPrev + dayNum, current: false })
    } else if (dayNum > daysInMonth) {
      cells.push({ num: dayNum - daysInMonth, current: false })
    } else {
      cells.push({ num: dayNum, current: true })
    }
  }
  return cells
})

const isToday = (d) =>
  d.current && d.num === now.getDate() && month.value === now.getMonth() && year.value === now.getFullYear()

/** 预置事件（key = 日期） */
const EVENTS = {
  3: [{ title: '晨会', time: '09:30', color: '#0A84FF' }],
  5: [{ title: '季度产品评审', time: '15:00', color: '#FF3B30' }, { title: '健身房', time: '19:00', color: '#34C759' }],
  8: [{ title: '设计走查', time: '14:00', color: '#FF9500' }],
  12: [{ title: '版本发布', time: '10:00', color: '#AF52DE' }],
  15: [{ title: '月度复盘', time: '16:00', color: '#0A84FF' }],
  20: [{ title: '团建 · 大鹏所城', time: '全天', color: '#34C759' }],
  26: [{ title: '需求评审', time: '11:00', color: '#FF9500' }]
}

const monthTitle = computed(() => `${year.value}年${month.value + 1}月`)

function prevMonth() {
  if (month.value === 0) { year.value--; month.value = 11 } else month.value--
  selected.value = 1
}
function nextMonth() {
  if (month.value === 11) { year.value++; month.value = 0 } else month.value++
  selected.value = 1
}
function backToday() {
  year.value = now.getFullYear()
  month.value = now.getMonth()
  selected.value = now.getDate()
}

const selectedEvents = computed(() =>
  month.value === now.getMonth() && year.value === now.getFullYear()
    ? EVENTS[selected.value] || []
    : []
)
</script>

<template>
  <div class="calendar-app">
    <div class="cal-header">
      <div>
        <div class="cal-year">{{ year }}年</div>
        <div class="cal-month">{{ month + 1 }}月</div>
      </div>
      <div class="cal-header-actions">
        <button class="today-btn" @click="backToday">今天</button>
        <button class="nav-btn" @click="prevMonth">
          <svg width="9" height="14" viewBox="0 0 9 14"><path d="M8 1L2 7l6 6" fill="none" stroke="#FF3B30" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="nav-btn" @click="nextMonth">
          <svg width="9" height="14" viewBox="0 0 9 14"><path d="M1 1l6 6-6 6" fill="none" stroke="#FF3B30" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>

    <div class="weekday-row">
      <span v-for="w in WEEKDAYS" :key="w" class="weekday">{{ w }}</span>
    </div>

    <div class="month-grid">
      <button
        v-for="(d, i) in days"
        :key="i"
        class="day-cell"
        :class="{
          other: !d.current,
          today: isToday(d),
          selected: d.current && d.num === selected && !isToday(d)
        }"
        @click="d.current && (selected = d.num)"
      >
        <span class="day-num">{{ d.num }}</span>
        <span v-if="d.current && month === now.getMonth() && year === now.getFullYear() && EVENTS[d.num]" class="day-dots">
          <i v-for="(e, j) in EVENTS[d.num].slice(0, 2)" :key="j" :style="{ background: e.color }"></i>
        </span>
      </button>
    </div>

    <!-- 选中日事件 -->
    <div class="event-panel">
      <div class="event-panel-title">{{ month + 1 }}月{{ selected }}日</div>
      <div v-if="selectedEvents.length" class="event-list">
        <div v-for="(e, i) in selectedEvents" :key="i" class="event-item">
          <span class="event-dot" :style="{ background: e.color }"></span>
          <span class="event-time">{{ e.time }}</span>
          <span class="event-title">{{ e.title }}</span>
        </div>
      </div>
      <div v-else class="event-empty">没有日程</div>
    </div>
  </div>
</template>

<style scoped>
.calendar-app {
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.cal-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: calc(var(--safe-top) + 14px) 18px 8px;
  flex: none;
}
.cal-year {
  font: 600 15px/1.2 var(--font-stack);
  color: var(--ios-red);
}
.cal-month {
  font: 700 32px/1.15 var(--font-stack);
  color: var(--label);
}
.cal-header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}
.today-btn {
  color: var(--ios-red);
  font: var(--text-body);
}
.nav-btn { display: flex; padding: 6px; }

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 6px 10px 4px;
  flex: none;
}
.weekday {
  text-align: center;
  font: 600 12px/1 var(--font-stack);
  color: var(--label-secondary);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 0 10px;
  flex: none;
}
.day-cell {
  position: relative;
  height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 6px;
}
.day-num {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font: 400 17px/1 var(--font-stack);
  color: var(--label);
  font-variant-numeric: tabular-nums;
}
.day-cell.other .day-num { color: var(--label-tertiary); }
.day-cell.today .day-num {
  background: var(--ios-red);
  color: #fff;
  font-weight: 600;
}
.day-cell.selected .day-num {
  background: #D1D1D6;
  font-weight: 500;
}
.day-dots {
  display: flex;
  gap: 3px;
  margin-top: 2px;
  height: 5px;
}
.day-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.event-panel {
  flex: 1;
  margin-top: 8px;
  border-top: 0.5px solid rgba(60, 60, 67, 0.12);
  padding: 12px 18px;
  background: var(--bg-grouped);
  min-height: 0;
}
.event-panel-title {
  font: var(--text-headline);
  color: var(--label);
  margin-bottom: 10px;
}
.event-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border-radius: 10px;
  padding: 11px 13px;
  margin-bottom: 8px;
}
.event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.event-time {
  font: var(--text-subhead);
  color: var(--label-secondary);
  min-width: 46px;
  font-variant-numeric: tabular-nums;
}
.event-title {
  font: var(--text-subhead);
  color: var(--label);
  font-weight: 500;
}
.event-empty {
  font: var(--text-subhead);
  color: var(--label-tertiary);
  text-align: center;
  margin-top: 24px;
}
</style>
