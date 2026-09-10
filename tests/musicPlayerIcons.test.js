import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GLYPHS } from '../src/assets/icons/glyphs.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('GLYPHS contains valid fav and shuffle icons', () => {
  assert.ok(GLYPHS.fav, 'GLYPHS.fav must be defined')
  assert.ok(GLYPHS.favor, 'GLYPHS.favor must be defined')
  assert.ok(GLYPHS.shuffle, 'GLYPHS.shuffle must be defined')
  assert.ok(GLYPHS.fav.startsWith('M16.125'), 'GLYPHS.fav starts with expected coordinates')
  assert.ok(GLYPHS.shuffle.startsWith('M2.95312'), 'GLYPHS.shuffle starts with expected coordinates')
})

test('favor.svg and shuffle.svg exist in assets/icons with currentColor', () => {
  const favorSvgPath = path.resolve(__dirname, '../src/assets/icons/favor.svg')
  const shuffleSvgPath = path.resolve(__dirname, '../src/assets/icons/shuffle.svg')
  
  assert.ok(fs.existsSync(favorSvgPath), 'favor.svg exists')
  assert.ok(fs.existsSync(shuffleSvgPath), 'shuffle.svg exists')

  const favorSvg = fs.readFileSync(favorSvgPath, 'utf8')
  const shuffleSvg = fs.readFileSync(shuffleSvgPath, 'utf8')

  assert.ok(favorSvg.includes('fill="currentColor"'), 'favor.svg uses currentColor')
  assert.ok(shuffleSvg.includes('fill="currentColor"'), 'shuffle.svg uses currentColor')
  assert.ok(favorSvg.includes('viewBox="0 0 24 24"'), 'favor.svg has 24x24 viewBox')
  assert.ok(shuffleSvg.includes('viewBox="0 0 24 24"'), 'shuffle.svg has 24x24 viewBox')
})

test('MusicPlayerCard.vue utilizes GLYPHS.fav and GLYPHS.shuffle with interactive toggle', () => {
  const cardPath = path.resolve(__dirname, '../src/components/system/MusicPlayerCard.vue')
  assert.ok(fs.existsSync(cardPath), 'MusicPlayerCard.vue exists')

  const content = fs.readFileSync(cardPath, 'utf8')
  assert.ok(content.includes('GLYPHS.fav'), 'MusicPlayerCard binds GLYPHS.fav')
  assert.ok(content.includes('GLYPHS.shuffle'), 'MusicPlayerCard binds GLYPHS.shuffle')
  assert.ok(content.includes('is-active-fav'), 'MusicPlayerCard includes is-active-fav class')
  assert.ok(content.includes('is-active-shuffle'), 'MusicPlayerCard includes is-active-shuffle class')
})
