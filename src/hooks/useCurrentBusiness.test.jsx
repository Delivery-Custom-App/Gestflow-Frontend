/** Datos del negocio desde /auth/me (A-09). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCurrentBusiness } from './useCurrentBusiness'
import { getBusiness, getOptionalAuthContext } from '../lib/apiClient'

const sesion = vi.hoisted(() => ({ userRole: 'Admin', user: null }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => sesion }))
vi.mock('../lib/apiClient', () => ({ getBusiness: vi.fn(), getOptionalAuthContext: vi.fn() }))

const PERFIL = { id: 'u1', business_id: 'b1', business_name: 'Café GestFlow Demo', business_plan: 'pro', local_name: 'Sucursal Centro', local_sales_model: 'RESTAURANT' }

beforeEach(() => {
  vi.clearAllMocks()
  getOptionalAuthContext.mockResolvedValue({ token: 't', businessId: 'b1' })
  getBusiness.mockResolvedValue({ id: 'b1', name: 'Nombre del negocio', plan: 'pro' })
})

describe('useCurrentBusiness', () => {
  it.each(['Admin', 'Empleado'])('%s: toma nombre y plan de /auth/me y no llama a /businesses/{id}', (rol) => {
    sesion.userRole = rol
    sesion.user = PERFIL
    const { result } = renderHook(() => useCurrentBusiness())
    expect(result.current).toEqual({ business: { id: 'b1', name: 'Café GestFlow Demo', plan: 'pro' }, loading: false })
    expect(getBusiness).not.toHaveBeenCalled()
  })

  it('el dueño sigue leyendo su negocio', async () => {
    sesion.userRole = 'Admin Negocio'
    sesion.user = PERFIL
    const { result } = renderHook(() => useCurrentBusiness())
    await waitFor(() => expect(result.current.business).toEqual({ id: 'b1', name: 'Nombre del negocio', plan: 'pro' }))
    expect(getBusiness).toHaveBeenCalledWith('b1')
  })
})
