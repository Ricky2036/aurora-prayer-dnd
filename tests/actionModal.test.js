import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('ActionModal component file exists and contains expected design properties', () => {
  const modalPath = path.resolve(__dirname, '../src/components/ui/ActionModal.vue')
  assert.ok(fs.existsSync(modalPath), 'ActionModal.vue must exist')

  const content = fs.readFileSync(modalPath, 'utf8')

  // Visual specifications from reference design
  assert.ok(content.includes("alignDesc: { type: String, default: 'left' }"), 'Description must default to left-aligned')
  assert.ok(content.includes("alignTitle: { type: String, default: 'center' }"), 'Title must default to center-aligned')
  assert.ok(content.includes('border-radius: 30px'), 'Card border-radius must be 30px')
  assert.ok(content.includes('height: 50px'), 'Buttons must have height 50px')
  assert.ok(content.includes('border-radius: 25px'), 'Buttons must be pill shape with 25px radius')
  assert.ok(content.includes('background: #EFEFEF'), 'Buttons must have neutral gray background')
  assert.ok(content.includes('#FF3B30'), 'Danger confirm button text color must be red')
  assert.ok(content.includes('backdrop-filter: blur(8px)'), 'Backdrop must have blur effect')
})

test('IslandCloseModal delegates to ActionModal while preserving backward compatibility', () => {
  const islandModalPath = path.resolve(__dirname, '../src/components/ui/IslandCloseModal.vue')
  assert.ok(fs.existsSync(islandModalPath), 'IslandCloseModal.vue must exist')

  const content = fs.readFileSync(islandModalPath, 'utf8')

  assert.ok(content.includes("import ActionModal from './ActionModal.vue'"), 'IslandCloseModal must import ActionModal')
  assert.ok(content.includes('<ActionModal'), 'IslandCloseModal template must render ActionModal')
  assert.ok(content.includes("emit('close-once')"), 'Must preserve close-once emit')
  assert.ok(content.includes("emit('close-permanent')"), 'Must preserve close-permanent emit')
  assert.ok(content.includes("emit('cancel')"), 'Must preserve cancel emit')
})
