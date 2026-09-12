import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('tokens.css defines 50px modern screen corner radius', () => {
  const tokensPath = path.resolve(__dirname, '../src/styles/tokens.css')
  const tokensContent = fs.readFileSync(tokensPath, 'utf8')

  assert.match(
    tokensContent,
    /--screen-radius:\s*50px;/,
    '--screen-radius must be updated to 50px for modern flagship ratio'
  )
})

test('PhoneFrame implements premium titanium frame, antenna bands, 5-button layout, and micro-slit speaker', () => {
  const framePath = path.resolve(__dirname, '../src/components/phone/PhoneFrame.vue')
  const frameContent = fs.readFileSync(framePath, 'utf8')

  // Antenna bands
  assert.match(frameContent, /class="antenna-band antenna-tl"/, 'Must include top-left antenna band')
  assert.match(frameContent, /class="antenna-band antenna-tr"/, 'Must include top-right antenna band')
  assert.match(frameContent, /class="antenna-band antenna-bl"/, 'Must include bottom-left antenna band')
  assert.match(frameContent, /class="antenna-band antenna-br"/, 'Must include bottom-right antenna band')

  // 5 side buttons
  assert.match(frameContent, /class="side-btn action-btn"/, 'Must include Action Button')
  assert.match(frameContent, /class="side-btn volume-up"/, 'Must include Volume Up button')
  assert.match(frameContent, /class="side-btn volume-down"/, 'Must include Volume Down button')
  assert.match(frameContent, /class="side-btn power"/, 'Must include Power button')
  assert.match(frameContent, /class="side-btn camera-control"/, 'Must include Camera Control button')

  // Hardware components: speaker slit, punch hole, frame inner
  assert.match(frameContent, /class="speaker-slit"/, 'Must include micro-slit speaker grill')
  assert.match(frameContent, /class="punch-hole"/, 'Must retain punch-hole camera node for status bar test compatibility')
  assert.match(frameContent, /class="frame-inner"/, 'Must include ultra-narrow black bezel frame-inner')

  // Concentric geometric radii (2px outer metal + 3px inner black bezel = 5px total)
  assert.match(
    frameContent,
    /border-radius:\s*calc\(var\(--screen-radius\)\s*\+\s*5px\);/,
    'Outer titanium frame must concentric scale by +5px'
  )
  assert.match(
    frameContent,
    /border-radius:\s*calc\(var\(--screen-radius\)\s*\+\s*3px\);/,
    'Inner black bezel must concentric scale by +3px'
  )
})
