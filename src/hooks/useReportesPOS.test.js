/**
 * Reportes POS: la pantalla dependía de `/dashboard/pos-reportes`, que no existe
 * en Backend V2 y dejaba un 404 en crudo a la vista. Ahora se alimenta de los
 * reportes agregados del backend.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReportesPOS } from './useReportesPOS'
import { getSalesReport, getProductsReport } from '../lib/reportsApi'

vi.mock('../lib/reportsApi', async (importOriginal) => ({
  ...(await importOriginal()),
  getSalesReport: vi.fn(),
  getProductsReport: vi.fn(),
}))

const VENTAS = { start_date: '2026-09-01', end_date: '2026-09-26', total_sales: '9400.00', total_orders: 3 }
const PRODUCTOS = {
  ranking: [
    { product_id: 'p1', product_name: 'Café Americano', quantity_sold: '6.000', revenue: '15000.00' },
    { product_id: 'p2', product_name: 'Brownie', quantity_sold: '4.000', revenue: '8800.00' },
    { product_id: 'p3', product_name: 'Jugo Natural', quantity_sold: '3.000', revenue: '6000.00' },
    { product_id: 'p4', product_name: 'Empanada', quantity_sold: '2.000', revenue: '4400.00' },
    { product_id: 'p5', product_name: 'Sandwich', quantity_sold: '1.000', revenue: '3500.00' },
    { product_id: 'p6', product_name: 'Agua', quantity_sold: '1.000', revenue: '1200.00' },
  ],
  monthly_series: [],
}

describe('useReportesPOS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-26T12:00:00'))
    getSalesReport.mockResolvedValue(VENTAS)
    getProductsReport.mockResolvedValue(PRODUCTOS)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pide los reportes agregados del mes en curso, no el endpoint inexistente', async () => {
    const { result } = renderHook(() => useReportesPOS('loc-1'))

    await act(async () => { await result.current.fetch() })

    const rango = { startDate: '2026-09-01', endDate: '2026-09-26' }
    expect(getSalesReport).toHaveBeenCalledWith('loc-1', rango)
    expect(getProductsReport).toHaveBeenCalledWith('loc-1', rango)
  })

  it('arma el top 5 y el producto más vendido desde el ranking del backend', async () => {
    const { result } = renderHook(() => useReportesPOS('loc-1'))

    await act(async () => { await result.current.fetch() })

    expect(result.current.data.top_5).toHaveLength(5)
    expect(result.current.data.top_5[0]).toMatchObject({
      product_id: 'p1', product_name: 'Café Americano', units_sold: 6, revenue: 15000,
    })
    expect(result.current.data.top_producto.product_name).toBe('Café Americano')
  })

  it('expone los totales de venta del período', async () => {
    const { result } = renderHook(() => useReportesPOS('loc-1'))

    await act(async () => { await result.current.fetch() })

    expect(result.current.data.total_ventas).toBe(9400)
    expect(result.current.data.total_ordenes).toBe(3)
    expect(result.current.data.periodo).toEqual({ desde: '2026-09-01', hasta: '2026-09-26' })
  })

  it('sin ventas en el período no rompe: top vacío y totales en cero', async () => {
    getSalesReport.mockResolvedValue({ total_sales: '0.00', total_orders: 0 })
    getProductsReport.mockResolvedValue({ ranking: [], monthly_series: [] })
    const { result } = renderHook(() => useReportesPOS('loc-1'))

    await act(async () => { await result.current.fetch() })

    expect(result.current.data.top_5).toEqual([])
    expect(result.current.data.top_producto).toBeNull()
    expect(result.current.data.total_ventas).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('ante un fallo muestra un mensaje en español, sin el texto técnico del error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getSalesReport.mockRejectedValue(new Error('500: Internal Server Error'))
    const { result } = renderHook(() => useReportesPOS('loc-1'))

    await act(async () => { await result.current.fetch() })

    expect(result.current.error).toBe('No pudimos cargar los reportes del período.')
    expect(result.current.error).not.toMatch(/500|Internal|404|Error:/)
  })

  it('sin local no pide nada', async () => {
    const { result } = renderHook(() => useReportesPOS(null))

    await act(async () => { await result.current.fetch() })

    expect(getSalesReport).not.toHaveBeenCalled()
    expect(getProductsReport).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
  })
})
