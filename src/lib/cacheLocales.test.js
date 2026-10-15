/** Locales y negocios en memoria (T-35). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { invalidate } from './apiCache'
import { invalidarLocales, obtenerLocal, obtenerLocales } from './cacheLocales'
import { actualizarLocal } from './localsApi'
import { clearStoredSession } from './authClient'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn(), getBusiness: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  invalidate()
  apiRequest.mockResolvedValue([{ id: 'l1' }])
})

describe('cacheLocales', () => {
  it('pide /locals una sola vez aunque varias pantallas lo pidan a la vez', async () => {
    await Promise.all([obtenerLocales('/locals?business_id=b1'), obtenerLocales('/locals?business_id=b1')])
    await obtenerLocales('/locals?business_id=b1')
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it('editar un local invalida lo guardado', async () => {
    await obtenerLocal('l1')
    apiRequest.mockResolvedValue({})
    await actualizarLocal('l1', { name: 'Centro' })
    apiRequest.mockResolvedValue({ id: 'l1', name: 'Centro' })
    await obtenerLocal('l1')
    expect(apiRequest.mock.calls.filter(([r, o]) => r === '/locals/l1' && !o).length).toBe(2)
  })

  it('invalidarLocales obliga a pedir de nuevo', async () => {
    await obtenerLocales('/locals')
    invalidarLocales()
    await obtenerLocales('/locals')
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })

  it('cerrar sesión limpia el caché', async () => {
    await obtenerLocales('/locals')
    clearStoredSession()
    await obtenerLocales('/locals')
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })
})
