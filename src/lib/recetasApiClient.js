import { apiRequest } from './apiClient'

// SEC-04: si VITE_RECETAS_API_URL no está definida, se usa la URL del backend
// principal (VITE_API_URL) en lugar de quedar vacía. Antes, al quedar vacía, las
// llamadas iban al dominio actual (sin el endpoint) y rompían el módulo de recetas.
// Las recetas las sirve el mismo monolito, por lo que el fallback es correcto.
const recetasBaseUrl =
  import.meta.env.VITE_RECETAS_API_URL || import.meta.env.VITE_API_URL || ''

function buildRecetasUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${recetasBaseUrl}/api${normalizedPath}`
}

/**
 * Peticiones al microservicio de recetas (misma auth Supabase que apiClient).
 */
export async function recetasApiRequest(path, options = {}) {
  const { method = 'GET', body, token: providedToken, headers = {}, retryOnUnauthorized = true } = options

  const getToken = async () => {
    const { getAuthContext } = await import('./apiClient')
    const ctx = await getAuthContext()
    return ctx.token
  }

  const token = providedToken || (await getToken())

  const makeRequest = async (authToken) =>
    fetch(buildRecetasUrl(path), {
      method,
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

  let response = await makeRequest(token)

  if (response.status === 401 && retryOnUnauthorized) {
    const { supabase } = await import('./supabaseClient')
    if (supabase) {
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data.session?.access_token) {
        response = await makeRequest(data.session.access_token)
      }
    }
  }

  if (!response.ok) {
    const { formatApiErrorDetail } = await import('./apiClient')
    const contentType = response.headers.get('content-type') || ''
    let detail = response.statusText
    if (contentType.includes('application/json')) {
      try {
        const json = await response.json()
        detail = formatApiErrorDetail(json?.detail) || detail
      } catch {
        /* ignore */
      }
    }
    const err = new Error(`${response.status}: ${detail}`)
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
