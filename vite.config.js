import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { spawn } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'

import zlib from 'zlib'

/* ===================== save-defaults 安全工具 =====================
 * 该插件会用 POST /__api/save-defaults 改写 src/stores/controlStore.js。
 * 原始实现把未校验的 id 直接拼进 RegExp 并 fs.writeFileSync 覆盖源文件，
 * 等同「本地任意代码执行」。以下工具用于把写回操作锁死在安全边界内。 */
const SAVE_DEFAULTS_ROUTE = '/__api/save-defaults'
const SAVE_DEFAULTS_TARGET = 'src/stores/controlStore.js'
const MAX_SAVE_BODY_BYTES = 64 * 1024
const DEV_SERVER_PORT = 5555

/* 与 controlStore.setIconSize(8~64) / setBgSize(16~100) 的 clamp 区间严格一致 */
const SAVE_SIZE_RANGES = { iconSize: [8, 64], bgSize: [16, 100] }

/* id 必须是合法 JS 标识符，且不能是 Object.prototype 上的成员。
 * 这足够挡住：
 *   - 正则元字符注入（. * + ? ( ) [ ] { } | \ $ 均不在字符集内）
 *   - 替换串注入（无法插入换行 / $ / 花括号等 RegExp 替换语法）
 *   - 原型污染（__proto__ 首字符是 _，被 [A-Za-z] 挡掉；
 *     constructor / prototype / toString 等由 Object.prototype 归属检查挡掉）
 * 同时保留「往 DEFAULT_ICON_SIZES 追加新 id」的原有能力 ——
 * 控制中心里 mediaPlayer / joyHeart 等 widget 本就不在默认表中，
 * 若改用「已知 id 白名单」会让它们的「设为默认」静默失效。 */
const SAVE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

