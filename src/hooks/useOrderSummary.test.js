import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useOrderSummary } from './useOrderSummary'

describe('useOrderSummary Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('debería retornar estado inicial de loading', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) // Never resolves
    
    const { result } = renderHook(() => useOrderSummary('test-order-123'))

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBe(null)
    expect(result.current.summary).toBe(null)
  })

  it('debería establecer error si orderId falta', () => {
    const { result } = renderHook(() => useOrderSummary(null))

    expect(result.current.error).toBe('Order ID is required')
    expect(result.current.loading).toBe(false)
    expect(result.current.summary).toBe(null)
  })

  it('debería obtener resumen exitosamente', async () => {
    const mockData = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      items: [],
      client_name: 'Juan',
      pricing_breakdown: {
        subtotal: 100,
        tax_amount: 19,
        tax_percentage: 19,
        total: 119,
      },
    }

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
    )

    const { result } = renderHook(() =>
      useOrderSummary('550e8400-e29b-41d4-a716-446655440000')
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.summary).toEqual(mockData)
    expect(result.current.error).toBe(null)
  })

  it('debería manejar errores de fetch', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      })
    )

    const { result } = renderHook(() =>
      useOrderSummary('invalid-order-id')
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeDefined()
    expect(result.current.summary).toBe(null)
  })

  it('debería usar la URL correcta del API', async () => {
    const orderId = '550e8400-e29b-41d4-a716-446655440000'
    
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    )

    renderHook(() => useOrderSummary(orderId))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const call = global.fetch.mock.calls[0][0]
    expect(call).toContain(orderId)
    expect(call).toContain('/api/orders/')
    expect(call).toContain('/summary')
  })
})
