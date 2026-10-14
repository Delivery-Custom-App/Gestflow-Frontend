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

// ── Sesiones de otra persona (T-53) ──────────────────────────────────────────
// El administrador de local ve las de los empleados de su local; el dueño, las
// de su negocio. Cerrar una sesión no termina el turno ni suelta la máquina.

export const MOTIVO_SESION_MIN = 3
export const MOTIVO_SESION_MAX = 300

/** `GET /users/{id}/sessions?incluir_cerradas=`: abiertas primero, de la más reciente a la más antigua. */
export async function listarSesionesDe(userId, { incluirCerradas = false } = {}) {
  const filas = await apiRequest(`/users/${encodeURIComponent(String(userId))}/sessions?incluir_cerradas=${incluirCerradas ? 'true' : 'false'}`)
  return (Array.isArray(filas) ? filas : [])
    .sort((a, b) => (Number(b.activa !== false) - Number(a.activa !== false))
      || String(b.last_seen_at || b.revoked_at || '').localeCompare(String(a.last_seen_at || a.revoked_at || '')))
}

/** Motivo obligatorio de 3 a 300 caracteres; null si está bien. */
export function validarMotivoSesion(motivo) {
  const texto = String(motivo || '').trim()
  if (texto.length < MOTIVO_SESION_MIN) return `Escribe el motivo (al menos ${MOTIVO_SESION_MIN} caracteres).`
  if (texto.length > MOTIVO_SESION_MAX) return `El motivo puede tener hasta ${MOTIVO_SESION_MAX} caracteres.`
  return null
}

/**
 * `POST /users/{id}/sessions/cerrar` con `motivo` y `session_id` (sin él se
 * cierran todas). Devuelve `{ cerradas, sesiones }`.
 */
export async function cerrarSesionesDe(userId, { motivo, sessionId = null }) {
  return apiRequest(`/users/${encodeURIComponent(String(userId))}/sessions/cerrar`, {
    method: 'POST',
    body: { motivo: String(motivo || '').trim(), session_id: sessionId || null },
  })
}

const CIERRES = {
  admin: 'La cerró el administrador',
  logout: 'Cerró sesión',
  replaced: 'Volvió a entrar en el mismo equipo',
  limit: 'Superó el máximo de sesiones abiertas',
  password: 'Cambio o restablecimiento de clave',
  deactivated: 'Cuenta desactivada',
  refresh_reuse: 'Token de renovación reutilizado',
}

/** Cómo se cerró una sesión, en palabras. */
export function textoDelCierre(sesion) {
  return CIERRES[sesion?.revoked_kind] || sesion?.revoked_kind || 'Cerrada'
}
