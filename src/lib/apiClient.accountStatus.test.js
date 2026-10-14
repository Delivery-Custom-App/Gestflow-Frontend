/** apiRequest y X-Account-Status: el 403 `password_change_required` pide el cambio de clave (T-62). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest } from './apiClient'

function respuesta(status, body, headers = {}) {
  const h = { 'content-type': 'application/json', ...headers }
  return {
    ok: status < 400,
    status,
    statusText: '',
    headers: { get: (k) => h[k.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
  }
}

let eventos
const escuchar = (e) => eventos.push(e.type)

beforeEach(() => {
  eventos = []
  window.localStorage.setItem('gestflow-auth-token', 'tok')
  vi.stubGlobal('fetch', vi.fn())
  window.addEventListener('auth:password-change-required', escuchar)
})
afterEach(() => {
  window.removeEventListener('auth:password-change-required', escuchar)
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('apiRequest · X-Account-Status', () => {
  it('un 403 password_change_required avisa a la app y deja el estado en el error', async () => {
    fetch.mockResolvedValue(respuesta(403, { detail: 'Debes cambiar tu contraseña' }, { 'x-account-status': 'password_change_required' }))
    const err = await apiRequest('/orders').catch((e) => e)
    expect(err.status).toBe(403)
    expect(err.accountStatus).toBe('password_change_required')
    expect(eventos).toEqual(['auth:password-change-required'])
  })

  it('un 403 sin ese estado no lo hace', async () => {
    fetch.mockResolvedValue(respuesta(403, { detail: 'No autorizado' }))
    const err = await apiRequest('/orders').catch((e) => e)
    expect(err.accountStatus).toBeUndefined()
    expect(eventos).toEqual([])
  })
})
