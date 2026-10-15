import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { listOrders, listOrdersPage } from './salesApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn(), getOptionalAuthContext: vi.fn() }))
vi.mock('./v2CatalogApi', () => ({ fetchProductsMap: vi.fn() }))
vi.mock('./supervision', () => ({ traducirErrorCobro: (error) => error }))

beforeEach(() => vi.clearAllMocks())

function params(path) {
  return new URLSearchParams(path.split('?')[1])
}

describe('paginación y filtros de órdenes (A-04)', () => {
  it('solicita una página, repite status y devuelve X-Total-Count', async () => {
    apiRequest.mockResolvedValue({
      data: [{ id: 'o-1', status: 'completed', total: '5000.00' }],
      total: 123,
    })

    const page = await listOrdersPage('loc-1', {
      status: ['completed', 'ready'],
      businessDate: '2026-10-14',
      waiterUserId: 'u-1',
      cajaId: 'c-1',
      dateFrom: new Date('2026-10-14T00:00:00-03:00'),
      dateTo: '2026-10-15T00:00:00-03:00',
      limit: 25,
      offset: 50,
    })

    const [path, options] = apiRequest.mock.calls[0]
    expect(path.startsWith('/orders?')).toBe(true)
    expect(params(path).get('local_id')).toBe('loc-1')
    expect(params(path).getAll('status')).toEqual(['completed', 'ready'])
    expect(params(path).get('business_date')).toBe('2026-10-14')
    expect(params(path).get('waiter_user_id')).toBe('u-1')
    expect(params(path).get('caja_id')).toBe('c-1')
    expect(params(path).get('date_from')).toBe('2026-10-14T03:00:00.000Z')
    expect(params(path).get('date_to')).toBe('2026-10-15T00:00:00-03:00')
    expect(params(path).get('limit')).toBe('25')
    expect(params(path).get('offset')).toBe('50')
    expect(options).toEqual({ withTotal: true })
    expect(page).toMatchObject({ total: 123, limit: 25, offset: 50, orders: [{ id: 'o-1', status: 'COMPLETED' }] })
  })

  it('filtra estados activos en el servidor al cargar órdenes de cocina', async () => {
    apiRequest.mockResolvedValue({ data: [{ id: 'o-1', status: 'open' }], total: 1 })

    const orders = await listOrders('loc-1')

    const [path, options] = apiRequest.mock.calls[0]
    expect(params(path).getAll('status')).toEqual(['open', 'preparing', 'ready'])
    expect(params(path).get('limit')).toBe('500')
    expect(options).toEqual({ withTotal: true })
    expect(orders[0]).toMatchObject({ id: 'o-1', status: 'PENDING', status_v2: 'open' })
  })
})
