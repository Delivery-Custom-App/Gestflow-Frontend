import { clearStoredSession, getStoredSession, refreshSession } from './authClient'
import { getBusinessId } from '../utils/jwt'

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

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    token: providedToken,
    headers = {},
    retryOnUnauthorized = true,
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

  if (response.status === 401 && retryOnUnauthorized) {
    try {
      const refreshedSession = await getSession(true)
      response = await makeRequest(refreshedSession.access_token)
    } catch (authErr) {
      clearStoredSession()
      window.dispatchEvent(new CustomEvent('auth:session-expired'))
      throw authErr
    }
  }

  if (!response.ok) {
    const detail = await parseErrorResponse(response)
    const message = detail ? `${response.status}: ${detail}` : `${response.status} ${response.statusText}`
    const err = new Error(message)
    err.status = response.status
    err.detail = detail
    throw err
  }

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return null
  }

  return response.json()
}

export async function createUser({ name, email, password, role, local_id, business_id }) {
  return apiRequest('/auth/admin/create-user', {
    method: 'POST',
    body: { name, email, password, role, local_id: local_id || null, business_id: business_id || null },
  })
}

export async function listUsers(businessId) {
  return apiRequest(businessId ? `/users?business_id=${businessId}` : '/users')
}

export async function deleteUser(id) {
  return apiRequest(`/users/${id}`, { method: 'DELETE' })
}

// ─── Printers (OP-02) ─────────────────────────────────────────────────────────

export async function listPrinters(localId) {
  return apiRequest(`/printers?local_id=${localId}`)
}

export async function createPrinter({ local_id, name, model, ip_address, port, is_active }) {
  return apiRequest('/printers', {
    method: 'POST',
    body: { local_id, name, model, ip_address, port: Number(port), is_active },
  })
}

export async function updatePrinter(id, updates) {
  return apiRequest(`/printers/${id}`, { method: 'PATCH', body: updates })
}

export async function deletePrinter(id) {
  return apiRequest(`/printers/${id}`, { method: 'DELETE' })
}

export async function testPrinterConnection(id) {
  return apiRequest(`/printers/${id}/test`, { method: 'POST' })
}

// ─── Comandas (OP-02) ─────────────────────────────────────────────────────────

export async function printComanda(orderId, printerConfigId = null) {
  return apiRequest(`/comandas/${orderId}/print`, {
    method: 'POST',
    body: printerConfigId ? { printer_config_id: printerConfigId } : {},
  })
}

export async function reprintComanda(orderId, printerConfigId = null) {
  return apiRequest(`/comandas/${orderId}/reprint`, {
    method: 'POST',
    body: printerConfigId ? { printer_config_id: printerConfigId } : {},
  })
}

export async function getComandaPrints(orderId) {
  return apiRequest(`/comandas/${orderId}/prints`)
}

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

// ─── MercadoPago Point Smart 2 — In-Store Orders API (Chile) ────────────────

/** Envía el cobro de una orden a la terminal Point Smart 2. */
export async function createPointCharge(orderId, body = {}) {
  return apiRequest(`/payments/point/orders/${orderId}/charge`, {
    method: 'POST',
    body,
  })
}

/**
 * Polling de estado: consulta nuestra BD (actualizada por el webhook de MP).
 * Devuelve { order_id, order_status, payment_status, payment_method }.
 */
export async function getPointOrderStatus(orderId) {
  return apiRequest(`/payments/point/orders/${orderId}/status`)
}

/** Cancela la orden pendiente en la terminal (libera la pantalla del dispositivo). */
export async function cancelPointCharge(orderId) {
  return apiRequest(`/payments/point/orders/${orderId}/charge`, { method: 'DELETE' })
}

/** Lista las terminales Point vinculadas a la cuenta de MercadoPago. */
export async function listPointDevices() {
  return apiRequest('/payments/point/devices')
}

/** Cambia el modo de operación del terminal entre PDV y STANDALONE. */
export async function setPointDeviceMode(deviceId, operatingMode) {
  return apiRequest(`/payments/point/devices/${deviceId}/mode`, {
    method: 'PATCH',
    body: { operating_mode: operatingMode },
  })
}
