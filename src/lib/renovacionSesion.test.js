/**
 * Renovación automática de la sesión (T-51): una sola renovación aunque fallen
 * varias peticiones a la vez, el refresh_token nuevo se guarda, y si la
 * renovación responde 401 se cierra la sesión con el motivo del backend.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest } from './apiClient'
import { clearStoredSession, getStoredSession, loginWithPassword, refreshSession } from './authClient'

function resp(status, body, headers = {}) {
  const h = { 'content-type': 'application/json', ...headers }
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: { get: (k) => h[k.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
  }
}

const rutaDe = (url) => String(url).replace(/^.*\/api/, '')
let eventos

beforeEach(async () => {
  window.localStorage.clear()
  clearStoredSession()
  eventos = []
  window.addEventListener('auth:session-expired', guardar)
  vi.stubGlobal('fetch', vi.fn())
  fetch.mockResolvedValueOnce(resp(200, { access_token: 'AT1', refresh_token: 'RT1', expires_in: 3600, user: { id: 'u1' } }))
  await loginWithPassword({ email: 'a@a.cl', password: 'x' })
  fetch.mockReset()
})
afterEach(() => {
  window.removeEventListener('auth:session-expired', guardar)
  vi.unstubAllGlobals()
})
function guardar(e) { eventos.push(e.detail) }

describe('login', () => {
  it('guarda refresh_token y el vencimiento (expires_in)', () => {
    const s = getStoredSession()
    expect(s.refresh_token).toBe('RT1')
    expect(s.expires_at).toBeGreaterThan(Date.now())
    expect(window.localStorage.getItem('gestflow-refresh-token')).toBeNull()
  })
})

describe('renovación', () => {
  it('3 peticiones con 401 a la vez → 1 sola llamada a /auth/refresh, y las 3 se reintentan con el token nuevo', async () => {
    let refrescos = 0
    fetch.mockImplementation(async (url, init) => {
      const ruta = rutaDe(url)
      if (ruta === '/auth/refresh') {
        refrescos += 1
        await new Promise((r) => setTimeout(r, 10))
        return resp(200, { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600 })
      }
      return init.headers.Authorization === 'Bearer AT2' ? resp(200, { ruta }) : resp(401, { detail: 'Token expirado' })
    })

    const r = await Promise.all([apiRequest('/a'), apiRequest('/b'), apiRequest('/c')])
    expect(r).toEqual([{ ruta: '/a' }, { ruta: '/b' }, { ruta: '/c' }])
    expect(refrescos).toBe(1)
    expect(getStoredSession().access_token).toBe('AT2')
    expect(getStoredSession().refresh_token).toBe('RT2')
  })

  it('manda el refresh_token vigente y guarda siempre el nuevo', async () => {
    fetch.mockResolvedValueOnce(resp(200, { access_token: 'AT2', refresh_token: 'RT2' }))
    await refreshSession()
    fetch.mockResolvedValueOnce(resp(200, { access_token: 'AT3', refresh_token: 'RT3' }))
    await refreshSession()
    const enviados = fetch.mock.calls.map(([, init]) => JSON.parse(init.body).refresh_token)
    expect(enviados).toEqual(['RT1', 'RT2'])
    expect(getStoredSession().refresh_token).toBe('RT3')
  })

  it('si la renovación responde 401, cierra la sesión y avisa con el detail', async () => {
    fetch.mockImplementation(async (url) => (rutaDe(url) === '/auth/refresh'
      ? resp(401, { detail: 'Token de renovación inválido o expirado' }, { 'x-account-status': 'session_revoked' })
      : resp(401, { detail: 'Token expirado' })))

    await expect(apiRequest('/orders')).rejects.toThrow('Token de renovación inválido o expirado')
    expect(getStoredSession()).toBeNull()
    expect(eventos).toEqual([{ accountStatus: 'session_revoked', message: 'Token de renovación inválido o expirado' }])
  })

  it('un fallo de red o un 5xx al renovar no cierra la sesión', async () => {
    fetch.mockResolvedValueOnce(resp(503, {}))
    await expect(refreshSession()).resolves.toMatchObject({ access_token: 'AT1' })
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(refreshSession()).resolves.toMatchObject({ access_token: 'AT1' })
    expect(getStoredSession()).not.toBeNull()
  })
})
