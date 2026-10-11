import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOrderTotals } from './useOrderTotals'

describe('useOrderTotals', () => {
  it('detail vacío/null da totales en cero', () => {
    const { result } = renderHook(() => useOrderTotals(null))
    expect(result.current).toEqual({ allItems: [], subtotal: 0, iva: 0, total: 0, firstOrder: undefined })
  })

  it('suma total_price de todos los items de todas las órdenes activas', () => {
    const detail = {
      active_orders: [
        { id: 'o1', items: [{ id: 'i1', total_price: 1000 }, { id: 'i2', total_price: 2000 }] },
        { id: 'o2', items: [{ id: 'i3', total_price: 500 }] },
      ],
    }
    const { result } = renderHook(() => useOrderTotals(detail))
    expect(result.current.allItems).toHaveLength(3)
    expect(result.current.total).toBe(3500)
    expect(result.current.firstOrder.id).toBe('o1')
  })

  it('el precio ya incluye IVA: total = suma de ítems, subtotal neto = total/1.19', () => {
    const detail = { active_orders: [{ id: 'o1', items: [{ id: 'i1', total_price: 2500 }] }] }
    const { result } = renderHook(() => useOrderTotals(detail))
    expect(result.current.total).toBe(2500)
    expect(result.current.subtotal).toBe(2101)
    expect(result.current.iva).toBe(399)
  })

  it('subtotal + iva === total con redondeos', () => {
    const detail = { active_orders: [{ id: 'o1', items: [{ id: 'i1', total_price: 1000 }] }] }
    const { result } = renderHook(() => useOrderTotals(detail))
    expect(result.current.subtotal).toBe(840)
    expect(result.current.iva).toBe(160)
    for (const price of [1, 99, 1000, 2500, 3333, 12345]) {
      const { result: r } = renderHook(() =>
        useOrderTotals({ active_orders: [{ id: 'o', items: [{ id: 'i', total_price: price }] }] }))
      expect(r.current.subtotal + r.current.iva).toBe(r.current.total)
    }
  })
})
