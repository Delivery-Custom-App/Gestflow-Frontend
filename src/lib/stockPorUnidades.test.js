/**
 * Control de stock por unidades: estado con nivel crítico, productos sin stock
 * registrado, sumar unidades, corregir el conteo y empezar a controlar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { fetchEnrichedInventoryForLocal, stockStatus } from './v2CatalogApi'
import { corregirConteo, empezarAControlarStock, patchInventoryStock, sumarUnidades } from './inventoryApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('stockStatus con nivel crítico', () => {
  it('crítico sin unidades o en su nivel crítico; bajo en su mínimo', () => {
    expect(stockStatus(0, 10, 4)).toBe('CRITICO')
    expect(stockStatus(4, 10, 4)).toBe('CRITICO')
    expect(stockStatus(5, 10, 4)).toBe('BAJO')
    expect(stockStatus(11, 10, 4)).toBe('OPTIMO')
    // Sin nivel crítico, como antes.
    expect(stockStatus(3, 10, null)).toBe('BAJO')
  })
})

describe('fetchEnrichedInventoryForLocal · productos sin stock registrado', () => {
  beforeEach(() => {
    apiRequest.mockImplementation((ruta) => {
      if (ruta === '/inventory') return Promise.resolve([{ id: 'inv-1', local_id: 'l1', product_id: 'p1', stock_actual: '3', stock_min: '10', stock_critical: '4' }])
      if (ruta === '/products') {
        return Promise.resolve([
          { id: 'p1', name: 'Bebida lata', stock_deduction_mode: 'DIRECT_STOCK', cost: 500 },
          { id: 'p2', name: 'Agua mineral', stock_deduction_mode: 'DIRECT_STOCK', cost: 400 },
          { id: 'p3', name: 'Lomo a lo pobre', stock_deduction_mode: 'RECIPE_BASED', cost: 3000 },
          { id: 'p4', name: 'Producto de otro local', stock_deduction_mode: 'DIRECT_STOCK' },
        ])
      }
      if (ruta === '/locals/l1') return Promise.resolve({ id: 'l1', business_id: 'b1' })
      if (ruta === '/local-products') {
        return Promise.resolve([
          { local_id: 'l1', product_id: 'p1' }, { local_id: 'l1', product_id: 'p2' },
          { local_id: 'l1', product_id: 'p3' }, { local_id: 'l2', product_id: 'p4' },
        ])
      }
      return Promise.resolve([])
    })
  })

  it('trae el nivel crítico y calcula el estado con él', async () => {
    const { rows } = await fetchEnrichedInventoryForLocal('l1')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ stock_critical: 4, stock_status: 'CRITICO' })
    // Sin la opción no consulta productos sin registro (los indicadores no los cuentan).
    expect(apiRequest).not.toHaveBeenCalledWith('/local-products')
  })

  it('con incluirSinRegistro agrega los del local por unidades sin fila; nunca los que se preparan', async () => {
    const { rows } = await fetchEnrichedInventoryForLocal('l1', { incluirSinRegistro: true })
    expect(rows.map((r) => [r.product_name, Boolean(r.sin_registro)])).toEqual([
      ['Bebida lata', false],
      ['Agua mineral', true],
    ])
    expect(rows[1]).toMatchObject({ inventory_id: null, stock_current: null, stock_status: null })
  })

  it('al filtrar por estado no aparecen (todavía no tienen estado)', async () => {
    const { rows } = await fetchEnrichedInventoryForLocal('l1', { incluirSinRegistro: true, status: ['CRITICO'] })
    expect(rows.map((r) => r.product_name)).toEqual(['Bebida lata'])
  })
})

describe('registrar stock', () => {
  it('sumar unidades lee lo que hay recién y guarda la suma', async () => {
    apiRequest.mockResolvedValueOnce({ id: 'inv-1', stock_actual: '20.000' }).mockResolvedValueOnce({})
    await sumarUnidades('inv-1', 24)

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/inventory/inv-1')
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/inventory/inv-1', { method: 'PATCH', body: { stock_actual: 44 } })
  })

  it('sumar cero o nada no llama al backend', async () => {
    await expect(sumarUnidades('inv-1', 0)).rejects.toThrow('Indica cuántas unidades llegaron')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('corregir el conteo deja lo contado', async () => {
    apiRequest.mockResolvedValue({})
    await corregirConteo('inv-1', 18)
    expect(apiRequest).toHaveBeenCalledWith('/inventory/inv-1', { method: 'PATCH', body: { stock_actual: 18 } })
  })

  it('empezar a controlar crea la fila del local', async () => {
    apiRequest.mockResolvedValue({ id: 'inv-9' })
    await empezarAControlarStock('l1', 'p2', { stockActual: 30, stockMin: 10, stockCritical: 4 })
    expect(apiRequest).toHaveBeenCalledWith('/inventory', {
      method: 'POST',
      body: { local_id: 'l1', product_id: 'p2', stock_actual: 30, stock_min: 10, stock_max: null, stock_critical: 4 },
    })
  })

  it('empezar sin nivel crítico no lo envía', async () => {
    apiRequest.mockResolvedValue({ id: 'inv-9' })
    await empezarAControlarStock('l1', 'p2', { stockActual: 5, stockMin: 0, stockCritical: null })
    expect(apiRequest.mock.calls[0][1].body).not.toHaveProperty('stock_critical')
  })

  it('editar el stock acepta el nivel crítico', async () => {
    apiRequest.mockResolvedValue({})
    await patchInventoryStock('l1', 'inv-1', { critical_stock: 2, min_stock: 8 })
    expect(apiRequest).toHaveBeenCalledWith('/inventory/inv-1', { method: 'PATCH', body: { stock_min: 8, stock_critical: 2 } })
  })
})
