import { clearStoredSession, getStoredSession, refreshSession } from './authClient'
import { getBusinessId } from '../utils/jwt'
import { cachedRequest } from './apiCache'

const apiBaseUrl = import.meta.env.VITE_API_URL || ''

async function getSession(forceRefresh = false) {
  if (forceRefresh) {
    const refreshed = await refreshSession()
    if (!refreshed?.access_token) {
      throw new Error('No hay sesion activa')
    }

    return refreshed
  }

  const session = getStoredSession()
  if (session?.access_token) {
    return session
  }

  const refreshed = await refreshSession()
  if (!refreshed?.access_token) {
    throw new Error('No hay sesion activa')
  }

  return refreshed
}

function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl}/api${normalizedPath}`
}

/**
 * FastAPI puede devolver detail como string, lista de errores Pydantic u objeto.
 * @param {unknown} detail
 * @returns {string}
 */
export function formatApiErrorDetail(detail) {
  if (detail == null) return ''
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const loc = Array.isArray(item.loc) ? item.loc.filter((x) => x !== 'body').join(' › ') : ''
          const msg = item.msg || item.message || ''
          if (loc && msg) return `${loc}: ${msg}`
          if (msg) return msg
        }
        try {
          return JSON.stringify(item)
        } catch {
          return String(item)
        }
      })
      .filter(Boolean)
      .join('\n')
  }
  if (typeof detail === 'object') {
    // Errores con estructura (por ejemplo, el 409 del cierre de caja: { motivo, mensaje, turnos }): su texto.
    const texto = detail.mensaje || detail.message
    if (typeof texto === 'string' && texto) return texto
    try {
      return JSON.stringify(detail)
    } catch {
      return String(detail)
    }
  }
  return String(detail)
}

async function parseErrorResponse(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const json = await response.json()
      const detail = formatApiErrorDetail(json?.detail)
      if (detail) return detail
      if (json && typeof json === 'object' && Object.keys(json).length) {
        return JSON.stringify(json)
      }
      return response.statusText || 'Error desconocido'
    } catch {
      return response.statusText || 'Error desconocido'
    }
  }

  try {
    const text = await response.text()
    return text || response.statusText || 'Error desconocido'
  } catch {
    return response.statusText || 'Error desconocido'
  }
}

export async function getAuthContext() {
  const session = await getSession()
  const token = session.access_token
  const businessId = getBusinessId(session.user, token)

  return {
    token,
    businessId,
    user: session.user,
  }
}

export async function getOptionalAuthContext() {
  const session = getStoredSession()
  if (!session?.access_token) {
    return {
      token: null,
      businessId: null,
      user: null,
    }
  }

  try {
    const token = session.access_token

    return {
      token,
      businessId: getBusinessId(session.user, token),
      user: session.user,
    }
  } catch {
    return {
      token: null,
      businessId: null,
      user: null,
    }
  }
}

export const MENSAJE_503 = 'No se pudo verificar tu cuenta en este momento. Reintenta en unos segundos.'
export const MENSAJE_429 = 'Demasiados intentos, espera un minuto.'
const MAX_ESPERA_503_MS = 10_000

/** Segundos de `Retry-After` en milisegundos (5 s si no viene; máximo 10 s). */
export function esperaRetryAfter(response) {
  const valor = response?.headers?.get?.('Retry-After')
  const s = valor == null || valor === '' ? NaN : Number(valor)
  return Math.min(Number.isFinite(s) && s >= 0 ? s * 1000 : 5000, MAX_ESPERA_503_MS)
}

/** Espera configurable (los tests la reemplazan). */
export const reloj = { esperar: (ms) => new Promise((r) => setTimeout(r, ms)) }

/**
 * Cierra la sesión local y avisa a la app con el motivo que mandó el backend
 * (`X-Account-Status` y `detail`), para que el login lo muestre.
 */
function terminarSesion(accountStatus, detail) {
  clearStoredSession()
  window.dispatchEvent(new CustomEvent('auth:session-expired', {
    detail: { accountStatus: accountStatus || null, message: detail || null },
  }))
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    token: providedToken,
    headers = {},
    retryOnUnauthorized = true,
    // Con `withTotal` devuelve { data, total }: `total` sale del encabezado X-Total-Count
    // de las listas paginadas (null si no viene).
    withTotal = false,
    // Para DELETE de ítems devuelve { data, orderTotal } desde X-Order-Total.
    withOrderTotal = false,
  } = options

  const token = providedToken || (await getSession()).access_token

  const makeRequest = async (authToken) => fetch(buildUrl(path), {
    method,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let response

  try {
    response = await makeRequest(token)
  } catch (networkErr) {
    // True network failure (offline, DNS, CORS, timeout) — no HTTP status
    const err = new Error('Sin conexión. Verificá tu red e intentá de nuevo.')
    err.isNetworkError = true
    err.originalError = networkErr
    window.dispatchEvent(new CustomEvent('api:network-error', {
      detail: { message: err.message, path, method },
    }))
    throw err
  }

  // T-66: un 503 sin X-Account-Status es temporal (el servidor no pudo
  // verificar la cuenta): nunca cierra la sesión. Un GET se reintenta una vez
  // después de Retry-After; un POST, PATCH o DELETE no se reintenta solo.
  if (response.status === 503 && method === 'GET' && !response.headers.get('X-Account-Status')) {
    await reloj.esperar(esperaRetryAfter(response))
    try {
      response = await makeRequest(token)
    } catch {
      /* se informa abajo como 503 */
    }
  }

  if (response.status === 401 && retryOnUnauthorized) {
    // Con X-Account-Status la sesión ya está cerrada o vencida (T-52): no
    // sirve renovar. Sin él, el access_token venció: se renueva una vez y se
    // reintenta (T-51).
    if (!response.headers.get('X-Account-Status')) {
      try {
        const refreshedSession = await getSession(true)
        response = await makeRequest(refreshedSession.access_token)
      } catch (authErr) {
        terminarSesion(authErr?.accountStatus, authErr?.detail)
        throw authErr
      }
    }
    if (response.status === 401) {
      const detail = await parseErrorResponse(response)
      const accountStatus = response.headers.get('X-Account-Status')
      terminarSesion(accountStatus, detail)
      const err = new Error(`401: ${detail}`)
      err.status = 401
      err.detail = detail
      if (accountStatus) err.accountStatus = accountStatus
      throw err
    }
  }

  if (!response.ok) {
    let detail = await parseErrorResponse(response)
    // T-66: textos claros para el 503 temporal y el límite de intentos (429:
    // el cuerpo trae `error`, no `detail`).
    if (response.status === 503 && !response.headers.get('X-Account-Status')) detail = MENSAJE_503
    if (response.status === 429) detail = MENSAJE_429
    const message = detail ? `${response.status}: ${detail}` : `${response.status} ${response.statusText}`
    const err = new Error(message)
    err.status = response.status
    err.detail = detail
    // Estado de la cuenta que manda el backend (X-Account-Status): con
    // `password_change_required` la app pasa a la pantalla de cambio de
    // clave obligatorio aunque la marca de /auth/me no haya llegado (T-62).
    const accountStatus = response.headers.get('X-Account-Status')
    if (accountStatus) {
      err.accountStatus = accountStatus
      if (response.status === 403 && accountStatus === 'password_change_required') {
        window.dispatchEvent(new CustomEvent('auth:password-change-required'))
      }
      // Cuenta desactivada o inexistente (tokens anteriores a las sesiones): se
      // cierra la sesión y el login lo explica (T-52).
      if (response.status === 403 && (accountStatus === 'inactive' || accountStatus === 'not_found')) {
        terminarSesion(accountStatus, detail)
      }
    }
    throw err
  }

  const contentType = response.headers.get('content-type') || ''
  const data = response.status === 204 || !contentType.includes('application/json') ? null : await response.json()

  if (withTotal) {
    const total = Number(response.headers.get('X-Total-Count'))
    return { data, total: response.headers.get('X-Total-Count') != null && Number.isFinite(total) ? total : null }
  }
  if (withOrderTotal) {
    const rawTotal = response.headers.get('X-Order-Total')
    const orderTotal = Number(rawTotal)
    return { data, orderTotal: rawTotal != null && Number.isFinite(orderTotal) ? orderTotal : null }
  }
  return data
}

function mapRoleToV2(role) {
  const raw = String(role || '').trim()
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_')
  const aliases = {
    EMPLEADO: 'EMPLEADO',
    EMPLEADA: 'EMPLEADO',
    CAJERO: 'EMPLEADO',
    CAJERA: 'EMPLEADO',
    ADMIN: 'ADMIN',
    ADMIN_NEGOCIO: 'ADMIN_NEGOCIO',
    SUPERADMIN: 'SUPERADMIN',
  }
  if (aliases[upper]) return aliases[upper]
  const lower = raw.toLowerCase()
  if (lower === 'empleado' || lower === 'cajero') return 'EMPLEADO'
  if (lower === 'admin') return 'ADMIN'
  return upper || 'EMPLEADO'
}

function displayNameFromUser(u) {
  const completo = [u?.first_name, u?.last_name].map((s) => String(s || '').trim()).filter(Boolean).join(' ')
  if (completo) return completo
  if (u?.name) return u.name
  // Sin nombre cargado: el mismo que muestran Configuración y el menú ("centro.admin" → "Centro Admin").
  const email = String(u?.email || '')
  if (!email) return '—'
  const local = email.split('@')[0] || ''
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || email
}

/**
 * V2: POST /users. El nombre viaja como first_name/last_name (antes se
 * descartaba y el usuario quedaba sin nombre). `rut` solo se envía si viene:
 * el alta lo agrega cuando la bandera `userRut` está encendida (ver B-04).
 */
export async function createUser({ first_name, last_name, rut, email, password, role, local_id, business_id }) {
  let resolvedBusinessId = business_id || null
  if (!resolvedBusinessId && local_id) {
    const local = await apiRequest(`/locals/${local_id}`)
    resolvedBusinessId = local?.business_id || null
  }
  return apiRequest('/users', {
    method: 'POST',
    body: {
      email,
      password,
      role: mapRoleToV2(role),
      local_id: local_id || null,
      business_id: resolvedBusinessId,
      first_name: first_name || null,
      last_name: last_name || null,
      ...(rut ? { rut } : {}),
    },
  })
}

export async function listUsers(businessId) {
  const rows = await apiRequest('/users')
  const list = Array.isArray(rows) ? rows : []
  const filtered = businessId
    ? list.filter((u) => String(u.business_id || '') === String(businessId))
    : list
  return filtered.map((u) => ({ ...u, name: displayNameFromUser(u) }))
}

/** El negocio, guardado en memoria 5 minutos (T-35): se pedía en cada pantalla. */
export async function getBusiness(businessId) {
  if (!businessId) return null
  return cachedRequest(`business:${businessId}`, () => apiRequest(`/businesses/${businessId}`), 5 * 60 * 1000)
}

export async function changeMyPassword({ current_password, new_password }) {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: { current_password, new_password },
  })
}

// ─── Comandas ─────────────────────────────────────────────────────────────────
// La comanda y la boleta se piden a `/orders/{id}/comanda` y `/orders/{id}/
// boleta` (ver salesApi) y se imprimen desde el navegador (ver ticketPrint).
// Las funciones que llamaban a `/comandas/{id}/print`, `/reprint` y `/prints`
// se retiraron: esos endpoints no existen en Backend V2.

