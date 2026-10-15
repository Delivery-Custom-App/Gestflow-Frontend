/** Mensaje claro cuando se cierra la sesión (T-52). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest } from './apiClient'
import { clearStoredSession, getStoredSession, loginWithPassword } from './authClient'
import { MENSAJE_SESION_EXPIRADA, mensajeDeCierre } from './sesiones'

function resp(status, body, headers = {}) {
  const h = { 'content-type': 'application/json', ...headers }
  return { ok: status < 400, status, statusText: '', headers: { get: (k) => h[k.toLowerCase()] ?? null }, json: () => Promise.resolve(body) }
}

describe('mensajeDeCierre', () => {
  it('session_revoked muestra el motivo del backend', () => {
    expect(mensajeDeCierre({ accountStatus: 'session_revoked', message: 'El administrador cerró tu sesión. Motivo: Perdió el celular' }))
      .toBe('El administrador cerró tu sesión. Motivo: Perdió el celular')
  })
  it('session_expired: venció por inactividad', () => {
    expect(mensajeDeCierre({ accountStatus: 'session_expired', message: 'x' })).toMatch(/Tu sesión venció por inactividad/)
  })
  it('inactive: cuenta desactivada', () => {
    expect(mensajeDeCierre({ accountStatus: 'inactive' })).toMatch(/Tu cuenta está desactivada/)
  })
  it('sin estado: el mensaje de siempre', () => {
    expect(mensajeDeCierre({})).toBe(MENSAJE_SESION_EXPIRADA)
    expect(mensajeDeCierre()).toBe(MENSAJE_SESION_EXPIRADA)
  })
})

describe('apiRequest ante una sesión cerrada', () => {
  let eventos
  const guardar = (e) => eventos.push(e.detail)

  beforeEach(async () => {
    eventos = []
    window.localStorage.clear()
    clearStoredSession()
    window.addEventListener('auth:session-expired', guardar)
    vi.stubGlobal('fetch', vi.fn())
    fetch.mockResolvedValueOnce(resp(200, { access_token: 'AT1', refresh_token: 'RT1', user: { id: 'u' } }))
    await loginWithPassword({ email: 'a@a.cl', password: 'x' })
    fetch.mockReset()
  })
  afterEach(() => {
    window.removeEventListener('auth:session-expired', guardar)
    vi.unstubAllGlobals()
  })

  it('401 session_revoked: no intenta renovar, cierra y avisa con el motivo', async () => {
    fetch.mockResolvedValue(resp(401, { detail: 'El administrador cerró tu sesión. Motivo: Perdió el celular' }, { 'x-account-status': 'session_revoked' }))
    const err = await apiRequest('/orders').catch((e) => e)
    expect(err.status).toBe(401)
    expect(err.accountStatus).toBe('session_revoked')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(getStoredSession()).toBeNull()
    expect(eventos).toEqual([{ accountStatus: 'session_revoked', message: 'El administrador cerró tu sesión. Motivo: Perdió el celular' }])
  })

  it('401 session_expired: avisa con ese estado', async () => {
    fetch.mockResolvedValue(resp(401, { detail: 'Tu sesión venció por inactividad. Vuelve a iniciar sesión.' }, { 'x-account-status': 'session_expired' }))
    await apiRequest('/orders').catch(() => {})
    expect(eventos[0].accountStatus).toBe('session_expired')
  })

  it('403 inactive: cierra la sesión y avisa', async () => {
    fetch.mockResolvedValue(resp(403, { detail: 'Cuenta desactivada' }, { 'x-account-status': 'inactive' }))
    await apiRequest('/orders').catch(() => {})
    expect(getStoredSession()).toBeNull()
    expect(eventos).toEqual([{ accountStatus: 'inactive', message: 'Cuenta desactivada' }])
  })

  it('403 password_change_required no cierra la sesión (lleva al cambio de clave)', async () => {
    fetch.mockResolvedValue(resp(403, { detail: 'Debe cambiar su contraseña' }, { 'x-account-status': 'password_change_required' }))
    await apiRequest('/orders').catch(() => {})
    expect(getStoredSession()).not.toBeNull()
    expect(eventos).toEqual([])
  })

  it('un 403 común no cierra nada', async () => {
    fetch.mockResolvedValue(resp(403, { detail: 'No autorizado' }))
    await apiRequest('/orders').catch(() => {})
    expect(getStoredSession()).not.toBeNull()
    expect(eventos).toEqual([])
  })
})
