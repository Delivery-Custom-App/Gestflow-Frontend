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
    expect(result.current.subtotal).toBe(3500)
    expect(result.current.firstOrder.id).toBe('o1')
  })

  it('redondea el IVA (19%) y lo suma al subtotal para el total', () => {
    const detail = { active_orders: [{ id: 'o1', items: [{ id: 'i1', total_price: 1000 }] }] }
    const { result } = renderHook(() => useOrderTotals(detail))
    expect(result.current.iva).toBe(Math.round(1000 * 0.19))
    expect(result.current.total).toBe(1000 + Math.round(1000 * 0.19))
  })
})