// ─── Split Payments / Pago Multi-Comensal (OP-03) ─────────────────────────────

export async function createSplitPayment(orderId, { comensal_label, amount, payment_method, notes }) {
  return apiRequest(`/orders/${orderId}/split-payments`, {
    method: 'POST',
    body: { comensal_label, amount, payment_method, notes },
  })
}

export async function listSplitPayments(orderId) {
  return apiRequest(`/orders/${orderId}/split-payments`)
}

export async function getSplitPaymentSummary(orderId) {
  return apiRequest(`/orders/${orderId}/split-payments/summary`)
}

export async function updateSplitPayment(splitId, updates) {
  return apiRequest(`/split-payments/${splitId}`, { method: 'PATCH', body: updates })
}

export async function deleteSplitPayment(splitId) {
  return apiRequest(`/split-payments/${splitId}`, { method: 'DELETE' })
}

// ─── Cobro con tarjeta ───────────────────────────────────────────────────────
// Vive en lib/cobroTarjeta.js (T-76): Mercado Pago Point o el punto único
// `/payments/card`, según la bandera `cobroTarjetaUnificado`.

// El listado de lectores y el cambio de modo viven en lectoresApi: el
// inventario sale de `/pos-machines` y el modo de `/payments/point/devices/
// {mp_pos_id}/mode`. `GET /payments/point/devices` no existe en Backend V2.
