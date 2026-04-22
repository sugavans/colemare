import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// __dirname is not available in ESM — derive it from import.meta.url
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: resolve(__dirname, 'client'),
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        timeout: 120000,        // 2 minutes — covers long Sonnet calls
        proxyTimeout: 120000,   // upstream response timeout
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Keep SSE connections alive through the proxy
            proxyReq.setHeader('Connection', 'keep-alive');
          });
        },
      },
      '/download': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
