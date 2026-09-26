import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  stockStatus,
  fetchLocal,
  listLocals,
  updateLocal,
  fetchProductsMap,
  fetchCategoriesForBusiness,
  fetchEnrichedInventoryForLocal,
  paginate,
  createProductWithInventory,
} from './v2CatalogApi'

vi.mock('./apiClient', () => ({
  apiRequest: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('stockStatus', () => {
  it('actual <= 0 → CRITICO', () => {
    expect(stockStatus(0, 10)).toBe('CRITICO')
    expect(stockStatus(-5, 10)).toBe('CRITICO')
  })

  it('actual > 0 y <= min (min > 0) → BAJO', () => {
    expect(stockStatus(5, 5)).toBe('BAJO')
    expect(stockStatus(3, 5)).toBe('BAJO')
  })

  it('actual > min → OPTIMO', () => {
    expect(stockStatus(20, 5)).toBe('OPTIMO')
  })

  it('min = 0 y actual > 0 → OPTIMO (no hay piso definido)', () => {
    expect(stockStatus(20, 0)).toBe('OPTIMO')
  })

  it('valores no numéricos caen a 0', () => {
    expect(stockStatus(undefined, undefined)).toBe('CRITICO')
  })
})

describe('fetchLocal / updateLocal', () => {
  it('fetchLocal pega a /locals/:id', async () => {
    apiRequest.mockResolvedValue({ id: 'l1' })
    const res = await fetchLocal('l1')
    expect(apiRequest).toHaveBeenCalledWith('/locals/l1')
    expect(res).toEqual({ id: 'l1' })
  })

  it('updateLocal hace PATCH con el body', async () => {
    apiRequest.mockResolvedValue({ ok: true })
    await updateLocal('l1', { name: 'x' })
    expect(apiRequest).toHaveBeenCalledWith('/locals/l1', { method: 'PATCH', body: { name: 'x' } })
  })
})

describe('listLocals', () => {
  it('sin businessId pega a /locals', async () => {
    apiRequest.mockResolvedValue([{ id: 'l1' }])
    await listLocals()
    expect(apiRequest).toHaveBeenCalledWith('/locals')
  })

  it('con businessId agrega query param', async () => {
    apiRequest.mockResolvedValue([])
    await listLocals('biz-1')
    expect(apiRequest).toHaveBeenCalledWith('/locals?business_id=biz-1')
  })

  it('respuesta no-array cae a []', async () => {
    apiRequest.mockResolvedValue(null)
    const res = await listLocals()
    expect(res).toEqual([])
  })
})

describe('fetchProductsMap', () => {
  it('arma un Map por id cuando la respuesta es array', async () => {
    apiRequest.mockResolvedValue([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    const map = await fetchProductsMap()
    expect(map.get('1')).toEqual({ id: 1, name: 'A' })
    expect(map.size).toBe(2)
  })

  it('respuesta no-array → Map vacío', async () => {
    apiRequest.mockResolvedValue(null)
    const map = await fetchProductsMap()
    expect(map.size).toBe(0)
  })
})

describe('fetchCategoriesForBusiness', () => {
  it('sin businessId devuelve todas', async () => {
    apiRequest.mockResolvedValue([{ id: 1, business_id: 'a' }, { id: 2, business_id: 'b' }])
    const res = await fetchCategoriesForBusiness()
    expect(res).toHaveLength(2)
  })

  it('con businessId filtra', async () => {
    apiRequest.mockResolvedValue([{ id: 1, business_id: 'a' }, { id: 2, business_id: 'b' }])
    const res = await fetchCategoriesForBusiness('a')
    expect(res).toEqual([{ id: 1, business_id: 'a' }])
  })

  it('respuesta no-array → []', async () => {
    apiRequest.mockResolvedValue(undefined)
    const res = await fetchCategoriesForBusiness('a')
    expect(res).toEqual([])
  })
})

describe('fetchEnrichedInventoryForLocal', () => {
  function mockPlatform({ categoriesFail = false } = {}) {
    apiRequest.mockImplementation((path) => {
      if (path === '/inventory') {
        return Promise.resolve([
          { id: 'inv1', local_id: 'l1', product_id: 'p1', stock_actual: '10', stock_min: '2', stock_max: '50', updated_at: 't1' },
          { id: 'inv2', local_id: 'l1', product_id: 'p2', stock_actual: 0, stock_min: 5, updated_at: 't2' },
          { id: 'inv3', local_id: 'otro-local', product_id: 'p1' },
        ])
      }
      if (path === '/products') {
        return Promise.resolve([
          { id: 'p1', name: 'Café', cost: 100, price: 200, category_id: 'c1', is_active: true, business_id: 'b1' },
          { id: 'p2', name: 'Pan', cost: 50, price: 90 },
        ])
      }
      if (path === '/locals/l1') {
        return Promise.resolve({ id: 'l1', business_id: 'b1' })
      }
      if (path === '/categories') {
        return categoriesFail ? Promise.reject(new Error('boom')) : Promise.resolve([{ id: 'c1', name: 'Bebidas' }])
      }
      return Promise.resolve(null)
    })
  }

  it('filtra por local_id, calcula status y enriquece con categoría', async () => {
    mockPlatform()
    const { rows, local } = await fetchEnrichedInventoryForLocal('l1')
    expect(rows).toHaveLength(2)
    expect(local).toEqual({ id: 'l1', business_id: 'b1' })
    const cafe = rows.find((r) => r.product_id === 'p1')
    expect(cafe.category_name).toBe('Bebidas')
    expect(cafe.stock_status).toBe('OPTIMO')
    const pan = rows.find((r) => r.product_id === 'p2')
    expect(pan.stock_status).toBe('CRITICO')
    expect(pan.category_name).toBeNull()
  })

  it('si /categories falla, sigue con lista vacía (catch)', async () => {
    mockPlatform({ categoriesFail: true })
    const { rows } = await fetchEnrichedInventoryForLocal('l1')
    expect(rows).toHaveLength(2)
    expect(rows[0].category_name).toBeNull()
  })

  it('filters.category filtra por categoría', async () => {
    mockPlatform()
    const { rows } = await fetchEnrichedInventoryForLocal('l1', { category: 'c1' })
    expect(rows).toHaveLength(1)
    expect(rows[0].product_id).toBe('p1')
  })

  it('filters.search filtra por nombre (case-insensitive)', async () => {
    mockPlatform()
    const { rows } = await fetchEnrichedInventoryForLocal('l1', { search: 'CAFÉ' })
    expect(rows).toHaveLength(1)
    expect(rows[0].product_id).toBe('p1')
  })

  it('filters.status filtra por estado de stock', async () => {
    mockPlatform()
    const { rows } = await fetchEnrichedInventoryForLocal('l1', { status: ['critico'] })
    expect(rows).toHaveLength(1)
    expect(rows[0].product_id).toBe('p2')
  })
})

describe('paginate', () => {
  it('usa límite y offset por defecto', () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    const res = paginate(items)
    expect(res).toEqual({ items, total: 10, limit: 50, offset: 0 })
  })

  it('respeta limit/offset explícitos', () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    const res = paginate(items, { limit: 3, offset: 2 })
    expect(res.items).toEqual([2, 3, 4])
    expect(res.total).toBe(10)
  })

  it('clampa limit por arriba de 500', () => {
    const res = paginate([], { limit: 9999 })
    expect(res.limit).toBe(500)
  })

  it('clampa limit negativo a 1', () => {
    const res = paginate([], { limit: -5 })
    expect(res.limit).toBe(1)
  })

  it('limit 0 (falsy) cae al default 50', () => {
    const res = paginate([], { limit: 0 })
    expect(res.limit).toBe(50)
  })

  it('offset negativo se clampa a 0', () => {
    const res = paginate([], { offset: -5 })
    expect(res.offset).toBe(0)
  })

  it('valores no numéricos caen a defaults', () => {
    const res = paginate([1, 2, 3], { limit: 'x', offset: 'y' })
    expect(res.limit).toBe(50)
    expect(res.offset).toBe(0)
  })
})

describe('createProductWithInventory', () => {
  it('lanza si el local no tiene business_id', async () => {
    apiRequest.mockResolvedValue({ id: 'l1', business_id: null })
    await expect(createProductWithInventory('l1', { name: 'Té' })).rejects.toThrow('El local no tiene business_id')
  })

  it('lanza si falta el nombre', async () => {
    apiRequest.mockResolvedValue({ id: 'l1', business_id: 'b1' })
    await expect(createProductWithInventory('l1', {})).rejects.toThrow('Nombre de producto requerido')
  })

  it('crea producto, local-product e inventario con defaults', async () => {
    apiRequest.mockImplementation((path) => {
      if (path === '/locals/l1') return Promise.resolve({ id: 'l1', business_id: 'b1' })
      if (path === '/products') return Promise.resolve({ id: 'p1' })
      if (path === '/local-products') return Promise.resolve({ ok: true })
      if (path === '/inventory') return Promise.resolve({ id: 'inv1' })
      return Promise.resolve(null)
    })
    const res = await createProductWithInventory('l1', { name: '  Té  ', unit_price: 100, unit_cost: 40, stock: 5 })
    expect(res.product).toEqual({ id: 'p1' })
    expect(res.inventory).toEqual({ id: 'inv1' })
    expect(apiRequest).toHaveBeenCalledWith('/products', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({ name: 'Té', price: 100, cost: 40 }),
    }))
  })
})
