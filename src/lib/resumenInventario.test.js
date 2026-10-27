/** Las cuentas de Resumen y Productos del inventario unificado (#175, #176). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { contarPorEstado, filtrarFilas, hayQueReponer, kpisDeInventario, margenDe } from './inventarioUnificado'
import { diaEnChile, masVendidosConMargen, mermasDeLaSemana, movimientosDelDia, movimientosDelLocal, restarDias } from './resumenInventario'
import { listarMovimientosStock } from './movimientosStock'

vi.mock('./movimientosStock', async (importOriginal) => ({ ...(await importOriginal()), listarMovimientosStock: vi.fn() }))

const FILAS = [
  { inventory_id: 'i1', product_id: 'p1', product_name: 'Bebida', stock_current: 20, stock_min: 5, stock_status: 'OPTIMO', total_value: 16000, category_id: 'c1' },
  { inventory_id: 'i2', product_id: 'p2', product_name: 'Jugo', stock_current: 4, stock_min: 5, stock_status: 'BAJO', total_value: 3200, category_id: 'c1' },
  { inventory_id: 'i3', product_id: 'p3', product_name: 'Agua', stock_current: 0, stock_min: 5, stock_status: 'CRITICO', total_value: 0, category_id: 'c2' },
  { inventory_id: null, sin_registro: true, product_id: 'p4', product_name: 'Galletas', category_id: 'c2' },
]

beforeEach(() => vi.clearAllMocks())

describe('inventarioUnificado', () => {
  it('los KPI cuentan solo los productos con stock registrado; «Todos» incluye los sin registro', () => {
    expect(kpisDeInventario(FILAS)).toEqual({ total: 3, optimo: 1, bajo: 1, critico: 1, porReponer: 2, valorTotal: 19200, sinRegistro: 1 })
    expect(contarPorEstado(FILAS)).toEqual({ TODOS: 4, OPTIMO: 1, BAJO: 1, CRITICO: 1 })
  })

  it('«Hay que reponer» pone primero los críticos', () => {
    expect(hayQueReponer(FILAS).map((f) => f.product_name)).toEqual(['Agua', 'Jugo'])
  })

  it('filtra por estado, nombre y categoría', () => {
    expect(filtrarFilas(FILAS, { estado: 'BAJO' }).map((f) => f.product_id)).toEqual(['p2'])
    expect(filtrarFilas(FILAS, { busqueda: 'gall' }).map((f) => f.product_id)).toEqual(['p4'])
    expect(filtrarFilas(FILAS, { categoria: 'c2' }).map((f) => f.product_id)).toEqual(['p3', 'p4'])
  })

  it('el margen es precio menos costo; sin costo no se inventa', () => {
    expect(margenDe({ price: 1500, cost: 800 })).toBe(700)
    expect(margenDe({ price: 1500, cost: null })).toBeNull()
  })
})

describe('resumenInventario', () => {
  it('las fechas son las de Chile', () => {
    // 01:30 UTC del 26 es todavía el 25 en Chile.
    expect(diaEnChile('2026-10-26T01:30:00Z')).toBe('2026-10-25')
    expect(restarDias('2026-11-02', 6)).toBe('2026-10-27')
  })

  it('pide los movimientos de cada producto con stock y los ordena del más nuevo al más antiguo', async () => {
    listarMovimientosStock.mockImplementation(async (id) => ({
      movimientos: id === 'i1'
        ? [{ tipo: 'venta', delta: '-1', created_at: '2026-10-25T15:00:00Z' }]
        : [{ tipo: 'merma', cantidad: '2', delta: '-2', created_at: '2026-10-25T16:00:00Z' }],
    }))
    const { movimientos, recortado } = await movimientosDelLocal(FILAS)
    expect(listarMovimientosStock).toHaveBeenCalledTimes(3)
    expect(movimientos.map((m) => m.product_name)).toEqual(['Jugo', 'Agua', 'Bebida'])
    expect(recortado).toBe(false)
  })

  it('avisa que quedó incompleto si un producto devolvió el tope o su consulta falló', async () => {
    listarMovimientosStock.mockResolvedValue({ movimientos: [{ tipo: 'venta', delta: '-1', created_at: '2026-10-25T15:00:00Z' }] })
    expect((await movimientosDelLocal(FILAS, { porProducto: 1 })).incompleto).toBe(true)
    expect((await movimientosDelLocal(FILAS, { porProducto: 5 })).incompleto).toBe(false)
    listarMovimientosStock.mockRejectedValue(new Error('500'))
    expect((await movimientosDelLocal(FILAS)).incompleto).toBe(true)
  })

  it('con más productos que el tope, avisa que se recortó', async () => {
    listarMovimientosStock.mockResolvedValue({ movimientos: [] })
    const { recortado } = await movimientosDelLocal(FILAS, { maxProductos: 2 })
    expect(listarMovimientosStock).toHaveBeenCalledTimes(2)
    expect(recortado).toBe(true)
  })

  it('movimientos del día y mermas de los últimos 7 días', () => {
    const movs = [
      { tipo: 'merma', cantidad: '2', created_at: '2026-10-25T15:00:00Z' },
      { tipo: 'merma', cantidad: '3', created_at: '2026-10-19T15:00:00Z' },
      { tipo: 'merma', cantidad: '9', created_at: '2026-10-18T15:00:00Z' },
      { tipo: 'ingreso', cantidad: '10', created_at: '2026-10-25T12:00:00Z' },
    ]
    expect(movimientosDelDia(movs, '2026-10-25')).toHaveLength(2)
    expect(mermasDeLaSemana(movs, '2026-10-25')).toBe(5)
  })

  it('los más vendidos traen su margen por unidad', () => {
    const ranking = [
      { product_id: 'p1', product_name: 'Bebida', quantity_sold: 12 },
      { product_id: 'p9', product_name: 'Lomo', quantity_sold: 30 },
      { product_id: 'p2', product_name: 'Jugo', quantity_sold: 0 },
    ]
    expect(masVendidosConMargen(ranking, [{ product_id: 'p1', price: 1500, cost: 800 }])).toEqual([
      { product_id: 'p9', nombre: 'Lomo', unidades: 30, margen: null },
      { product_id: 'p1', nombre: 'Bebida', unidades: 12, margen: 700 },
    ])
  })
})
