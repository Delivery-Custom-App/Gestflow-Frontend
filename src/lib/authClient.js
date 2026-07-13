const TOKEN_KEY = 'gestflow-auth-token'
const REFRESH_TOKEN_KEY = 'gestflow-refresh-token'
const USER_KEY = 'gestflow-auth-user'

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

function writeSession({ access_token, refresh_token, user }) {
  if (typeof window === 'undefined') return

  if (access_token) window.localStorage.setItem(TOKEN_KEY, access_token)
  if (refresh_token) window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(REFRESH_TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

export function getStoredSession() {
  if (typeof window === 'undefined') return null

  const accessToken = window.localStorage.getItem(TOKEN_KEY)
  if (!accessToken) return null

  return {
    access_token: accessToken,
    refresh_token: window.localStorage.getItem(REFRESH_TOKEN_KEY),
    user: readJson(USER_KEY),
  }
}

async function parseAuthResponse(response) {
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(json?.detail || json?.message || response.statusText || 'Error de autenticacion')
  }

  const session = json.session || json
  const accessToken = session.access_token || session.token
  if (!accessToken) {
    throw new Error('El backend no devolvio access_token')
  }

  return {
    access_token: accessToken,
    refresh_token: session.refresh_token || null,
    user: session.user || json.user || null,
  }
}

export async function loginWithPassword({ email, password }) {
  const response = await fetch(buildUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const session = await parseAuthResponse(response)
  writeSession(session)
  return session
}

export async function refreshSession() {
  const current = getStoredSession()
  if (!current?.refresh_token) return null

  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
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
      await fetch(buildUrl('/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    }
  } finally {
    clearStoredSession()
  }
}
