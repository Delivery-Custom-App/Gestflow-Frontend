/** Carta del local para vender con include=product (A-07). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { fetchLocalMenuCatalog } from './salesApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn(), getOptionalAuthContext: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  apiRequest.mockImplementation(async (path) => {
    if (path === '/local-products?local_id=l1&include=product') {
      return [
        { id: 'lp1', local_id: 'l1', product_id: 'p1', is_active: true, product_name: 'Café', category_id: 'c1', price: '2500', cost: null, stock_deduction_mode: 'DIRECT_STOCK' },
        { id: 'lp2', local_id: 'l1', product_id: 'p2', is_active: false, product_name: 'Pan', category_id: 'c1', price: '900', cost: null },
      ]
    }
    if (path === '/categories') return [{ id: 'c1', name: 'Bebidas' }]
    if (path === '/inventory?local_id=l1') return [{ local_id: 'l1', product_id: 'p1', stock_actual: '7' }]
    return []
  })
})

describe('fetchLocalMenuCatalog (venta)', () => {
  it('usa el menú del local con include=product y no baja el catálogo completo', async () => {
    const menu = await fetchLocalMenuCatalog('l1')
    expect(apiRequest).not.toHaveBeenCalledWith('/products')
    expect(apiRequest).toHaveBeenCalledWith('/local-products?local_id=l1&include=product')
    expect(menu.categories).toHaveLength(1)
    expect(menu.categories[0].products).toEqual([
      expect.objectContaining({ name: 'Café', price: 2500, stock: 7, cost: null, local_product_id: 'lp1' }),
    ])
  })
})
