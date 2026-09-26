import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, getOptionalAuthContext } from './apiClient'
import { completeOrderMercadoPago, getActiveCaja, getBoleta, todayIso } from './salesApi'

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

describe('completeOrderMercadoPago — cierre del cobro por checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cierra la orden con PATCH y método de pago mercadopago', async () => {
    apiRequest.mockResolvedValue({ id: 'ord-1', status: 'completed', payment_method: 'mercadopago' })

    await completeOrderMercadoPago('ord-1')

    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenCalledWith('/orders/ord-1', {
      method: 'PATCH',
      body: { status: 'completed', payment_method: 'mercadopago' },
    })
  })

  it('en RESTAURANT camina los estados intermedios si la transición directa es inválida', async () => {
    apiRequest
      .mockRejectedValueOnce(new Error('400: transición inválida'))
      .mockResolvedValue({ id: 'ord-2', status: 'completed', payment_method: 'mercadopago' })

    await completeOrderMercadoPago('ord-2')

    const estados = apiRequest.mock.calls.map(([, opts]) => opts.body.status)
    expect(estados).toEqual(['completed', 'preparing', 'ready', 'completed'])
  })

  it('propaga cualquier otro error en vez de tragárselo', async () => {
    apiRequest.mockRejectedValue(new Error('403: sin permisos'))

    await expect(completeOrderMercadoPago('ord-3')).rejects.toThrow('403: sin permisos')
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it('respeta created_at para las órdenes particionadas', async () => {
    apiRequest.mockResolvedValue({ id: 'ord-4', status: 'completed' })

    await completeOrderMercadoPago('ord-4', '2026-09-26T21:00:00Z')

    expect(apiRequest).toHaveBeenCalledWith(
      '/orders/ord-4?created_at=2026-09-26T21%3A00%3A00Z',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('getBoleta pide el comprobante de la orden', async () => {
    apiRequest.mockResolvedValue({ order_id: 'ord-5', items: [], total: 0 })

    await getBoleta('ord-5')

    expect(apiRequest).toHaveBeenCalledWith('/orders/ord-5/boleta')
  })
})
