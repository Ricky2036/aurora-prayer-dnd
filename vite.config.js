import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { spawn } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'

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
          req.on('end', () => {
            try {
              const buffer = Buffer.concat(chunks)
              const tmpDir = os.tmpdir()
              const inPath = path.join(tmpDir, `input_${Date.now()}.webm`)
              const outPath = path.join(tmpDir, `output_${Date.now()}.mov`)
              
              fs.writeFileSync(inPath, buffer)
              
              // 优先使用 macOS 原生 VideoToolbox 硬件加速编码 HEVC with Alpha (体积小 ~2MB，毫秒级转码)
              const hevcArgs = [
                '-y',
                '-i', inPath,
                '-c:v', 'hevc_videotoolbox',
                '-allow_sw', '1',
                '-alpha_quality', '0.75',
                '-vtag', 'hvc1',
                '-pix_fmt', 'bgra',
                '-b:v', '6M',
                outPath
              ]
              
              const proc = spawn('ffmpeg', hevcArgs)
              
              proc.on('close', (code) => {
                if (code === 0 && fs.existsSync(outPath)) {
                  const outBuf = fs.readFileSync(outPath)
                  res.setHeader('Content-Type', 'video/quicktime')
                  res.setHeader('Content-Disposition', 'attachment; filename="prototype-alpha.mov"')
                  res.end(outBuf)
                  try { fs.unlinkSync(inPath); fs.unlinkSync(outPath) } catch (e) {}
                } else {
                  res.statusCode = 500
                  res.end('Transcoding failed')
                  try { fs.unlinkSync(inPath) } catch (e) {}
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
