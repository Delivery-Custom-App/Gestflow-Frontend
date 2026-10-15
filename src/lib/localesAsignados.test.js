/** Locales asignados a una persona (T-72): rutas, principal y qué se puede agregar. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  agregarLocal, asignarLocal, filasDeLocales, listarLocalesAsignados, localesParaAgregar,
  puedeTenerVariosLocales, quitarLocal,
} from './localesAsignados'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  apiRequest.mockResolvedValue({})
})

describe('rutas', () => {
  it('lista con GET /users/{id}/locals', async () => {
    apiRequest.mockResolvedValue([{ id: 'a1', local_id: 'loc-1' }])
    expect(await listarLocalesAsignados('u 1')).toEqual([{ id: 'a1', local_id: 'loc-1' }])
    expect(apiRequest).toHaveBeenCalledWith('/users/u%201/locals')
  })

  it('asigna con POST y el cuerpo del contrato', async () => {
    await asignarLocal('u-1', 'loc-2')
    expect(apiRequest).toHaveBeenCalledWith('/users/u-1/locals', { method: 'POST', body: { local_id: 'loc-2', is_primary: false } })
  })

  it('quita con DELETE /users/{id}/locals/{assignment_id}', async () => {
    await quitarLocal('u-1', 'a-9')
    expect(apiRequest).toHaveBeenCalledWith('/users/u-1/locals/a-9', { method: 'DELETE' })
  })

  it('sin datos no llama a la API', async () => {
    expect(await listarLocalesAsignados(null)).toEqual([])
    await expect(asignarLocal('u-1', null)).rejects.toThrow()
    await expect(quitarLocal('u-1', null)).rejects.toThrow()
    expect(apiRequest).not.toHaveBeenCalled()
  })
})

describe('agregarLocal', () => {
  it('con el principal sin asignar, primero lo asigna (marcado principal) y después el nuevo', async () => {
    await agregarLocal('u-1', 'loc-2', { localPrincipalId: 'loc-1', asignaciones: [] })
    expect(apiRequest.mock.calls.map(([, o]) => o.body)).toEqual([
      { local_id: 'loc-1', is_primary: true },
      { local_id: 'loc-2', is_primary: false },
    ])
  })

  it('con el principal ya asignado, solo asigna el nuevo', async () => {
    await agregarLocal('u-1', 'loc-3', { localPrincipalId: 'loc-1', asignaciones: [{ id: 'a1', local_id: 'loc-1' }] })
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenCalledWith('/users/u-1/locals', { method: 'POST', body: { local_id: 'loc-3', is_primary: false } })
  })

  it('el error del backend sube tal cual', async () => {
    apiRequest.mockRejectedValue(new Error('400: El usuario ya está asignado a este local'))
    await expect(agregarLocal('u-1', 'loc-2', { asignaciones: [] })).rejects.toThrow('El usuario ya está asignado a este local')
  })
})

describe('filas y opciones', () => {
  const nombreDe = (id) => ({ 'loc-1': 'Centro', 'loc-2': 'Mostrador', 'loc-3': 'Alameda' })[id]

  it('el principal va primero (aunque no tenga asignación) y el resto por nombre', () => {
    const filas = filasDeLocales(
      [{ id: 'a2', local_id: 'loc-2' }, { id: 'a3', local_id: 'loc-3' }],
      { localPrincipalId: 'loc-1', nombreDe },
    )
    expect(filas).toEqual([
      { localId: 'loc-1', nombre: 'Centro', principal: true, asignacionId: null },
      { localId: 'loc-3', nombre: 'Alameda', principal: false, asignacionId: 'a3' },
      { localId: 'loc-2', nombre: 'Mostrador', principal: false, asignacionId: 'a2' },
    ])
  })

  it('no ofrece agregar el principal ni los ya asignados', () => {
    const locales = [{ id: 'loc-1', name: 'Centro' }, { id: 'loc-2', name: 'Mostrador' }, { id: 'loc-3', name: 'Alameda' }]
    const opciones = localesParaAgregar(locales, [{ id: 'a2', local_id: 'loc-2' }], { localPrincipalId: 'loc-1' })
    expect(opciones.map((l) => l.id)).toEqual(['loc-3'])
  })

  it('solo el administrador de local y el empleado pueden tener varios locales', () => {
    expect(puedeTenerVariosLocales('ADMIN')).toBe(true)
    expect(puedeTenerVariosLocales('EMPLEADO')).toBe(true)
    expect(puedeTenerVariosLocales('ADMIN_NEGOCIO')).toBe(false)
    expect(puedeTenerVariosLocales('SUPERADMIN')).toBe(false)
  })
})