function isValidSaveId(id) {
  return typeof id === 'string'
    && SAVE_ID_PATTERN.test(id)
    && !Object.hasOwn(Object.prototype, id)
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 定位 `const NAME = {` 的对象体，返回 [start, end) 开区间（不含首尾花括号）。
 *  用花括号配平扫描把替换范围锁死在对象内部，
 *  杜绝原先 `[\s\S]*?` 越过闭合 `}` 匹配到后面对象的问题。 */
function findObjectBody(content, name) {
  const head = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*\\{`)
  const m = head.exec(content)
  if (!m) return null
  const open = m.index + m[0].length - 1 // 指向 '{'
  let depth = 0
  for (let i = open; i < content.length; i++) {
    const ch = content[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return { start: open + 1, end: i }
    }
  }
  return null
}

/** 在对象体内替换 key 的数值；key 不存在则追加到末尾。
 *  id 已通过 SAVE_ID_PATTERN 校验，此处仍做 escapeRegExp 二次防御。
 *  \b 边界确保 `sound` 不会误匹配 `sound_ring`。 */
function upsertNumber(body, id, value) {
  // 分组 1 = 缩进 + 键名 + 冒号，分组 2 = 原数值；替换时保留分组 1、只换数值
  const keyRe = new RegExp(`([\\t ]*\\b${escapeRegExp(id)}\\s*:\\s*)(-?\\d+(?:\\.\\d+)?)`)
  if (keyRe.test(body)) return body.replace(keyRe, `$1${value}`)
  const trimmed = body.replace(/\s+$/, '')
  return `${trimmed}\n  ${id}: ${value},\n`
}

function makePngMask(w, h, r, outPath) {
  const stride = w + 1
  const raw = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0
    for (let x = 0; x < w; x++) {
      let a = 255
      if (x < r && y < r) {
        const d = Math.hypot(x - r, y - r)
        a = Math.min(255, Math.max(0, Math.round((r - d + 0.5) * 255)))
      } else if (x > w - r && y < r) {
        const d = Math.hypot(x - (w - r), y - r)
        a = Math.min(255, Math.max(0, Math.round((r - d + 0.5) * 255)))
      } else if (x < r && y > h - r) {
        const d = Math.hypot(x - r, y - (h - r))
        a = Math.min(255, Math.max(0, Math.round((r - d + 0.5) * 255)))
      } else if (x > w - r && y > h - r) {
        const d = Math.hypot(x - (w - r), y - (h - r))
        a = Math.min(255, Math.max(0, Math.round((r - d + 0.5) * 255)))
      }
      raw[y * stride + 1 + x] = a
    }
  }
  const compressed = zlib.deflateSync(raw)
  
  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeBuf = Buffer.from(type)
    const crcVal = zlib.crc32(Buffer.concat([typeBuf, data]))
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crcVal >>> 0)
    return Buffer.concat([len, typeBuf, data, crcBuf])
  }
  
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 0
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  
  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
  fs.writeFileSync(outPath, png)
}

function getVideoDimensions(filePath) {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=s=x:p=0',
      filePath
    ])
    let out = ''
    proc.stdout.on('data', data => out += data)
    proc.on('close', () => {
      const [w, h] = out.trim().split('x').map(Number)
      resolve({ width: w || 390, height: h || 844 })
    })
  })
}

function autoTranscodePlugin() {
  return {
    name: 'auto-transcode-mov',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlObj = new URL(req.url, 'http://127.0.0.1')
        if (urlObj.pathname === '/__transcode_mov' && req.method === 'POST') {
          const radiusRatio = Number(urlObj.searchParams.get('radiusRatio')) || 0.136
          const chunks = []
          req.on('data', chunk => chunks.push(chunk))
          req.on('end', async () => {
            try {
              const buffer = Buffer.concat(chunks)
              const tmpDir = os.tmpdir()
              const inPath = path.join(tmpDir, `input_${Date.now()}.webm`)
              const maskPath = path.join(tmpDir, `mask_${Date.now()}.png`)
              const tmpProres = path.join(tmpDir, `tmp_prores_${Date.now()}.mov`)
              const outPath = path.join(tmpDir, `output_${Date.now()}.mov`)
              
              fs.writeFileSync(inPath, buffer)
              
              const dims = await getVideoDimensions(inPath)
              const rRatio = Math.max(0.01, Math.min(0.3, radiusRatio))
              const cornerRadius = Math.round(dims.width * rRatio)
              
              // 1. 极速生成数学级精确抗锯齿蒙版 (耗时 < 2ms)
              makePngMask(dims.width, dims.height, cornerRadius, maskPath)
              
              // 2. 使用 FFmpeg 进行精准透明蒙版合成 (< 0.8s)
              const ffmpegArgs = [
                '-y',
                '-i', inPath,
                '-i', maskPath,
                '-filter_complex', '[1:v]format=gray[m];[0:v][m]alphamerge,format=ayuv64le',
                '-c:v', 'prores_videotoolbox',
                '-profile:v', '4',
                tmpProres
              ]
              
              const proc = spawn('ffmpeg', ffmpegArgs)
              
              proc.on('close', (code) => {
                if (code === 0 && fs.existsSync(tmpProres)) {
                  // 3. 使用 macOS 原生 avconvert 压缩为官方 Apple HEVC with Alpha (< 0.2s，体积仅 1~2MB)
                  const avProc = spawn('/usr/bin/avconvert', [
                    '-s', tmpProres,
                    '-p', 'PresetHEVCHighestQualityWithAlpha',
                    '-o', outPath,
                    '--replace'
                  ])
                  
                  avProc.on('close', (avCode) => {
                    const finalPath = (avCode === 0 && fs.existsSync(outPath)) ? outPath : tmpProres
                    const outBuf = fs.readFileSync(finalPath)
                    res.setHeader('Content-Type', 'video/quicktime')
                    res.setHeader('Content-Disposition', 'attachment; filename="prototype-alpha.mov"')
                    res.end(outBuf)
                    try {
                      fs.unlinkSync(inPath)
                      fs.unlinkSync(maskPath)
                      if (fs.existsSync(tmpProres)) fs.unlinkSync(tmpProres)
                      if (fs.existsSync(outPath)) fs.unlinkSync(outPath)
                    } catch (e) {}
                  })
                } else {
                  res.statusCode = 500
                  res.end('Transcoding failed')
                  try { fs.unlinkSync(inPath); fs.unlinkSync(maskPath) } catch (e) {}
                }
              })
            } catch (err) {
              res.statusCode = 500
              res.end(String(err))
            }
          })
        } else {
          next()
        }
      })
    }
  }
}

function saveDefaultsPlugin() {
  return {
    name: 'save-defaults-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        if (pathname !== SAVE_DEFAULTS_ROUTE || req.method !== 'POST') return next()

        const sendJson = (code, payload) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(payload))
        }

        // ---- 1) origin 校验：只接受 dev server 自身来源，防跨站调用与 DNS rebinding ----
        const origin = req.headers.origin
        if (origin) {
          let allowed = false
          try {
            const u = new URL(origin)
            allowed =
              (u.hostname === '127.0.0.1' || u.hostname === 'localhost') &&
              Number(u.port || 80) === DEV_SERVER_PORT
          } catch (e) {
            allowed = false
          }
          if (!allowed) return sendJson(403, { success: false, error: 'origin not allowed' })
        }

        // ---- 2) body 读取 + 体积上限 ----
        const chunks = []
        let received = 0
        let aborted = false
        req.on('data', (chunk) => {
          if (aborted) return
          received += chunk.length
          if (received > MAX_SAVE_BODY_BYTES) {
            aborted = true
            sendJson(413, { success: false, error: 'payload too large' })
            req.destroy()
            return
          }
          chunks.push(chunk)
        })
        req.on('end', () => {
          if (aborted) return
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
            // 兼容两种前端契约：单条 {id,iconSize,bgSize} 与数组 {items:[...]}
            const rawItems = Array.isArray(body?.items)
              ? body.items
              : (body && body.id ? [body] : [])

            const filePath = path.resolve(__dirname, SAVE_DEFAULTS_TARGET)
            let content = fs.readFileSync(filePath, 'utf-8')

            const failed = []
            let count = 0

            // ---- 3) 逐条校验，先在内存字符串上累积；全部通过后才落盘（避免半写）----
            for (const item of rawItems) {
              if (!item || typeof item !== 'object') {
                failed.push({ id: null, reason: 'invalid item' })
                continue
              }
              const { id } = item
              if (!isValidSaveId(id)) {
                failed.push({ id, reason: 'invalid id format' })
                continue
              }
              for (const field of ['iconSize', 'bgSize']) {
                const raw = item[field]
                if (raw === undefined || raw === null) continue
                const val = Number(raw)
                const [min, max] = SAVE_SIZE_RANGES[field]
                if (!Number.isInteger(val) || val < min || val > max) {
                  failed.push({ id, field, reason: `must be an integer in [${min}, ${max}]` })
                  continue
                }
                const objName = field === 'iconSize' ? 'DEFAULT_ICON_SIZES' : 'DEFAULT_BG_SIZES'
                // 每次重新定位：上一轮插入会改变偏移量
                const loc = findObjectBody(content, objName)
                if (!loc) {
                  failed.push({ id, field, reason: `${objName} not found` })
                  continue
                }
                const before = content.slice(loc.start, loc.end)
                const after = upsertNumber(before, id, val)
                if (after === before) {
                  failed.push({ id, field, reason: 'no change' })
                  continue
                }
                content = content.slice(0, loc.start) + after + content.slice(loc.end)
                count++
              }
            }

            // ---- 4) 原子落盘：先备份，再写临时文件，最后 rename 覆盖 ----
            if (count > 0) {
              fs.copyFileSync(filePath, `${filePath}.bak`)
              const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
              try {
                fs.writeFileSync(tmpPath, content, 'utf-8')
                fs.renameSync(tmpPath, filePath)
              } catch (e) {
                try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath) } catch (_) {}
                throw e
              }
            }

            sendJson(200, { success: true, count, failed })
          } catch (err) {
            sendJson(500, { success: false, error: String(err) })
          }
        })
      })
    }
  }
}

export default defineConfig({
  plugins: [vue(), autoTranscodePlugin(), saveDefaultsPlugin()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5555,
    // 端口被占用时不要悄悄换端口：换端口后 Playwright 脚本和 Ricky 书签里的
    // 链接会全部失效，直接报错反而更容易定位
    strictPort: true
  },
  build: {
    // 出问题时要能对着真实源码定位，而不是对着压缩后的单行
    sourcemap: true,
    // 首屏只加载主包；Vue 运行时和调试控制台（体积大、只在演示时用）拆出去
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'pinia']
        }
      }
    },
    // 单文件超过 500kB 就报警，避免哪天不小心把整张壁纸内联进 JS
    chunkSizeWarningLimit: 500
  }
})
