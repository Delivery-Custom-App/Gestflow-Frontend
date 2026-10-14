import { apiRequest } from './apiClient'

/**
 * Mis sesiones abiertas (T-74 · B-16, sección 5d del backend).
 *
 * `GET /auth/sessions` devuelve una fila por dispositivo con `id`,
 * `device_name`, `user_agent`, `ip`, `created_at`, `last_seen_at`,
 * `expires_at`, `activa` y `es_actual` (la de esta llamada).
 */
export async function listarMisSesiones() {
  const filas = await apiRequest('/auth/sessions')
  return (Array.isArray(filas) ? filas : [])
    .filter((s) => s.activa !== false)
    // La actual primero; después, la de actividad más reciente.
    .sort((a, b) => (Number(Boolean(b.es_actual)) - Number(Boolean(a.es_actual)))
      || String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')))
}

const NAVEGADORES = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]
const SISTEMAS = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iOS/, 'iPhone o iPad'],
  [/Mac OS X|Macintosh/, 'Mac'],
  [/Linux/, 'Linux'],
]

/** "Chrome en Windows" a partir del user agent; si no se reconoce, el texto recortado. */
export function resumirUserAgent(userAgent) {
  const ua = String(userAgent || '')
  if (!ua) return 'Dispositivo desconocido'
  const navegador = NAVEGADORES.find(([re]) => re.test(ua))?.[1]
  const sistema = SISTEMAS.find(([re]) => re.test(ua))?.[1]
  if (navegador && sistema) return `${navegador} en ${sistema}`
  if (navegador || sistema) return navegador || sistema
  return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua
}

/** El nombre que se muestra: el que dio la app al iniciar sesión o, si no hay, el navegador. */
export function nombreDelDispositivo(sesion) {
  return sesion?.device_name?.trim() || resumirUserAgent(sesion?.user_agent)
}

/** Fecha y hora en formato chileno ("14-10-2026 09:30"); "—" si no hay. */
export function fechaHora(valor) {
  const d = valor ? new Date(valor) : null
  if (!d || Number.isNaN(d.getTime())) return '—'
  const fecha = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${fecha} ${hora}`
}
