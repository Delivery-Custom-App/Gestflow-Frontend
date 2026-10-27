/** #172: los errores se muestran sin el código HTTP delante y con los mensajes técnicos en palabras simples. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, mensajeParaPersona } from './apiClient'
import { MENSAJE_SIN_CONEXION, loginWithPassword } from './authClient'

function respuesta(status, body, statusText = '') {
  return {
    ok: status < 400,
    status,
    statusText,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: () => Promise.resolve(body),
  }
}

beforeEach(() => {
  window.localStorage.setItem('gestflow-auth-token', 'tok')
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('apiRequest · el error que ve la persona (#172)', () => {
  it('el mensaje es el texto del backend, sin «400: »; el código y el texto siguen en status y detail', async () => {
    fetch.mockResolvedValue(respuesta(400, { detail: 'El producto no está activo en este local' }))
    const err = await apiRequest('/orders', { method: 'POST', body: {} }).catch((e) => e)
    expect(err.message).toBe('El producto no está activo en este local')
    expect(err.status).toBe(400)
    expect(err.detail).toBe('El producto no está activo en este local')
  })

  it('el 409 de la clave de idempotencia se dice en palabras simples', async () => {
    fetch.mockResolvedValue(respuesta(409, { detail: 'Esa Idempotency-Key ya se usó con otra operación u otros datos' }))
    const err = await apiRequest('/orders', { method: 'POST', body: {} }).catch((e) => e)
    expect(err.message).toBe('Esta operación ya se había enviado con otros datos. Vuelve a intentarlo: se enviará como una nueva.')
    expect(err.status).toBe(409)
  })

  it('sin texto del backend dice que no se pudo, con el código entre paréntesis', () => {
    expect(mensajeParaPersona(500, '', 'Internal Server Error')).toBe('No se pudo completar la operación (error 500 Internal Server Error).')
    expect(mensajeParaPersona(404, '409: ya venía con código')).toBe('ya venía con código')
  })
})

describe('sin respuesta del servidor (#172)', () => {
  it('el login dice que no hay conexión, no «Failed to fetch»', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await loginWithPassword({ email: 'a@b.cl', password: 'x' }).catch((e) => e)
    expect(err.message).toBe(MENSAJE_SIN_CONEXION)
    expect(err.isNetworkError).toBe(true)
  })

  it('las demás pantallas muestran el mismo mensaje', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await apiRequest('/tables').catch((e) => e)
    expect(err.message).toBe(MENSAJE_SIN_CONEXION)
    expect(err.isNetworkError).toBe(true)
  })
})
