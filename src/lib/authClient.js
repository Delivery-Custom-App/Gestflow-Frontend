import { nombreDelEquipo, obtenerDeviceId } from './dispositivo'
import { invalidate } from './apiCache'

const TOKEN_KEY = 'gestflow-auth-token'
const USER_KEY = 'gestflow-auth-user'

// SEC: refresh_token vive solo en memoria (no localStorage) para acotar el
// radio de daño de un eventual XSS — se pierde en un full reload, trade-off
// aceptado. Ver docs/seguridad/TAREAS_SECURITY_2026-09-16.md.
//
// T-51 (renovación automática) mantiene esa decisión: tampoco va a
// sessionStorage, porque duplicar una pestaña copiaría un refresh_token que
// el backend rota en cada uso, y usar uno viejo lo trata como robo y cierra
// la sesión. Después de recargar, la sesión dura lo que le quede al
// access_token (hoy 8 horas) y luego pide volver a entrar.
let inMemoryRefreshToken = null
// Cuándo vence el access_token (ms desde epoch), a partir de `expires_in`.
let inMemoryExpiresAt = null
// Una sola renovación a la vez: si varias peticiones reciben 401 juntas,
// comparten la misma promesa (el refresh_token se rota en cada uso).
let renovacionEnCurso = null

const apiBaseUrl = import.meta.env.VITE_API_URL || ''

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}/api${normalizedPath}`
}

function readJson(key) {
  if (typeof window === 'undefined') return null

  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function writeSession({ access_token, refresh_token, expires_in, user }) {
  if (typeof window === 'undefined') return

  if (access_token) window.localStorage.setItem(TOKEN_KEY, access_token)
  if (refresh_token) inMemoryRefreshToken = refresh_token
  if (Number(expires_in) > 0) inMemoryExpiresAt = Date.now() + Number(expires_in) * 1000
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredSession() {
  // T-35: al cerrar sesión se olvidan los locales y negocios guardados en memoria.
  invalidate()
  inMemoryRefreshToken = null
  inMemoryExpiresAt = null

  if (typeof window === 'undefined') return

  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function getStoredSession() {
  if (typeof window === 'undefined') return null

  const accessToken = window.localStorage.getItem(TOKEN_KEY)
  if (!accessToken) return null

  return {
    access_token: accessToken,
    refresh_token: inMemoryRefreshToken,
    expires_at: inMemoryExpiresAt,
    user: readJson(USER_KEY),
  }
}

async function parseAuthResponse(response) {
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(json?.detail || json?.message || response.statusText || 'Error de autenticacion')
  }

  // Backend V2: { access_token, token_type }
  // Legacy INGSW2: { session: { access_token, refresh_token, user } } o equivalente
  const session = json.session || json
  const accessToken = session.access_token || session.token
  if (!accessToken) {
    throw new Error('El backend no devolvio access_token')
  }

  return {
    access_token: accessToken,
    refresh_token: session.refresh_token || null,
    expires_in: session.expires_in ?? null,
    user: session.user || json.user || null,
  }
}

/**
 * Inicia sesión. Manda el `device_id` de este navegador y un `device_name`
 * legible (T-50): así volver a entrar en el mismo equipo reemplaza su sesión
 * anterior en vez de sumar otra.
 */
export async function loginWithPassword({ email, password }) {
  const response = await fetch(buildUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, device_id: obtenerDeviceId(), device_name: nombreDelEquipo() }),
  })
  const session = await parseAuthResponse(response)

  // V2 no embebe user en el login — completar con /auth/me
  if (!session.user) {
    const me = await fetchCurrentUser(session.access_token)
    if (me) session.user = me
  }

  writeSession(session)
  return session
}

/**
 * Renueva la sesión con `POST /auth/refresh` (T-51, B-16): entrega un
 * access_token y un refresh_token nuevos (el anterior deja de servir), y se
 * guardan los dos. Varias llamadas a la vez comparten la misma renovación.
 *
 * - Sin refresh_token (por ejemplo, después de recargar) se mantiene la
 *   sesión actual.
 * - Un 401 (sesión cerrada, vencida o token inválido) lanza un error con el
 *   `detail` y el `X-Account-Status` del backend: quien llama cierra la sesión
 *   y lo muestra.
 * - Un fallo de red, un 404 o un 5xx no cierran la sesión: se sigue con el
 *   access_token actual.
 */
export function refreshSession() {
  if (!renovacionEnCurso) {
    renovacionEnCurso = renovar().finally(() => { renovacionEnCurso = null })
  }
  return renovacionEnCurso
}

async function renovar() {
  const current = getStoredSession()
  if (!current?.access_token) return null
  if (!current.refresh_token) return current

  let response
  try {
    response = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    })
  } catch {
    return current
  }
  if (response.status === 401) {
    const json = await response.json().catch(() => ({}))
    const err = new Error(json?.detail || 'Tu sesión expiró. Ingresa nuevamente.')
    err.status = 401
    err.detail = json?.detail || null
    err.accountStatus = response.headers?.get?.('X-Account-Status') || null
    throw err
  }
  if (!response.ok) return current
  const session = await parseAuthResponse(response)
  writeSession(session)
  return { ...session, user: session.user || current.user }
}

/**
 * Cambia el local activo de un administrador de local o un empleado entre los
 * que tiene asignados (`POST /auth/switch-local`, T-73). Es la misma sesión,
 * pero el backend entrega un token nuevo con el `local_id` nuevo: se guarda en
 * lugar del anterior para que todas las peticiones siguientes lo usen. El
 * usuario se vuelve a leer después con `/auth/me` (refreshUser).
 */
export async function cambiarLocalActivo(localId) {
  const current = getStoredSession()
  if (!current?.access_token) throw new Error('No hay una sesión abierta')
  if (!localId) throw new Error('Elige el local al que te cambias')
  const response = await fetch(buildUrl('/auth/switch-local'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.access_token}` },
    body: JSON.stringify({ local_id: String(localId) }),
  })
  const session = await parseAuthResponse(response)
  writeSession(session)
  return session
}

export async function fetchCurrentUser(token) {
  const response = await fetch(buildUrl('/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) return null

  const json = await response.json().catch(() => null)
  // V2: MeResponse plano { id, email, role, business_id, local_id }
  const user = json?.user || json
  if (user && typeof window !== 'undefined') {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
  return user
}

export async function logoutSession() {
  const session = getStoredSession()
  try {
    if (session?.access_token) {
      // V2 aún no tiene /auth/logout — ignorar 404
      await fetch(buildUrl('/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => null)
    }
  } finally {
    clearStoredSession()
  }
}
