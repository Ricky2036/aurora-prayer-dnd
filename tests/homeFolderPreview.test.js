import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('compact folders use a top-left 3 by 3 preview grid', async () => {
  const source = await readFile(new URL('../src/components/home/HomeFolder.vue', import.meta.url), 'utf8')
  assert.match(source, /grid-template-columns:repeat\(3,1fr\)/)
  assert.match(source, /grid-template-rows:repeat\(3,1fr\)/)
  assert.match(source, /place-content:start/)
  assert.match(source, /props\.folder\.width > 1 \|\| props\.folder\.height > 1 \? 6 : 9/)
})
