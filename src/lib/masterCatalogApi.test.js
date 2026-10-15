/**
 * Catálogo maestro: el backend lo tenía y solo lo usaba la app móvil.
 * Importar crea el producto en el negocio (precio 0, inactivo) y hay que
 * sumarlo al menú del local para que aparezca en la carta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { filtrarCatalogo, importarItemAlLocal, listarCatalogoMaestro } from './masterCatalogApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const ITEMS = [
  { id: 'i-1', name: 'Coca-Cola 500ml', category_name: 'Bebidas', provider: 'Coca-Cola', is_active: true },
  { id: 'i-2', name: 'Agua mineral', category_name: 'Bebidas', provider: 'Vital', is_active: true },
  { id: 'i-3', name: 'Retirado', category_name: 'Bebidas', provider: 'Vital', is_active: false },
]

describe('listarCatalogoMaestro', () => {
  beforeEach(() => vi.clearAllMocks())

  it('trae el catálogo y deja fuera lo que ya no está activo', async () => {
    apiRequest.mockResolvedValue(ITEMS)

    const items = await listarCatalogoMaestro()

    expect(items.map((i) => i.id)).toEqual(['i-1', 'i-2'])
    expect(apiRequest).toHaveBeenCalledWith('/master-catalog-products')
  })

  it('puede pedir solo lo que aplica al tipo de local', async () => {
    apiRequest.mockResolvedValue(ITEMS)

    await listarCatalogoMaestro({ salesModel: 'RESTAURANT' })

    expect(apiRequest).toHaveBeenCalledWith('/master-catalog-products?sales_model=RESTAURANT')
  })
})

describe('importarItemAlLocal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('importa al negocio, lo suma al menú y le crea su stock en 0, sin pasos manuales', async () => {
    apiRequest
      .mockResolvedValueOnce({ id: 'p-9', name: 'Coca-Cola 500ml' })  // import
      .mockResolvedValueOnce({ id: 'lp-9' })                          // local-product
      .mockResolvedValueOnce({ id: 'inv-9' })                         // inventory

    const producto = await importarItemAlLocal('i-1', { businessId: 'b-1', localId: 'loc-1' })

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/master-catalog-products/i-1/import?business_id=b-1', { method: 'POST' })
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/local-products', {
      method: 'POST',
      body: { local_id: 'loc-1', product_id: 'p-9', is_active: true },
    })
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/inventory', {
      method: 'POST',
      body: { local_id: 'loc-1', product_id: 'p-9', stock_actual: 0, stock_min: 0 },
    })
    expect(producto).toEqual({ id: 'p-9', name: 'Coca-Cola 500ml' })
  })

  it('si ya tenía registro de stock (409) no es un error', async () => {
    apiRequest
      .mockResolvedValueOnce({ id: 'p-9', name: 'Coca-Cola 500ml' })
      .mockResolvedValueOnce({ id: 'lp-9' })
      .mockRejectedValueOnce(new Error('409: Inventario ya existe para este local y producto'))

    const producto = await importarItemAlLocal('i-1', { localId: 'loc-1' })

    expect(producto.avisoStock).toBeUndefined()
  })

  it('si el registro de stock no se pudo crear, lo avisa sin deshacer la importación', async () => {
    apiRequest
      .mockResolvedValueOnce({ id: 'p-9', name: 'Coca-Cola 500ml' })
      .mockResolvedValueOnce({ id: 'lp-9' })
      .mockRejectedValueOnce(new Error('500: se cayó'))

    const producto = await importarItemAlLocal('i-1', { localId: 'loc-1' })

    expect(producto).toEqual({ id: 'p-9', name: 'Coca-Cola 500ml', avisoStock: 'se cayó' })
  })

  it('sin local solo lo trae al negocio', async () => {
    apiRequest.mockResolvedValue({ id: 'p-9', name: 'Coca-Cola 500ml' })

    await importarItemAlLocal('i-1', { businessId: 'b-1' })

    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it('si el ítem ya no existe lo dice sin el código del error', async () => {
    apiRequest.mockRejectedValue(new Error('404: Ítem de catálogo maestro no encontrado'))

    await expect(importarItemAlLocal('i-9', { localId: 'loc-1' }))
      .rejects.toThrow('Ítem de catálogo maestro no encontrado')
  })

  it('si el producto se creó pero no entró al menú, lo distingue', async () => {
    apiRequest
      .mockResolvedValueOnce({ id: 'p-9', name: 'Coca-Cola 500ml' })
      .mockRejectedValueOnce(new Error('409: Ya existe'))

    await expect(importarItemAlLocal('i-1', { localId: 'loc-1' }))
      .rejects.toThrow(/se creó el producto pero no se pudo sumar al menú/i)
  })
})

describe('filtrarCatalogo', () => {
  it('busca por nombre, categoría o proveedor', () => {
    expect(filtrarCatalogo(ITEMS, 'coca').map((i) => i.id)).toEqual(['i-1'])
    expect(filtrarCatalogo(ITEMS, 'bebidas')).toHaveLength(3)
    expect(filtrarCatalogo(ITEMS, 'vital').map((i) => i.id)).toEqual(['i-2', 'i-3'])
  })

  it('sin texto devuelve todo', () => {
    expect(filtrarCatalogo(ITEMS, '  ')).toHaveLength(3)
  })
})
