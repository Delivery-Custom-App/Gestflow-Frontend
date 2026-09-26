import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// En Docker, el proxy corre dentro del contenedor frontend: usar nombre del servicio (p. ej. backend:8000).
// En el host, localhost:8000. Override: VITE_DEV_PROXY_TARGET.
const devProxyTarget =
  process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000'

// SEC: hash sha256 del <script> inline de anti-flash de tema en index.html
// (ver ese bloque, al final del <body>). Si se edita ese script, recalcular:
// node -e "console.log('sha256-' + require('crypto').createHash('sha256').update(fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1]).digest('base64'))"
const THEME_SCRIPT_HASH = 'sha256-XLO5nLvcvG7QyzOqVdYjrTamOz61Z08wrps9tgo0BEQ='

/**
 * SEC: CSP compensatoria mientras no hay ADR de cookies HttpOnly (ver
 * docs/seguridad/TAREAS_SECURITY_2026-09-16.md). Corta el vector de XSS más
 * común: script externo/inyectado. No reemplaza sanitizar inputs.
 *
 * Solo en build (`apply: 'build'`): el dev server de Vite inyecta sus propios
 * <script type="module"> inline para HMR/React Fast Refresh en cada carga de
 * index.html — con esta CSP activa en dev, esos scripts quedarían bloqueados
 * y el dev server no arranca. En build no hay HMR, así que es seguro.
 *
 * Limitaciones de <meta> (spec): frame-ancestors, report-uri y sandbox se
 * ignoran acá — necesitan header HTTP real, a configurar en el server
 * (nginx, fuera de este repo; ver hallazgo de headers de seguridad).
 *
 * style-src: 'unsafe-inline' porque React/Tailwind/framer-motion escriben el
 * atributo style inline en runtime — no hay forma barata de evitarlo sin
 * refactor grande; el riesgo real está en script-src, no acá.
 * img-src: data: por los avatares (se suben como data URL en
 * ConfiguracionPage) + los tiles de OpenStreetMap del mapa de sucursales.
 */
function cspPlugin() {
  return {
    name: 'csp-meta-tag',
    apply: 'build',
    transformIndexHtml(html) {
      const csp = [
        "default-src 'self'",
        `script-src 'self' '${THEME_SCRIPT_HASH}'`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://*.tile.openstreetmap.org",
        "connect-src 'self' https://gestflow.mardev.cl https://nominatim.openstreetmap.org",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')

      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp};" />`
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cspPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    cssMinify: true,
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
      // Backend V2 expone /health fuera de /api
      '/health': {
        target: devProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
