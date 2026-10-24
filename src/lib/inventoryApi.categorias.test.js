/**
 * Categoría nueva desde "Nuevo producto": el modal la crea al confirmarla con Enter,
 * pero la caché de categorías por local seguía sin ella. Al guardar, la búsqueda
 * por nombre no la encontraba en la caché y la volvía a crear: el backend rechazaba
 * el nombre duplicado (uq_categories_business_name) con un 500.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { fetchCategoriesForBusiness, fetchLocal } from './v2CatalogApi'
import { setCachedCategories } from './categoryCatalogCache'
import { resolveCategoryNameForLocal } from './inventoryApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))
vi.mock('./v2CatalogApi', () => ({
  createProductWithInventory: vi.fn(),
  fetchCategoriesForBusiness: vi.fn(),
  fetchEnrichedInventoryForLocal: vi.fn(),
  fetchLocal: vi.fn(),
  paginate: vi.fn(),
  stockStatus: vi.fn(),
}))

const LOCAL = 'loc-1'

beforeEach(() => {
  vi.clearAllMocks()
  setCachedCategories(LOCAL, [{ id: 'c-cafe', name: 'Café' }])
  fetchLocal.mockResolvedValue({ id: LOCAL, business_id: 'biz-1' })
})

const posteosDeCategoria = () => apiRequest.mock.calls.filter(([path, opts]) => path === '/categories' && opts?.method === 'POST')

describe('resolveCategoryNameForLocal', () => {
  it('no vuelve a crear una categoría que ya existe aunque la caché esté vieja', async () => {
    fetchCategoriesForBusiness.mockResolvedValue([
      { id: 'c-cafe', name: 'Café' },
      { id: 'c-boyeria', name: 'Boyeria' },
    ])

    await expect(resolveCategoryNameForLocal(LOCAL, 'boyeria')).resolves.toBe('Boyeria')
    expect(posteosDeCategoria()).toHaveLength(0)
  })

  it('usa la caché sin pedir la lista cuando ya tiene la categoría', async () => {
    await expect(resolveCategoryNameForLocal(LOCAL, 'café')).resolves.toBe('Café')
    expect(fetchCategoriesForBusiness).not.toHaveBeenCalled()
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('crea la categoría solo si tampoco está en la lista recién pedida', async () => {
    fetchCategoriesForBusiness.mockResolvedValue([{ id: 'c-cafe', name: 'Café' }])
    apiRequest.mockResolvedValue({ id: 'c-boyeria', name: 'Boyeria' })

    await expect(resolveCategoryNameForLocal(LOCAL, 'Boyeria')).resolves.toBe('Boyeria')
    expect(posteosDeCategoria()).toHaveLength(1)
    expect(posteosDeCategoria()[0][1].body).toEqual({ name: 'Boyeria', business_id: 'biz-1' })
  })
})
