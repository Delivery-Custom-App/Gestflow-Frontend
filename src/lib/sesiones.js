import { apiRequest } from './apiClient'
import { resumirUserAgent } from './dispositivo'

export { resumirUserAgent }

export const MENSAJE_SESION_EXPIRADA = 'Tu sesion expiro. Ingresa nuevamente.'

/**
 * Qué decirle a la persona cuando su sesión termina (T-52), según el
 * `X-Account-Status` y el `detail` del backend:
 * - `session_revoked` (la cerró el administrador, otro inicio en el mismo
 *   equipo, un cambio de clave…): el motivo del backend tal cual.
 * - `session_expired`: venció por inactividad.
 * - `inactive`: la cuenta fue desactivada.
 * - Sin estado: el mensaje de siempre.
 */
export function mensajeDeCierre({ accountStatus, message } = {}) {
  if (accountStatus === 'session_revoked') return message || 'Tu sesión se cerró. Vuelve a iniciar sesión.'
  if (accountStatus === 'session_expired') return 'Tu sesión venció por inactividad. Vuelve a iniciar sesión.'
  if (accountStatus === 'inactive') return 'Tu cuenta está desactivada. Habla con el administrador de tu negocio.'
  if (accountStatus === 'not_found') return 'Tu cuenta ya no existe. Habla con el administrador de tu negocio.'
  return message || MENSAJE_SESION_EXPIRADA
}

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
