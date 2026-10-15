/**
 * Control de stock por unidades: estado con nivel crítico, productos sin stock
 * registrado, sumar unidades, corregir el conteo y empezar a controlar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { fetchEnrichedInventoryForLocal, stockStatus } from './v2CatalogApi'
import { corregirConteo, registrarMerma, empezarAControlarStock, patchInventoryStock, sumarUnidades } from './inventoryApi'

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


/**
 * Simula `include=product` del backend (A-07): filtra por local y pone los
 * datos del producto dentro de cada fila. Sin el producto, los campos van null.
 */
function conProducto(filas, productos, localId) {
  const porId = new Map(productos.map((p) => [String(p.id), p]))
  return filas.filter((f) => String(f.local_id) === String(localId)).map((f) => {
    const p = porId.get(String(f.product_id))
    return {
      ...f,
      product_name: p?.name ?? null,
      category_id: p?.category_id ?? null,
      price: p?.price ?? null,
      cost: p?.cost ?? null,
      stock_deduction_mode: p?.stock_deduction_mode ?? null,
    }
  })
}

describe('fetchEnrichedInventoryForLocal · productos sin stock registrado', () => {
  beforeEach(() => {
    const productos = [
      { id: 'p1', name: 'Bebida lata', stock_deduction_mode: 'DIRECT_STOCK', cost: 500 },
      { id: 'p2', name: 'Agua mineral', stock_deduction_mode: 'DIRECT_STOCK', cost: 400 },
      { id: 'p3', name: 'Lomo a lo pobre', stock_deduction_mode: 'RECIPE_BASED', cost: 3000 },
      { id: 'p4', name: 'Producto de otro local', stock_deduction_mode: 'DIRECT_STOCK' },
    ]
    apiRequest.mockImplementation((ruta) => {
      if (ruta === '/inventory?local_id=l1&include=product') {
        return Promise.resolve(conProducto([{ id: 'inv-1', local_id: 'l1', product_id: 'p1', stock_actual: '3', stock_min: '10', stock_critical: '4' }], productos, 'l1'))
      }
      if (ruta === '/locals/l1') return Promise.resolve({ id: 'l1', business_id: 'b1' })
      if (ruta === '/local-products?local_id=l1&include=product') {
        return Promise.resolve(conProducto([
          { local_id: 'l1', product_id: 'p1' }, { local_id: 'l1', product_id: 'p2' },
          { local_id: 'l1', product_id: 'p3' }, { local_id: 'l2', product_id: 'p4' },
        ], productos, 'l1'))
      }
      return Promise.resolve([])
    })
  })

  it('trae el nivel crítico y calcula el estado con él', async () => {
    const { rows } = await fetchEnrichedInventoryForLocal('l1')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ stock_critical: 4, stock_status: 'CRITICO' })
    // Sin la opción no consulta productos sin registro (los indicadores no los cuentan).
    expect(apiRequest).not.toHaveBeenCalledWith('/local-products?local_id=l1&include=product')
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
  it('T-58: sumar unidades es un movimiento «ingreso» (atómico, sin leer y escribir)', async () => {
    apiRequest.mockResolvedValue({})
    await sumarUnidades('inv-1', 24, 'Llegó el camión')
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenCalledWith('/inventory/inv-1/movimientos', {
      method: 'POST', body: { tipo: 'ingreso', cantidad: '24', motivo: 'Llegó el camión' },
    })
  })

  it('sumar cero o nada no llama al backend', async () => {
    await expect(sumarUnidades('inv-1', 0)).rejects.toThrow('Indica cuántas unidades llegaron')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('T-58: corregir el conteo es un movimiento «ajuste» con motivo', async () => {
    apiRequest.mockResolvedValue({})
    await corregirConteo('inv-1', 18, 'Conteo del domingo')
    expect(apiRequest).toHaveBeenCalledWith('/inventory/inv-1/movimientos', {
      method: 'POST', body: { tipo: 'ajuste', cantidad: '18', motivo: 'Conteo del domingo' },
    })
  })

  it('T-58: la merma es un movimiento «merma» con motivo', async () => {
    apiRequest.mockResolvedValue({})
    await registrarMerma('inv-1', 3, 'Se cayó la caja')
    expect(apiRequest).toHaveBeenCalledWith('/inventory/inv-1/movimientos', {
      method: 'POST', body: { tipo: 'merma', cantidad: '3', motivo: 'Se cayó la caja' },
    })
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
