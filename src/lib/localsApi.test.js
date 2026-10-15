/**
 * Borrado de local: el front pedía `/locals/{id}/deletion-summary` y
 * `DELETE /locals/{id}/cascade`, que devuelven 404. El borrado en cascada es el
 * `DELETE /locals/{id}` simple, y el backend exige desactivar antes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { SE_CONSERVA, SE_ELIMINA, eliminarLocal, getResumenBorradoLocal, mapLocalOut } from './localsApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const rutas = () => apiRequest.mock.calls.map(([p]) => String(p))

describe('Borrado de un local', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequest.mockResolvedValue([])
  })

  it('no usa las rutas inexistentes de resumen ni de cascada', async () => {
    await getResumenBorradoLocal('loc-1')
    await eliminarLocal('loc-1')

    expect(rutas().some((p) => p.includes('deletion-summary'))).toBe(false)
    expect(rutas().some((p) => p.includes('/cascade'))).toBe(false)
  })

  it('cuenta mesas y cajas físicas, que son los listados que sí filtran por local', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/mesas')) return Promise.resolve([{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }])
      if (path.startsWith('/cajas-fisicas')) return Promise.resolve([{ id: 'cf1' }])
      if (path.startsWith('/cajas')) return Promise.resolve([])
      return Promise.resolve([])
    })

    const resumen = await getResumenBorradoLocal('loc-1')

    expect(resumen.conteos).toEqual({ mesas: 3, cajas_fisicas: 1 })
    expect(resumen.se_elimina).toEqual(SE_ELIMINA)
    expect(resumen.se_conserva).toEqual(SE_CONSERVA)
  })

  it('avisa si quedan turnos de caja abiertos, que el backend rechaza', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/cajas?')) {
        return Promise.resolve([
          { id: 'c1', status: 'open' },
          { id: 'c2', status: 'closed' },
        ])
      }
      return Promise.resolve([])
    })

    const resumen = await getResumenBorradoLocal('loc-1')

    expect(resumen.turnosAbiertos).toBe(1)
  })

  it('si un conteo no se puede traer, se informa como desconocido en vez de cero', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/mesas')) return Promise.reject(new Error('403'))
      return Promise.resolve([])
    })

    const resumen = await getResumenBorradoLocal('loc-1')

    expect(resumen.conteos.mesas).toBeNull()
    expect(resumen.conteos.cajas_fisicas).toBe(0)
  })

  it('elimina en dos pasos: desactiva y después borra', async () => {
    apiRequest.mockResolvedValue(null)

    await eliminarLocal('loc-1')

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/locals/loc-1', {
      method: 'PATCH',
      body: { is_active: false },
    })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/locals/loc-1', { method: 'DELETE' })
  })

  it('si la desactivación falla no intenta borrar', async () => {
    apiRequest.mockRejectedValueOnce(new Error('403: No autorizado'))

    await expect(eliminarLocal('loc-1')).rejects.toThrow('403: No autorizado')
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })
})

describe('mapLocalOut — la ubicación guardada se muestra', () => {
  it('compone la dirección desde los campos del backend', () => {
    const local = mapLocalOut({ id: 'l1', street_name: '5 Norte 147', city_name: 'Viña del Mar', state_name: 'Valparaíso' })

    expect(local.address).toBe('5 Norte 147, Viña del Mar')
  })

  it('expone las coordenadas como las pide el mapa de franquicias', () => {
    const local = mapLocalOut({ id: 'l1', latitude: -33.017306, longitude: -71.5576 })

    expect(local.lat).toBe(-33.017306)
    expect(local.lng).toBe(-71.5576)
  })

  it('un local sin ubicación no finge tenerla', () => {
    const local = mapLocalOut({ id: 'l1' })

    expect(local.address).toBeNull()
    expect(local.lat).toBeNull()
    expect(local.lng).toBeNull()
  })

  it('con solo la calle, la dirección es la calle', () => {
    expect(mapLocalOut({ street_name: 'Errázuriz 1178' }).address).toBe('Errázuriz 1178')
  })
})
