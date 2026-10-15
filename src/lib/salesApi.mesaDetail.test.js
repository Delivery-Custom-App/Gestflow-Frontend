import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { getMesaDetail, liberarMesa } from './salesApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('./v2CatalogApi', () => ({ fetchProductsMap: vi.fn(async () => new Map([['p1', { id: 'p1', name: 'Jugo' }]])) }))

describe('getMesaDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequest.mockImplementation((path) => {
      if (path === '/mesas/m-1') {
        return Promise.resolve({ id: 'm-1', name: 'Mesa 1', local_id: 'loc-1', status: 'occupied' })
      }
      if (path.startsWith('/orders?') && new URLSearchParams(path.split('?')[1]).get('status') === 'open') {
        return Promise.resolve([
          { id: 'o-open', mesa_id: 'm-1', status: 'open' },
          { id: 'o-other', mesa_id: 'm-2', status: 'open' },
          { id: 'o-cancelled', mesa_id: 'm-1', status: 'cancelled' },
        ])
      }
      if (path.startsWith('/orders?') && new URLSearchParams(path.split('?')[1]).get('status') === 'preparing') {
        return Promise.resolve([{ id: 'o-preparing', mesa_id: 'm-1', status: 'preparing' }])
      }
      if (path.startsWith('/orders?') && new URLSearchParams(path.split('?')[1]).get('status') === 'ready') {
        return Promise.resolve([{ id: 'o-ready', mesa_id: 'm-1', status: 'ready' }])
      }
      if (path.endsWith('/items')) {
        return Promise.resolve([{ id: `item-${path}`, product_id: 'p1', quantity: 1, unit_price: 1200 }])
      }
      return Promise.resolve([])
    })
  })

  it('solicita solo pedidos de esa mesa en cada estado activo y mantiene sus totales', async () => {
    const detail = await getMesaDetail('m-1')

    const orderRequests = apiRequest.mock.calls.filter(([path]) => String(path).startsWith('/orders?'))
    expect(orderRequests.map(([path]) => new URLSearchParams(path.split('?')[1]).get('status'))).toEqual(['open', 'preparing', 'ready'])
    expect(orderRequests.every(([, options]) => options.withTotal)).toBe(true)
    expect(orderRequests.every(([path]) => new URLSearchParams(path.split('?')[1]).get('limit') === '500')).toBe(true)
    expect(apiRequest.mock.calls.some(([path]) => path.startsWith('/orders?local_id='))).toBe(false)
    expect(detail.active_orders.map((order) => order.id)).toEqual(['o-open', 'o-preparing', 'o-ready'])
    expect(detail.active_orders[0].items[0]).toMatchObject({ product_name: 'Jugo', item_name: 'Jugo', total_price: 1200 })
    expect(detail).toMatchObject({ total_products: 3, total_value: 3600 })
  })
})

describe('liberarMesa', () => {
  it('registra el motivo en POST /mesas/{id}/liberar y devuelve el resultado', async () => {
    const resultado = { mesa_id: 'm-1', nombre: 'Mesa 1', status: 'available', total_sin_cobrar: '1500.00' }
    apiRequest.mockResolvedValue(resultado)

    await expect(liberarMesa('m-1', '  Se fueron sin pagar  ')).resolves.toEqual(resultado)
    expect(apiRequest).toHaveBeenCalledWith('/mesas/m-1/liberar', {
      method: 'POST',
      body: { motivo: 'Se fueron sin pagar' },
    })
  })
})
