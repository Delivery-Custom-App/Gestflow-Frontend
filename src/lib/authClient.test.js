import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cambiarLocalActivo, clearStoredSession, getStoredSession, loginWithPassword, refreshSession } from './authClient'

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: () => Promise.resolve(body) }
}

describe('authClient — refresh_token no persiste en localStorage', () => {
  let store

  beforeEach(() => {
    store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('login guarda access_token/user en localStorage pero NO refresh_token', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ access_token: 'AT1', refresh_token: 'RT1', user: { id: 1 } })
    )

    const session = await loginWithPassword({ email: 'a@a.com', password: 'x' })

    expect(session.refresh_token).toBe('RT1')
    expect(store.get('gestflow-auth-token')).toBe('AT1')
    expect(store.has('gestflow-refresh-token')).toBe(false)
    expect(Array.from(store.keys())).not.toContain('gestflow-refresh-token')

    // getStoredSession sigue devolviendo el refresh_token (desde memoria, no localStorage)
    expect(getStoredSession().refresh_token).toBe('RT1')
  })

  it('clearStoredSession borra el refresh_token en memoria (no queda residuo entre sesiones)', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ access_token: 'AT1', refresh_token: 'RT1', user: { id: 1 } })
    )
    await loginWithPassword({ email: 'a@a.com', password: 'x' })
    expect(getStoredSession().refresh_token).toBe('RT1')

    clearStoredSession()
    expect(getStoredSession()).toBeNull()

    // Nueva sesión sin refresh_token: no debe heredar el RT1 anterior
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: 'AT2', user: { id: 1 } }))
    await loginWithPassword({ email: 'a@a.com', password: 'x' })
    expect(getStoredSession().refresh_token).toBeNull()
  })

  it('refreshSession sin endpoint (404, Backend V2) mantiene la sesión actual sin romper', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ access_token: 'AT1', refresh_token: 'RT1', user: { id: 1 } })
    )
    await loginWithPassword({ email: 'a@a.com', password: 'x' })

    fetch.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 404 }))
    const result = await refreshSession()

    expect(result.access_token).toBe('AT1')
    expect(store.has('gestflow-refresh-token')).toBe(false)
  })
})

describe('authClient — cambiar de local activo (T-73)', () => {
  let store

  beforeEach(() => {
    store = new Map([['gestflow-auth-token', 'TOKEN-LOCAL-A']])
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    })
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pide POST /auth/switch-local con el token actual y guarda el token nuevo en su lugar', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: 'TOKEN-LOCAL-B', refresh_token: 'RT-B', token_type: 'bearer' }))

    await cambiarLocalActivo('loc-b')

    const [url, opciones] = fetch.mock.calls[0]
    expect(url).toMatch(/\/api\/auth\/switch-local$/)
    expect(opciones.method).toBe('POST')
    expect(opciones.headers.Authorization).toBe('Bearer TOKEN-LOCAL-A')
    expect(JSON.parse(opciones.body)).toEqual({ local_id: 'loc-b' })
    // Las peticiones siguientes salen con el token del local nuevo.
    expect(store.get('gestflow-auth-token')).toBe('TOKEN-LOCAL-B')
    expect(getStoredSession().access_token).toBe('TOKEN-LOCAL-B')
  })

  it('si el backend lo rechaza (403 no asignado) no toca el token', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ detail: 'No estás asignado a ese local' }, { ok: false, status: 403 }))

    await expect(cambiarLocalActivo('loc-x')).rejects.toThrow('No estás asignado a ese local')
    expect(store.get('gestflow-auth-token')).toBe('TOKEN-LOCAL-A')
  })

  it('sin sesión no llama al backend', async () => {
    store.clear()
    await expect(cambiarLocalActivo('loc-b')).rejects.toThrow('No hay una sesión abierta')
    expect(fetch).not.toHaveBeenCalled()
  })
})
