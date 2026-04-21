import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En Docker, el proxy corre dentro del contenedor frontend: usar nombre del servicio (p. ej. backend:8000).
// En el host, localhost:8000. Override: VITE_DEV_PROXY_TARGET.
const devProxyTarget =
  process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    cssMinify: false, // Desabilita minificación de CSS por error en lighthouse
    minify: 'terser',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
    },
    proxy: {
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
