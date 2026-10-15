import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMesaDetail } from './useMesaDetail'
import { getMesaDetail } from '../lib/salesApi'

vi.mock('../lib/salesApi', () => ({ getMesaDetail: vi.fn() }))

describe('useMesaDetail · baja de ítem (T-67)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('quita el ítem y actualiza totales desde X-Order-Total sin volver a consultar', async () => {
    getMesaDetail.mockResolvedValue({
      mesa: { id: 'mesa-1' },
      active_orders: [{
        id: 'order-1',
        items: [{ id: 'item-1', quantity: 2, unit_price: 1000, subtotal: 2000 }, { id: 'item-2', quantity: 1, unit_price: 500, subtotal: 500 }],
      }],
      total_products: 3,
      total_value: 2500,
    })
    const { result } = renderHook(() => useMesaDetail('mesa-1'))
    await waitFor(() => expect(result.current.detail).not.toBeNull())

    act(() => result.current.updateAfterItemRemoval('order-1', 'item-1', 500))

    expect(result.current.detail.active_orders[0].items.map((item) => item.id)).toEqual(['item-2'])
    expect(result.current.detail.active_orders[0].total).toBe(500)
    expect(result.current.detail.total_products).toBe(1)
    expect(result.current.detail.total_value).toBe(500)
    expect(getMesaDetail).toHaveBeenCalledOnce()
  })
})
