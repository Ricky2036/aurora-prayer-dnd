/**
 * 勿扰（moon）图标视觉居中回归测试。
 *
 * 历史翻车链：自 42645a6 以来 moon 的 path 数据从未被改过，viewBox 一直是 `0 0 32 32`。
 * 但 path 的缺口在右上、实心质量在左下，面积质心实测在 (13.73, 18.16)，
 * 比 viewBox 中心偏左下 2.6 单位（屏幕 ~2.8px）。多个 agent（包括 Antigravity /
 * KIMI / GLM-5.3）都按「包围盒居中」的直觉去调，每次都说「修好了」，每次都被
 * Ricky 拍回来 —— 因为眼睛感知的是质量中心，不是包围盒。
 *
 * 这个测试用代码量化的方式锁死「视觉居中」：要求 path 的面积质心落在
 * viewBox 几何中心 ±0.3 单位内。任何把 viewBox 改回 0 0 32 32、或乱平移 viewBox
 * 的提交都会挂掉，强迫下一个人先跑 /tmp/moon-centroid.mjs 重新算质心。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LUCIDE_SRC = readFileSync(join(__dirname, '../src/assets/icons/lucide.js'), 'utf8')

/** 把三次贝塞尔曲线展平成多边形采样点；path 用了 M + 多个 C */
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

/** 多边形面积质心（Shoelace 公式） */
function areaCentroid(polys) {
  let A = 0, cx = 0, cy = 0
  for (const poly of polys) {
    for (let k = 0; k < poly.length; k++) {
      const [x0, y0] = poly[k]
      const [x1, y1] = poly[(k + 1) % poly.length]
      const cross = x0 * y1 - x1 * y0
      A += cross
      cx += (x0 + x1) * cross
      cy += (y0 + y1) * cross
    }
  }
  A /= 2
  return { A, cx: cx / (6 * A), cy: cy / (6 * A) }
}

function parseViewBox(svg) {
  const m = svg.match(/viewBox="([\d.\- ]+)"/)
  const [vx, vy, vw, vh] = m[1].trim().split(/\s+/).map(Number)
  return { vx, vy, vw, vh }
}

test('moon 存在且 viewBox 是 32x32 方形', () => {
  const match = LUCIDE_SRC.match(/const moon = `(<svg[\s\S]*?)`/)
  assert.ok(match, 'moon 常量不存在')
  const moonSvg = match[1]
  const { vw, vh } = parseViewBox(moonSvg)
  assert.equal(vw, 32, 'moon viewBox 宽度必须为 32')
  assert.equal(vh, 32, 'moon viewBox 高度必须为 32')
})

test('moon path 必须以 M 开头并以 Z 闭合（多边形质心公式的前提）', () => {
  const m = LUCIDE_SRC.match(/const moon = `(<svg[\s\S]*?`)/)
  const d = m[1].match(/d="([^"]+)"/)[1]
  assert.ok(d.startsWith('M'), 'moon path 必须以 M 开头')
  assert.ok(d.endsWith('Z'), 'moon path 必须以 Z 闭合')
})

test('moon 面积质心必须落在 viewBox 几何中心 ±0.3 单位内（视觉对齐硬约束）', () => {
  const match = LUCIDE_SRC.match(/const moon = `(<svg[\s\S]*?)`/)
  const svg = match[1]
  const d = svg.match(/d="([^"]+)"/)[1]
  const { vx, vy, vw, vh } = parseViewBox(svg)
  const { cx, cy } = areaCentroid(flattenPath(d))

  // 质心在 viewBox 坐标系中的位置
  const cxInVb = cx - vx
  const cyInVb = cy - vy

  const cxCenter = vw / 2
  const cyCenter = vh / 2

  const TOL = 0.3
  const dx = Math.abs(cxInVb - cxCenter)
  const dy = Math.abs(cyInVb - cyCenter)

  assert.ok(
    dx < TOL && dy < TOL,
    `moon 视觉质心偏离 viewBox 中心 (dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)})，` +
      `超过 ${TOL} 容差。修改 viewBox 前先跑 /tmp/moon-centroid.mjs 重新计算质心。` +
      `当前 viewBox: "${vx} ${vy} ${vw} ${vh}"; 质心: (${cx.toFixed(2)}, ${cy.toFixed(2)})。`
  )
})

test('moon 包围盒几乎顶满 viewBox（图标大小正常，没被人为缩小）', () => {
  const match = LUCIDE_SRC.match(/const moon = `(<svg[\s\S]*?)`/)
  const d = match[1].match(/d="([^"]+)"/)[1]
  const polys = flattenPath(d)
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9
  for (const poly of polys) for (const [x, y] of poly) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  const w = maxX - minX, h = maxY - minY
  // 包围盒必须 ≥ 22 单位（22/32 ≈ 69% 填充，跟邻居 40% 的图标比更饱满是月亮的特征）
  assert.ok(w >= 22 && w <= 28, `moon 包围盒宽 ${w.toFixed(2)} 偏离正常 [22,28]`)
  assert.ok(h >= 22 && h <= 28, `moon 包围盒高 ${h.toFixed(2)} 偏离正常 [22,28]`)
})