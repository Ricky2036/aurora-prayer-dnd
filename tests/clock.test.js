import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateTimeUntilAlarm,
  formatStopwatchTime,
  formatTimerSeconds
} from '../src/stores/clockStore.js'

test('calculateTimeUntilAlarm: 同一天下午响铃', () => {
  // 当前时间：周二 10:00，闹钟 19:35（每天）
  const fakeNow = new Date(2026, 8, 8, 10, 0, 0) // 10:00
  const alarm = {
    time: '19:35',
    days: [0, 1, 2, 3, 4, 5, 6]
  }
  const result = calculateTimeUntilAlarm(alarm, fakeNow)
  // 19:35 - 10:00 = 9小时35分钟
  assert.equal(result, '9小时35分钟后响铃')
})

test('calculateTimeUntilAlarm: 隔天响铃', () => {
  // 当前时间：周二 20:00，闹钟 07:10（周一至周五）
  const fakeNow = new Date(2026, 8, 8, 20, 0, 0)
  const alarm = {
    time: '07:10',
    days: [1, 2, 3, 4, 5]
  }
  const result = calculateTimeUntilAlarm(alarm, fakeNow)
  // 20:00 到第二天 07:10 = 4小时 + 7小时10分 = 11小时10分钟
  assert.equal(result, '11小时10分钟后响铃')
})

test('calculateTimeUntilAlarm: 跨周末响铃', () => {
  // 当前时间：周五 20:00，闹钟 07:10（周一至周五）
  // 2026-09-11 是周五
  const fakeNow = new Date(2026, 8, 11, 20, 0, 0)
  const alarm = {
    time: '07:10',
    days: [1, 2, 3, 4, 5]
  }
  const result = calculateTimeUntilAlarm(alarm, fakeNow)
  // 周五20:00 -> 周六20:00(24h) -> 周日20:00(48h) -> 周一07:10(11h10m) = 59小时10分钟
  assert.equal(result, '59小时10分钟后响铃')
})

test('formatStopwatchTime: 格式化毫秒', () => {
  assert.equal(formatStopwatchTime(0), '00:00.00')
  assert.equal(formatStopwatchTime(1640), '00:01.64')
  assert.equal(formatStopwatchTime(65430), '01:05.43')
})

test('formatTimerSeconds: 格式化时分秒', () => {
  assert.equal(formatTimerSeconds(300, true), '00:05:00')
  assert.equal(formatTimerSeconds(299, true), '00:04:59')
  assert.equal(formatTimerSeconds(3665, true), '01:01:05')
  assert.equal(formatTimerSeconds(45, false), '00:45')
})
