import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { cambiarSiSePrepara } from './inventoryApi'
import { explicacionSePrepara, modoDeStock, sePrepara } from './tipoProducto'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('tipo de producto', () => {
  it('encendido = RECIPE_BASED, apagado = DIRECT_STOCK', () => {
    expect(modoDeStock(true)).toBe('RECIPE_BASED')
    expect(modoDeStock(false)).toBe('DIRECT_STOCK')
    expect(sePrepara({ stock_deduction_mode: 'RECIPE_BASED' })).toBe(true)
    expect(sePrepara({ stock_deduction_mode: 'DIRECT_STOCK' })).toBe(false)
    expect(sePrepara(null)).toBe(false)
  })

  it('la línea explica qué cambia en cada caso', () => {
    expect(explicacionSePrepara(true)).toMatch(/comanda de cocina.*no lleva stock/)
    expect(explicacionSePrepara(false)).toMatch(/por unidades.*En locales con mesas no va a la comanda/)
  })
})

describe('cambiarSiSePrepara', () => {
  function conInventario(filas) {
    apiRequest.mockImplementation((ruta, opts) => {
      if (ruta === '/inventory' && !opts) return Promise.resolve(filas)
      return Promise.resolve({ ok: true })
    })
  }

  it('encendido: cambia el tipo y no toca el stock', async () => {
    conInventario([])
    await cambiarSiSePrepara('l1', 'p1', { prepara: true })

    expect(apiRequest).toHaveBeenCalledWith('/products/p1', { method: 'PATCH', body: { stock_deduction_mode: 'RECIPE_BASED' } })
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it('apagado sin stock en el local: lo crea con el actual y el mínimo', async () => {
    conInventario([{ id: 'inv-otro', local_id: 'otro', product_id: 'p1' }])
    await cambiarSiSePrepara('l1', 'p1', { prepara: false, stockActual: '12', stockMin: '3' })

    // Primero el tipo: el backend rechaza el inventario de un producto que se prepara.
    expect(apiRequest.mock.calls[0]).toEqual(['/products/p1', { method: 'PATCH', body: { stock_deduction_mode: 'DIRECT_STOCK' } }])
    expect(apiRequest).toHaveBeenCalledWith('/inventory', {
      method: 'POST',
      body: { local_id: 'l1', product_id: 'p1', stock_actual: 12, stock_min: 3, stock_max: null },
    })
  })

  it('apagado con stock en el local: lo actualiza', async () => {
    conInventario([{ id: 'inv-1', local_id: 'l1', product_id: 'p1' }])
    await cambiarSiSePrepara('l1', 'p1', { prepara: false, stockActual: '5', stockMin: '1' })

    expect(apiRequest).toHaveBeenCalledWith('/inventory/inv-1', { method: 'PATCH', body: { stock_actual: 5, stock_min: 1 } })
    expect(apiRequest).not.toHaveBeenCalledWith('/inventory', expect.objectContaining({ method: 'POST' }))
  })
})
