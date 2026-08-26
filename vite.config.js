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
              
              // 使用 FFmpeg 强制重构抗锯齿圆角 Alpha 蒙版，并输出 Apple ProRes 4444 (.mov)
              const rRatio = Math.max(0.01, Math.min(0.3, radiusRatio))
              const vfFilter = `format=yuva444p10le,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X,W*${rRatio})*lt(Y,W*${rRatio}), clip((W*${rRatio}-hypot(X-W*${rRatio},Y-W*${rRatio})+0.5)*255*256, 0, 65535), if(gt(X,W-W*${rRatio})*lt(Y,W*${rRatio}), clip((W*${rRatio}-hypot(X-(W-W*${rRatio}),Y-W*${rRatio})+0.5)*255*256, 0, 65535), if(lt(X,W*${rRatio})*gt(Y,H-W*${rRatio}), clip((W*${rRatio}-hypot(X-W*${rRatio},Y-(H-W*${rRatio}))+0.5)*255*256, 0, 65535), if(gt(X,W-W*${rRatio})*gt(Y,H-W*${rRatio}), clip((W*${rRatio}-hypot(X-(W-W*${rRatio}),Y-(H-W*${rRatio}))+0.5)*255*256, 0, 65535), 65535))))'`
              
              const proresArgs = [
                '-y',
                '-i', inPath,
                '-vf', vfFilter,
                '-c:v', 'prores_ks',
                '-profile:v', '4444',
                '-pix_fmt', 'yuva444p10le',
                outPath
              ]
              
              const proc = spawn('ffmpeg', proresArgs)
              
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
