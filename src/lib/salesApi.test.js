import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, getOptionalAuthContext } from './apiClient'
import { getActiveCaja, todayIso } from './salesApi'

vi.mock('./apiClient', () => ({
  apiRequest: vi.fn(),
  getOptionalAuthContext: vi.fn(),
}))

describe('getActiveCaja — cierre de caja diario', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T15:00:00'))
    getOptionalAuthContext.mockResolvedValue({ user: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('ignora una caja abierta cuyo business_date no es hoy (no forzó cierre a medianoche)', async () => {
    apiRequest.mockResolvedValue([
      { id: 'caja-ayer', status: 'open', business_date: '2026-08-31', cashier_user_id: 'u1' },
    ])
    const result = await getActiveCaja('local-1')
    expect(result).toBeNull()
  })

  it('devuelve la caja abierta de hoy', async () => {
    apiRequest.mockResolvedValue([
      { id: 'caja-ayer', status: 'open', business_date: '2026-08-31', cashier_user_id: 'u1' },
      { id: 'caja-hoy', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u1' },
    ])
    const result = await getActiveCaja('local-1')
    expect(result?.id).toBe('caja-hoy')
  })

  it('prefiere la caja de hoy del usuario actual sobre la de otro cajero', async () => {
    getOptionalAuthContext.mockResolvedValue({ user: { id: 'u2' } })
    apiRequest.mockResolvedValue([
      { id: 'caja-otro', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u1' },
      { id: 'caja-mia', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u2' },
    ])
    const result = await getActiveCaja('local-1')
    expect(result?.id).toBe('caja-mia')
  })

  it('todayIso() refleja la fecha simulada', () => {
    expect(todayIso()).toBe('2026-09-01')
  })
})
