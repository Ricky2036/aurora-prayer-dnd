/**
 * 控制中心网格布局引擎单元测试。
 * packLayout 曾存在死循环：w > 4 或 w 为 NaN 时，内层 `c <= 4 - w` 零次执行，
 * 外层 `for (let r = 0; !placed; r++)` 无限自增并每轮分配数组 → 页面卡死。
 * 这些用例同时是回归防线：任何一项挂起即说明防御被破坏。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { packLayout, isOverlapping } from '../src/components/system/cc/ccLayout.js'

const mk = (id, w, h) => ({ id, type: 'toggle', w, h })

test('正常 2x1 / 1x1 混排结果稳定，返回结构含 r/c', () => {
  const out = packLayout([mk('a', 2, 1), mk('b', 1, 1), mk('c', 1, 1), mk('d', 2, 1)])
  assert.equal(out.length, 4)
  assert.deepEqual(out.map((i) => [i.r, i.c]), [[0, 0], [0, 2], [0, 3], [1, 0]])
  assert.equal(out[0].id, 'a')
  assert.equal(out[0].type, 'toggle') // 原始字段保留
})

test('w=5（超宽）不再死循环，钳到 4 且一定落位', () => {
  const out = packLayout([mk('a', 5, 1)])
  assert.equal(out.length, 1)
  assert.equal(out[0].w, 4)
  assert.deepEqual([out[0].r, out[0].c], [0, 0])
})

test('w=NaN / undefined 不再死循环，钳到 1', () => {
  const out = packLayout([mk('a', NaN, 1), mk('b', undefined, 1)])
  assert.equal(out.length, 2)
  assert.equal(out[0].w, 1)
  assert.equal(out[1].w, 1)
  assert.deepEqual(out.map((i) => [i.r, i.c]), [[0, 0], [0, 1]])
})

test('w=0 / 负数钳到 1，后续卡片不再叠在同一格', () => {
  const out = packLayout([mk('a', 0, 1), mk('b', -2, 1), mk('c', 1, 1)])
  assert.deepEqual(out.map((i) => [i.r, i.c]), [[0, 0], [0, 1], [0, 2]])
})

test('h=NaN 钳到 1；h 超限钳到 128', () => {
  const out = packLayout([mk('a', 1, NaN), mk('b', 1, 1e9)])
  assert.equal(out[0].h, 1)
  assert.equal(out[1].h, 128)
})

test('空数组 / 非法入参不抛错，空项被跳过', () => {
  assert.deepEqual(packLayout([]), [])
  assert.deepEqual(packLayout(null), [])
  assert.deepEqual(packLayout(undefined), [])
  // null 项无 id，硬排会往网格写 undefined 破坏 :key，故跳过而非排布。
  // 注：防御前 packLayout([null]) 会死循环（{...null} 展开为 {}，w 为 undefined → 4-w 是 NaN）
  assert.deepEqual(packLayout([null, undefined]), [])
})

test('排布后任意两卡片互不重叠（含非法 w/h 输入）', () => {
  const out = packLayout([
    mk('a', 2, 1), mk('b', NaN, 2), mk('c', 0, 1), mk('d', 9, 1), mk('e', 1, 1)
  ])
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      assert.equal(isOverlapping(out[i], out[j]), false, `${out[i].id} 与 ${out[j].id} 重叠`)
    }
  }
})

test('单行最多 4 列，c + w 不越界', () => {
  const out = packLayout(Array.from({ length: 8 }, (_, i) => mk('i' + i, 1, 1)))
  assert.equal(out.length, 8)
  for (const it of out) assert.ok(it.c >= 0 && it.c + it.w <= 4)
})

test('输出数量恒等于输入数量（防御不会丢卡片）', () => {
  const items = [mk('a', 2, 2), mk('b', 7, 1), mk('c', NaN, NaN), mk('d', 1, 1)]
  assert.equal(packLayout(items).length, items.length)
})
