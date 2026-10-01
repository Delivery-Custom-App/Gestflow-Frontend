/**
 * Mesas: el mapa mostraba datos que no eran reales.
 *
 * La capacidad venía del backend como `capacity` y el front leía `capacidad`,
 * así que siempre caía al valor por defecto de la tarjeta. El alta exigía
 * capacidad y zona, y las descartaba antes de enviar la petición. Y el total
 * del pedido en curso no se mostraba nunca.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { createMesa, listMesasConTotales, mapMesaOut, updateMesa } from './salesApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const rutas = () => apiRequest.mock.calls.map(([p]) => String(p))

describe('Mesas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequest.mockResolvedValue([])
  })

  it('lee la capacidad que entrega el backend, no un valor por defecto', () => {
    expect(mapMesaOut({ id: 'm1', nombre: 'Mesa 1', status: 'available', capacity: 6 }).capacidad).toBe(6)
  })

  it('sin capacidad registrada devuelve null en vez de inventar un número', () => {
    expect(mapMesaOut({ id: 'm1', nombre: 'Mesa 1', status: 'available', capacity: null }).capacidad).toBeNull()
  })

  it('no inventa zonas: el backend no las tiene', () => {
    expect(mapMesaOut({ id: 'm1', nombre: 'Mesa 1', status: 'available', zona: 'Terraza' }).zona).toBeNull()
  })

  it('crear una mesa guarda la capacidad en el backend', async () => {
    apiRequest.mockResolvedValue({ id: 'm1', nombre: 'Mesa 5', status: 'available', capacity: 8 })

    const mesa = await createMesa({ local_id: 'loc-1', name: 'Mesa 5', capacidad: '8' })

    expect(apiRequest).toHaveBeenCalledWith('/mesas', {
      method: 'POST',
      body: { local_id: 'loc-1', nombre: 'Mesa 5', status: 'available', capacity: 8 },
    })
    expect(mesa.capacidad).toBe(8)
  })

  it('crear sin capacidad no manda el campo, en vez de mandar basura', async () => {
    apiRequest.mockResolvedValue({ id: 'm1', nombre: 'Mesa 6', status: 'available' })

    await createMesa({ local_id: 'loc-1', name: 'Mesa 6', capacidad: '' })

    expect(apiRequest).toHaveBeenCalledWith('/mesas', {
      method: 'POST',
      body: { local_id: 'loc-1', nombre: 'Mesa 6', status: 'available' },
    })
  })

  it('editar una mesa también guarda la capacidad', async () => {
    apiRequest.mockResolvedValue({ id: 'm1', nombre: 'Mesa 1', status: 'available', capacity: 2 })

    await updateMesa('m1', { name: 'Mesa 1', capacidad: 2 })

    expect(apiRequest).toHaveBeenCalledWith('/mesas/m1', {
      method: 'PATCH',
      body: { nombre: 'Mesa 1', capacity: 2 },
    })
  })

  it('una mesa ocupada muestra el total de su pedido en curso', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/mesas')) {
        return Promise.resolve([
          { id: 'm1', nombre: 'Mesa 1', status: 'occupied', capacity: 4 },
          { id: 'm2', nombre: 'Mesa 2', status: 'available', capacity: 2 },
        ])
      }
      if (path.startsWith('/orders')) {
        return Promise.resolve([
          { id: 'o1', mesa_id: 'm1', status: 'open', total: '9400.00' },
          { id: 'o2', mesa_id: 'm1', status: 'open', total: '600.00' },
        ])
      }
      return Promise.resolve([])
    })

    const mesas = await listMesasConTotales('loc-1')

    // Solo pide las órdenes abiertas, no el histórico del local.
    expect(rutas()).toContain('/orders?local_id=loc-1&status=open')
    expect(mesas[0]).toMatchObject({ nombre: 'Mesa 1', state: 'ocupada', capacidad: 4, total: 10000 })
    expect(mesas[1].total).toBeNull()
  })

  it('si las órdenes no se pueden traer, las mesas se listan igual sin total', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/mesas')) return Promise.resolve([{ id: 'm1', nombre: 'Mesa 1', status: 'occupied' }])
      return Promise.reject(new Error('500'))
    })

    const mesas = await listMesasConTotales('loc-1')

    expect(mesas).toHaveLength(1)
    expect(mesas[0].total).toBeNull()
  })
})
