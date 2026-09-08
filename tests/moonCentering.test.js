/**
 * 勿扰（moon）图标视觉对齐回归测试。
 *
 * 历史翻车链：
 *   - 原版 `viewBox="0 0 32 32"` —— bbox 居中（边距约 6.3px 均衡），但 path 缺口在右上、
 *     质量在左下，肉眼仍能看出月亮「缩在左下」。
 *   - 我曾改成 `-2.27 2.16 32 32` 做质心居中 —— 数学上质心确实落在格子中心了，
 *     但 bbox 被反向推到右上（边距 9.27 vs 3.75），月亮反而跑到圆顶。
 *   - Ricky 反馈：「反而更糟，月亮被推到顶部」。
 *
 * 教训（已写进 lucide.js 注释）：对这种带缺口的弧形，**bbox 居中比质心居中更接近
 * 视觉居中**。质心居中只对左右/上下质量严格对称的图形才适用 —— 我把这条经验
 * 用错了地方，浪费了一轮。
 *
 * 这个测试锁死硬约束：**moon path 的 bbox 中心必须落在 viewBox 中心 ±1 单位内**。
 * 任何把 viewBox 改成「质心居中」之类偏移的提交都会挂掉。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LUCIDE_SRC = readFileSync(join(__dirname, '../src/assets/icons/lucide.js'), 'utf8')

/** 把三次贝塞尔曲线展平成多边形采样点 */
function flattenPath(d, N = 60) {
  const tokens = d.match(/[MCZ]|-?\d+\.?\d*/g)
  const polygons = []
  let cur = null, i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (t === 'M') { cur = [[+tokens[i + 1], +tokens[i + 2]]]; i += 3 }
    else if (t === 'C') {
      while (i < tokens.length && tokens[i] === 'C') {
        const p0 = cur[cur.length - 1]
        const p1 = [+tokens[i + 1], +tokens[i + 2]]
        const p2 = [+tokens[i + 3], +tokens[i + 4]]
        const p3 = [+tokens[i + 5], +tokens[i + 6]]
        for (let s = 1; s <= N; s++) {
          const u = s / N, v = 1 - u
          cur.push([
            v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
            v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]
          ])
        }
        i += 7
      }
    } else if (t === 'Z') { polygons.push(cur); cur = null; i += 1 }
    else { i += 1 }
  }
  return polygons
}

/** 路径包围盒（不依赖浏览器） */
function pathBBox(polys) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9
  for (const poly of polys) for (const [x, y] of poly) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

function parseViewBox(svg) {
  const m = svg.match(/viewBox="([\d.\- ]+)"/)
  const [vx, vy, vw, vh] = m[1].trim().split(/\s+/).map(Number)
  return { vx, vy, vw, vh }
}

test('moon 存在且 viewBox 是 32x32 方形', () => {
  const match = LUCIDE_SRC.match(/const moon = `(<svg[\s\S]*?)`/)
  assert.ok(match, 'moon 常量不存在')
  const { vw, vh } = parseViewBox(match[1])
  assert.equal(vw, 32, 'moon viewBox 宽度必须为 32')
  assert.equal(vh, 32, 'moon viewBox 高度必须为 32')
})

test('moon path 必须以 M 开头并以 Z 闭合', () => {
  const match = LUCIDE_SRC.match(/const moon = `(<svg[\s\S]*?)`/)
  const d = match[1].match(/d="([^"]+)"/)[1]
  assert.ok(d.startsWith('M'), 'moon path 必须以 M 开头')
  assert.ok(d.endsWith('Z'), 'moon path 必须以 Z 闭合')
})

test('★ moon bbox 中心必须落在 viewBox 几何中心 ±1 单位内（视觉对齐硬约束）', () => {
  const match = LUCIDE_SRC.match(/const moon = `(<svg[\s\S]*?)`/)
  const svg = match[1]
  const d = svg.match(/d="([^"]+)"/)[1]
  const { vx, vy, vw, vh } = parseViewBox(svg)
  const bb = pathBBox(flattenPath(d))

  const bboxCx = (bb.minX + bb.maxX) / 2 - vx
  const bboxCy = (bb.minY + bb.maxY) / 2 - vy
  const centerX = vw / 2
  const centerY = vh / 2
  const dx = Math.abs(bboxCx - centerX)
  const dy = Math.abs(bboxCy - centerY)
  const TOL = 1.0

  assert.ok(
    dx < TOL && dy < TOL,
    `moon bbox 中心偏离 viewBox 中心 (dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)})，` +
      `超过 ${TOL} 容差。「质心居中」类偏移（如 '-2.27 2.16 32 32'）会让 bbox 偏到角上、` +
      `肉眼看到月亮被推到圆顶 —— 不要这么做。当前 viewBox: "${vx} ${vy} ${vw} ${vh}"。`
  )
})

test('moon 包围盒必须 22~28 单位（图标大小正常，没被人为缩小）', () => {
  const match = LUCIDE_SRC.match(/const moon = `(<svg[\s\S]*?)`/)
  const d = match[1].match(/d="([^"]+)"/)[1]
  const bb = pathBBox(flattenPath(d))
  assert.ok(bb.w >= 22 && bb.w <= 28, `moon 包围盒宽 ${bb.w.toFixed(2)} 偏离正常 [22,28]`)
  assert.ok(bb.h >= 22 && bb.h <= 28, `moon 包围盒高 ${bb.h.toFixed(2)} 偏离正常 [22,28]`)
})