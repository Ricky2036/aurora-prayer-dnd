import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('desktop uses pointer events, dwell paging and gesture cancellation cleanup', async () => {
  const source = await read('../src/components/system/HomeScreen.vue')
  assert.match(source, /pointercancel/)
  assert.match(source, /setTimeout\(\(\) =>[\s\S]*400/)
  assert.match(source, /resolveDesktopPage/)
  assert.match(source, /previewPages/)
})

test('folders expose all four sizes, renaming and app drag-out', async () => {
  const [home, overlay] = await Promise.all([
    read('../src/components/system/HomeScreen.vue'),
    read('../src/components/home/HomeFolderOverlay.vue')
  ])
  assert.match(home, /\[\[1,1\],\[2,1\],\[1,2\],\[2,2\]\]/)
  assert.match(home, /createSelectedFolder/)
  assert.match(home, /removeAppFromFolder/)
  assert.match(overlay, /文件夹名称/)
})
