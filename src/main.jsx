import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, MotionConfig, domMax } from 'framer-motion'
import './index.css'
import App from './App.jsx'

async function clearStalePwaState() {
  if (typeof window === 'undefined') return

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
  }
}

clearStalePwaState().catch(() => {
  // Ignore cleanup failures; app boot should continue.
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Respeta "reducir movimiento" del sistema operativo (WCAG 2.3.3). */}
    {/* LazyMotion + <m.*>: las features de animación se cargan una sola vez (domMax incluye `layout`). */}
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
)
