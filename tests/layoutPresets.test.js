/* 控制中心「默认布局」磁贴清单的回归护栏
 *
 * 背景：JBL 磁贴按需求从默认布局下线（Ricky 2026-09-08）。
 * 它原来同时挂在两个地方，只删一处会出事：
 *   - controlStore.js 里 NOTE 预设的 only 数组
 *   - ControlCenter.vue 里的 DEFAULT_TOGGLE_IDS
 * 只删 only → jbl 从 PRESET_EXCLUSIVE_IDS 掉出去 → 反而泄漏到 CAMON / GT 布局里。
 * 这两个测试把「两处都不含 jbl」钉死，谁再手滑只改一半都会红。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { LAYOUT_PRESETS, PRESET_EXCLUSIVE_IDS } from '../src/stores/controlStore.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ccSource = readFileSync(path.join(root, 'src/components/system/ControlCenter.vue'), 'utf8')

/** 从 ControlCenter.vue 源码里抠出 DEFAULT_TOGGLE_IDS 数组内容
 *  先剥掉 // 行注释，否则注释里提到的 'jbl' 会被误当成真实条目 */
function readDefaultToggleIds() {
  const noComments = ccSource.replace(/^\s*\/\/.*$/gm, '')
  const m = noComments.match(/const\s+DEFAULT_TOGGLE_IDS\s*=\s*\[([\s\S]*?)\]/)
  assert.ok(m, 'ControlCenter.vue 里找不到 DEFAULT_TOGGLE_IDS，测试需要同步更新')
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

const DEFAULT_TOGGLE_IDS = readDefaultToggleIds()

test('NOTE 默认布局不再包含 JBL', () => {
  const note = LAYOUT_PRESETS.find((p) => p.id === 'note')
  assert.ok(note, '找不到 NOTE 预设')
  assert.ok(!note.only.includes('jbl'), 'NOTE 的 only 里还有 jbl —— JBL 已下线，应该移除')
})

test('DEFAULT_TOGGLE_IDS 不再包含 JBL（否则会从 NOTE 泄漏到 CAMON / GT）', () => {
  assert.ok(
    !DEFAULT_TOGGLE_IDS.includes('jbl'),
    'DEFAULT_TOGGLE_IDS 里还有 jbl —— 只删 NOTE 的 only 会让 JBL 出现在所有机型布局里'
  )
})

test('JBL 不在机型独占名单里（避免「半启用」的悬空配置）', () => {
  assert.ok(
    !PRESET_EXCLUSIVE_IDS.includes('jbl'),
    'PRESET_EXCLUSIVE_IDS 里还有 jbl，但它已不在 DEFAULT_TOGGLE_IDS —— 配置不一致'
  )
})

test('下线 JBL 不能顺手把别的机型独占项弄丢', () => {
  const note = LAYOUT_PRESETS.find((p) => p.id === 'note')
  const gt = LAYOUT_PRESETS.find((p) => p.id === 'gt')
  assert.ok(note.only.includes('joyHeart'), 'NOTE 应该保留 joyHeart（心率血氧胶囊）')
  assert.ok(gt.only.includes('liquidCooling'), 'GT 应该保留 liquidCooling')
  assert.ok(gt.only.includes('shoulderKey'), 'GT 应该保留 shoulderKey')
})

test('三个机型布局都不应该渲染出 JBL', () => {
  for (const preset of LAYOUT_PRESETS) {
    const only = new Set(preset.only)
    const rendered = [...new Set([...DEFAULT_TOGGLE_IDS])].filter(
      (id) => !PRESET_EXCLUSIVE_IDS.includes(id) || only.has(id)
    )
    assert.ok(!rendered.includes('jbl'), `${preset.label} 布局里出现了 JBL`)
  }
})
