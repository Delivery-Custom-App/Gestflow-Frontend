/** apiRequest ante 503 temporal y 429 de límite de intentos (T-66). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, esperaRetryAfter, reloj, MENSAJE_503, MENSAJE_429 } from './apiClient'
import { loginWithPassword } from './authClient'

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

let expiradas
const escuchar = () => { expiradas += 1 }

beforeEach(() => {
  expiradas = 0
  window.localStorage.setItem('gestflow-auth-token', 'tok')
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(reloj, 'esperar').mockResolvedValue()
  window.addEventListener('auth:session-expired', escuchar)
})
afterEach(() => {
  window.removeEventListener('auth:session-expired', escuchar)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('apiRequest · 503 temporal', () => {
  it('un GET se reintenta una vez después de Retry-After y devuelve la respuesta buena', async () => {
    fetch
      .mockResolvedValueOnce(respuesta(503, { detail: 'x' }, { 'retry-after': '3' }))
      .mockResolvedValueOnce(respuesta(200, [{ id: 1 }]))
    expect(await apiRequest('/orders')).toEqual([{ id: 1 }])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(reloj.esperar).toHaveBeenCalledWith(3000)
    expect(expiradas).toBe(0)
    expect(window.localStorage.getItem('gestflow-auth-token')).toBe('tok')
  })

  it('si el GET vuelve a dar 503 muestra «Reintenta en unos segundos» y no cierra la sesión', async () => {
    fetch.mockResolvedValue(respuesta(503, { detail: 'Service unavailable' }, { 'retry-after': '2' }))
    const err = await apiRequest('/orders').catch((e) => e)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(err.status).toBe(503)
    expect(err.detail).toBe(MENSAJE_503)
    expect(err.message).toMatch(/Reintenta en unos segundos/)
    expect(expiradas).toBe(0)
    expect(window.localStorage.getItem('gestflow-auth-token')).toBe('tok')
  })

  it.each(['POST', 'PATCH', 'DELETE'])('un %s no se reintenta solo', async (method) => {
    fetch.mockResolvedValue(respuesta(503, {}, { 'retry-after': '1' }))
    const err = await apiRequest('/orders', { method, body: { a: 1 } }).catch((e) => e)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(reloj.esperar).not.toHaveBeenCalled()
    expect(err.detail).toBe(MENSAJE_503)
    expect(expiradas).toBe(0)
  })

  it('Retry-After: 5 s si no viene y máximo 10 s', () => {
    expect(esperaRetryAfter(respuesta(503, {}))).toBe(5000)
    expect(esperaRetryAfter(respuesta(503, {}, { 'retry-after': '120' }))).toBe(10000)
  })
})

describe('429 · demasiados intentos', () => {
  it('apiRequest (cambio de clave) muestra «Demasiados intentos» aunque el cuerpo traiga `error`', async () => {
    fetch.mockResolvedValue(respuesta(429, { error: 'Rate limit exceeded: 5 per 1 minute' }))
    const err = await apiRequest('/auth/change-password', { method: 'POST', body: {} }).catch((e) => e)
    expect(err.status).toBe(429)
    expect(err.detail).toBe(MENSAJE_429)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(expiradas).toBe(0)
  })

  it('el login muestra «Demasiados intentos, espera un minuto»', async () => {
    fetch.mockResolvedValue(respuesta(429, { error: 'Rate limit exceeded: 5 per 1 minute' }))
    await expect(loginWithPassword({ email: 'a@a.cl', password: 'x' })).rejects.toThrow('Demasiados intentos, espera un minuto.')
  })
})
