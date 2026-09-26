import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { apiRequest, getOptionalAuthContext } from '../lib/apiClient'
import { useLocals } from './useLocals'

vi.mock('../lib/apiClient', () => ({
  apiRequest: vi.fn(),
  getOptionalAuthContext: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useLocals', () => {
  it('sin token no llama a la API y deja locales vacío', async () => {
    getOptionalAuthContext.mockResolvedValue({ token: null, businessId: null })
    const { result } = renderHook(() => useLocals())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(apiRequest).not.toHaveBeenCalled()
    expect(result.current.locales).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('con token y sin businessId pega a /locals', async () => {
    getOptionalAuthContext.mockResolvedValue({ token: 'tok', businessId: null })
    apiRequest.mockResolvedValue([{ id: 'l1' }])
    const { result } = renderHook(() => useLocals())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(apiRequest).toHaveBeenCalledWith('/locals', { token: 'tok' })
    expect(result.current.locales).toEqual([{ id: 'l1' }])
  })

  it('con businessId agrega el filtro a la query', async () => {
    getOptionalAuthContext.mockResolvedValue({ token: 'tok', businessId: 'biz-1' })
    apiRequest.mockResolvedValue([])
    const { result } = renderHook(() => useLocals())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(apiRequest).toHaveBeenCalledWith('/locals?business_id=biz-1', { token: 'tok' })
  })

  it('respuesta no-array cae a []', async () => {
    getOptionalAuthContext.mockResolvedValue({ token: 'tok', businessId: null })
    apiRequest.mockResolvedValue(null)
    const { result } = renderHook(() => useLocals())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.locales).toEqual([])
  })

  it('error en la API se refleja en error y limpia locales', async () => {
    getOptionalAuthContext.mockResolvedValue({ token: 'tok', businessId: null })
    apiRequest.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useLocals())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('network down')
    expect(result.current.locales).toEqual([])
  })

  it('refetch vuelve a pedir los datos', async () => {
    getOptionalAuthContext.mockResolvedValue({ token: 'tok', businessId: null })
    apiRequest.mockResolvedValueOnce([{ id: 'l1' }]).mockResolvedValueOnce([{ id: 'l1' }, { id: 'l2' }])
    const { result } = renderHook(() => useLocals())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.locales).toHaveLength(1)

    await act(async () => {
      await result.current.refetch()
    })
    expect(result.current.locales).toHaveLength(2)
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })
})
