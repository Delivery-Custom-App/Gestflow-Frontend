/** apiRequest con `withTotal`: devuelve { data, total } leyendo X-Total-Count (listas paginadas). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest } from './apiClient'

function respuesta(body, headers = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: (k) => ({ 'content-type': 'application/json', ...headers })[k.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
  }
}

beforeEach(() => {
  window.localStorage.setItem('gestflow-auth-token', 'tok')
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('apiRequest · withTotal', () => {
  it('sin la opción devuelve solo el cuerpo, como siempre', async () => {
    fetch.mockResolvedValue(respuesta([{ id: 1 }], { 'x-total-count': '30' }))
    expect(await apiRequest('/x')).toEqual([{ id: 1 }])
  })

  it('con la opción devuelve el cuerpo y el total del encabezado', async () => {
    fetch.mockResolvedValue(respuesta([{ id: 1 }], { 'x-total-count': '30' }))
    expect(await apiRequest('/x', { withTotal: true })).toEqual({ data: [{ id: 1 }], total: 30 })
  })

  it('si el encabezado no viene, el total es null', async () => {
    fetch.mockResolvedValue(respuesta([]))
    expect(await apiRequest('/x', { withTotal: true })).toEqual({ data: [], total: null })
  })
})
