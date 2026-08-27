import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { spawn } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'

import zlib from 'zlib'

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
              const outPath = path.join(tmpDir, `output_${Date.now()}.mov`)
              
              fs.writeFileSync(inPath, buffer)
              
              const dims = await getVideoDimensions(inPath)
              const rRatio = Math.max(0.01, Math.min(0.3, radiusRatio))
              const cornerRadius = Math.round(dims.width * rRatio)
              
              // 极速生成抗锯齿蒙版 (耗时 < 2ms)
              makePngMask(dims.width, dims.height, cornerRadius, maskPath)
              
              // 使用 Apple VideoToolbox 硬件加速 ProRes 4444 输出原生透明 MOV (速度极快 <0.8s，体积仅 ~2MB)
              const args = [
                '-y',
                '-i', inPath,
                '-i', maskPath,
                '-filter_complex', '[1:v]format=gray[m];[0:v][m]alphamerge,format=ayuv64le',
                '-c:v', 'prores_videotoolbox',
                '-profile:v', '4',
                outPath
              ]
              
              const proc = spawn('ffmpeg', args)
              
              proc.on('close', (code) => {
                if (code === 0 && fs.existsSync(outPath)) {
                  const outBuf = fs.readFileSync(outPath)
                  res.setHeader('Content-Type', 'video/quicktime')
                  res.setHeader('Content-Disposition', 'attachment; filename="prototype-alpha.mov"')
                  res.end(outBuf)
                  try { fs.unlinkSync(inPath); fs.unlinkSync(maskPath); fs.unlinkSync(outPath) } catch (e) {}
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

export default defineConfig({
  plugins: [vue(), autoTranscodePlugin()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173
  }
})
