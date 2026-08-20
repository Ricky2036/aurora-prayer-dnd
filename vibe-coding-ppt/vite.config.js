import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import fs from 'fs'
import path from 'path'

function saveDataPlugin() {
  return {
    name: 'save-data-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/save' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const targetPath = path.resolve(__dirname, 'src/data/reportData.js');
              const hmrCode = `
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // HMR accepted: state is already managed in React, no reload needed.
  });
}
`;
              const fileContent = `export const reportData = ${JSON.stringify(data, null, 2)};\n${hmrCode}`;
              fs.writeFileSync(targetPath, fileContent, 'utf-8');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              console.error('Failed to save data:', err);
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        } else if (req.url.startsWith('/api/upload') && req.method === 'POST') {
          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const fileName = urlObj.searchParams.get('name') || `upload_${Date.now()}`;
          const uploadDir = path.resolve(__dirname, 'public/uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const filePath = path.join(uploadDir, fileName);
          const writeStream = fs.createWriteStream(filePath);
          req.pipe(writeStream);
          writeStream.on('finish', () => {
            res.statusCode = 200;
            res.end(JSON.stringify({ url: `/uploads/${fileName}` }));
          });
          req.on('error', (err) => {
            console.error('Failed to upload file:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          });
        } else if (req.url.startsWith('/uploads/') && req.method === 'GET') {
          // Serve files directly to avoid Vite static cache delays for newly uploaded files
          const fileName = decodeURIComponent(req.url.replace('/uploads/', '').split('?')[0]);
          const filePath = path.join(__dirname, 'public/uploads', fileName);
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.mp4': 'video/mp4',
              '.webm': 'video/webm'
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-cache');
            fs.createReadStream(filePath).pipe(res);
          } else {
            next();
          }
        } else {
          next();
        }
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), saveDataPlugin()],
  server: {
    port: 8088,
    watch: {
      ignored: ['**/public/uploads/**']
    }
  }
})
