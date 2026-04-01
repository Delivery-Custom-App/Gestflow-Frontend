import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAvailableLocals } from './useAvailableLocals'

describe('useAvailableLocals Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('debería retornar estado inicial de loading', () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    
    const { result } = renderHook(() => useAvailableLocals('business-123'))

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBe(null)
    expect(result.current.locals).toEqual([])
  })

  it('debería establecer error si businessId falta', () => {
    const { result } = renderHook(() => useAvailableLocals(null))

    expect(result.current.error).toBe('Business ID is required')
    expect(result.current.loading).toBe(false)
  })

  it('debería obtener lista de locales exitosamente', async () => {
    const mockLocals = [
      {
        id: 'local-1',
        name: 'Local Centro',
        address: 'Calle Principal 123',
        phone: '+56 9 1234 5678',
      },
      {
        id: 'local-2',
        name: 'Local Norte',
        address: 'Avenida Norte 456',
        phone: '+56 9 8765 4321',
      },
    ]

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockLocals),
      })
    )

    const { result } = renderHook(() => useAvailableLocals('business-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.locals).toEqual(mockLocals)
    expect(result.current.error).toBe(null)
  })

  it('debería retornar array vacío si no hay locales', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(null),
      })
    )

    const { result } = renderHook(() => useAvailableLocals('business-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.locals).toEqual([])
  })

  it('debería manejar errores de fetch', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      })
    )

    const { result } = renderHook(() => useAvailableLocals('business-123'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeDefined()
  })

  it('debería construir la URL correcta', async () => {
    const businessId = 'business-123'
    
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      })
    )

    renderHook(() => useAvailableLocals(businessId))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const call = global.fetch.mock.calls[0][0]
    expect(call).toContain(businessId)
    expect(call).toContain('/api/locals/by-business/')
    expect(call).toContain('/available')
  })
})
