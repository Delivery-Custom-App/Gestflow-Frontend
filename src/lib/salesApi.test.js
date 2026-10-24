import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, getOptionalAuthContext } from './apiClient'
import { addOrderItem, completeOrderCash, completeOrderMercadoPago, createCajaV2, createOrder, getActiveCaja, getBoleta, getMiTurnoDeHoy, listCajas, todayIso, closeCaja, terminarTurno, updateOrderFields } from './salesApi'

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

  it('#141: un turno terminado no sirve para vender', async () => {
    getOptionalAuthContext.mockResolvedValue({ user: { id: 'u2', role: 'ADMIN_NEGOCIO' } })
    apiRequest.mockResolvedValue([
      { id: 'caja-mia', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u2', turno_terminado_at: '2026-09-01T14:00:00Z' },
    ])
    expect(await getActiveCaja('local-1')).toBeNull()
  })

  it('#141: con la caja física mandando, el dueño sin turno propio no vende en el de otra persona', async () => {
    const { V2_FEATURES } = await import('./v2Features')
    V2_FEATURES.cajaFisicaManda = true
    try {
      getOptionalAuthContext.mockResolvedValue({ user: { id: 'u2', role: 'ADMIN_NEGOCIO' } })
      apiRequest.mockResolvedValue([{ id: 'caja-otro', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u1' }])
      expect(await getActiveCaja('local-1')).toBeNull()
      apiRequest.mockResolvedValue([
        { id: 'caja-otro', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u1' },
        { id: 'caja-mia', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u2' },
      ])
      expect((await getActiveCaja('local-1'))?.id).toBe('caja-mia')
    } finally {
      V2_FEATURES.cajaFisicaManda = false
    }
  })

  it('el vendedor sin turno propio no recibe el turno de otra persona', async () => {
    getOptionalAuthContext.mockResolvedValue({ user: { id: 'u2', role: 'EMPLEADO' } })
    apiRequest.mockResolvedValue([
      { id: 'caja-otro', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u1' },
    ])
    expect(await getActiveCaja('local-1')).toBeNull()
  })

  it('el vendedor con su turno de hoy vende en el suyo', async () => {
    getOptionalAuthContext.mockResolvedValue({ user: { id: 'u2', role: 'EMPLEADO' } })
    apiRequest.mockResolvedValue([
      { id: 'caja-otro', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u1' },
      { id: 'caja-mia', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u2' },
    ])
    expect((await getActiveCaja('local-1'))?.id).toBe('caja-mia')
  })

  it('el encargado sin turno propio sigue usando el abierto del local', async () => {
    getOptionalAuthContext.mockResolvedValue({ user: { id: 'enc', role: 'ADMIN' } })
    apiRequest.mockResolvedValue([
      { id: 'caja-vendedor', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u1' },
    ])
    expect((await getActiveCaja('local-1'))?.id).toBe('caja-vendedor')
  })
})

describe('getMiTurnoDeHoy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T15:00:00'))
    getOptionalAuthContext.mockResolvedValue({ user: { id: 'u2', role: 'EMPLEADO' } })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('devuelve el turno abierto hoy de quien pregunta', async () => {
    apiRequest.mockResolvedValue([
      { id: 'caja-otro', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u1' },
      { id: 'caja-mia', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u2' },
    ])
    expect((await getMiTurnoDeHoy('local-1'))?.id).toBe('caja-mia')
    expect(apiRequest).toHaveBeenCalledWith('/cajas?local_id=local-1')
  })

  it('un turno propio de ayer que nadie cerró no cuenta', async () => {
    apiRequest.mockResolvedValue([
      { id: 'caja-ayer', status: 'open', business_date: '2026-08-31', cashier_user_id: 'u2' },
    ])
    expect(await getMiTurnoDeHoy('local-1')).toBeNull()
  })

  it('un turno propio ya cerrado no cuenta', async () => {
    apiRequest.mockResolvedValue([
      { id: 'caja-cerrada', status: 'closed', business_date: '2026-09-01', cashier_user_id: 'u2' },
    ])
    expect(await getMiTurnoDeHoy('local-1')).toBeNull()
  })

  it('sin sesión no hay turno propio', async () => {
    getOptionalAuthContext.mockResolvedValue({ user: null })
    apiRequest.mockResolvedValue([{ id: 'x', status: 'open', business_date: '2026-09-01', cashier_user_id: 'u2' }])
    expect(await getMiTurnoDeHoy('local-1')).toBeNull()
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

describe('tip en el pago (T-33)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('guarda la propina en el PATCH sin cambiar el estado de la orden', async () => {
    apiRequest.mockResolvedValue({ id: 'ord-1', status: 'ready', tip_amount: '1200.00' })

    await updateOrderFields('ord-1', { tip_amount: 1200 }, '2026-10-04T12:00:00Z')

    expect(apiRequest).toHaveBeenCalledWith('/orders/ord-1?created_at=2026-10-04T12%3A00%3A00Z', {
      method: 'PATCH',
      body: { tip_amount: 1200 },
    })
  })

  it('incluye la propina al cerrar el pago en efectivo', async () => {
    apiRequest.mockResolvedValue({ id: 'ord-1', status: 'completed', payment_method: 'cash', tip_amount: 1000 })

    await completeOrderCash('ord-1', 6000, undefined, 1000)

    expect(apiRequest).toHaveBeenCalledWith('/orders/ord-1', {
      method: 'PATCH',
      body: { status: 'completed', payment_method: 'cash', tip_amount: 1000 },
    })
  })
})

describe('createCajaV2 — apertura de turno (contrato del ticket #40)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOptionalAuthContext.mockResolvedValue({ user: { id: 'u-1' } })
    apiRequest.mockResolvedValue({ id: 'caja-9', caja_fisica_id: 'cf-1', status: 'open' })
  })

  it('abre el turno sobre la caja física, no sobre el local', async () => {
    await createCajaV2({ caja_fisica_id: 'cf-1', monto_apertura: 50000 })

    expect(apiRequest).toHaveBeenCalledWith('/cajas', {
      method: 'POST',
      body: { caja_fisica_id: 'cf-1', cashier_user_id: 'u-1', monto_apertura: 50000 },
    })
    // local_id era el contrato viejo: el backend lo deriva de la caja física
    // y responde 422 si falta caja_fisica_id.
    expect(apiRequest.mock.calls[0][1].body).not.toHaveProperty('local_id')
  })

  it('no manda la petición si no se eligió caja física', async () => {
    await expect(createCajaV2({ monto_apertura: 1000 })).rejects.toThrow(/caja física/i)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('toma el cajero de la sesión cuando no se pasa', async () => {
    await createCajaV2({ caja_fisica_id: 'cf-2' })

    expect(apiRequest.mock.calls[0][1].body.cashier_user_id).toBe('u-1')
  })

  it('sin monto abre el turno en cero, no en NaN', async () => {
    await createCajaV2({ caja_fisica_id: 'cf-2' })

    expect(apiRequest.mock.calls[0][1].body.monto_apertura).toBe(0)
  })

  it('manda el desglose de billetes y monedas solo si viene (T-40 / B-28)', async () => {
    const desglose = [{ denominacion: 1000, tipo: 'billete', cantidad: 2 }]
    await createCajaV2({ caja_fisica_id: 'cf-2', monto_apertura: 2000, apertura_desglose: desglose })
    expect(apiRequest.mock.calls[0][1].body.apertura_desglose).toEqual(desglose)

    await createCajaV2({ caja_fisica_id: 'cf-2', monto_apertura: 0, apertura_desglose: [] })
    expect(apiRequest.mock.calls[1][1].body).not.toHaveProperty('apertura_desglose')
  })

  it('sin usuario en sesión no intenta abrir el turno', async () => {
    getOptionalAuthContext.mockResolvedValue({ user: null })

    await expect(createCajaV2({ caja_fisica_id: 'cf-1' })).rejects.toThrow(/quién abre el turno/i)
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('el turno devuelto se presenta como turno, no como caja', async () => {
    apiRequest.mockResolvedValue({ id: 'abcdef12-3456', caja_fisica_id: 'cf-1', status: 'open' })

    const turno = await createCajaV2({ caja_fisica_id: 'cf-1' })

    expect(turno.name).toBe('Turno abcdef12')
    expect(turno.is_active).toBe(true)
  })
})

describe('createOrder — quién atiende la mesa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOptionalAuthContext.mockResolvedValue({ user: { id: 'u-ana' } })
    apiRequest.mockResolvedValue({ id: 'o-1', created_at: '2026-10-04T12:00:00Z' })
  })
  const cuerpoDeLaOrden = () => apiRequest.mock.calls.find(([ruta, o]) => ruta === '/orders' && o?.method === 'POST')[1].body

  it('al abrir una mesa queda registrado que la atiende quien la abre', async () => {
    await createOrder({ local_id: 'l1', caja_id: 'c1', mesa_id: 'm1', source: 'dine_in' })
    expect(cuerpoDeLaOrden()).toMatchObject({ mesa_id: 'm1', waiter_user_id: 'u-ana' })
  })

  it('guarda la cantidad de comensales al abrir la mesa', async () => {
    await createOrder({ local_id: 'l1', caja_id: 'c1', mesa_id: 'm1', source: 'dine_in', guests: 4 })
    expect(cuerpoDeLaOrden()).toMatchObject({ guests: 4 })
  })

  it('se puede indicar otro mesero', async () => {
    await createOrder({ local_id: 'l1', caja_id: 'c1', mesa_id: 'm1', waiter_user_id: 'u-beto' })
    expect(cuerpoDeLaOrden().waiter_user_id).toBe('u-beto')
  })

  it('una venta sin mesa no lleva mesero (el backend lo rechaza fuera de los locales con mesas)', async () => {
    await createOrder({ local_id: 'l1', caja_id: 'c1', source: 'mostrador' })
    expect(cuerpoDeLaOrden()).not.toHaveProperty('waiter_user_id')
  })
})

describe('Idempotency-Key (T-64)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('usa una clave distinta para crear la orden y cada ítem del lote', async () => {
    apiRequest
      .mockResolvedValueOnce({ id: 'ord-1', created_at: '2026-10-14T12:00:00Z' })
      .mockResolvedValueOnce({ id: 'item-1', product_id: 'prod-1', quantity: 2, unit_price: 500, subtotal: 1000 })
      .mockResolvedValueOnce({ id: 'item-2', product_id: 'prod-2', quantity: 1, unit_price: 800, subtotal: 800 })

    await createOrder({
      local_id: 'local-1',
      caja_id: 'caja-1',
      items: [{ product_id: 'prod-1', quantity: 2 }, { product_id: 'prod-2', quantity: 1 }],
      idempotency_key: 'accion-1',
    })

    expect(apiRequest.mock.calls[0][1].headers).toEqual({ 'Idempotency-Key': 'accion-1:crear' })
    expect(apiRequest.mock.calls[0][1].body).not.toHaveProperty('idempotency_key')
    expect(apiRequest.mock.calls[1][1].headers).toEqual({ 'Idempotency-Key': 'accion-1:item:0' })
    expect(apiRequest.mock.calls[2][1].headers).toEqual({ 'Idempotency-Key': 'accion-1:item:1' })
  })

  it('reutiliza la clave de un ítem en reintentos y omite la cabecera si no hay clave', async () => {
    apiRequest.mockResolvedValue({ id: 'item-1', product_id: 'prod-1', quantity: 1, unit_price: 500, subtotal: 500 })

    await addOrderItem('ord-1', { product_id: 'prod-1', quantity: 1 }, undefined, 'accion-2')
    await addOrderItem('ord-1', { product_id: 'prod-1', quantity: 1 }, undefined, 'accion-2')
    await addOrderItem('ord-1', { product_id: 'prod-1', quantity: 1 })

    expect(apiRequest.mock.calls[0][1].headers).toEqual({ 'Idempotency-Key': 'accion-2' })
    expect(apiRequest.mock.calls[1][1].headers).toEqual({ 'Idempotency-Key': 'accion-2' })
    expect(apiRequest.mock.calls[2][1]).not.toHaveProperty('headers')
  })

  it('no manda la cabecera al crear una orden cuando no se entrega clave', async () => {
    apiRequest.mockResolvedValue({ id: 'ord-1', created_at: '2026-10-14T12:00:00Z' })

    await createOrder({ local_id: 'local-1', caja_id: 'caja-1' })

    expect(apiRequest.mock.calls[0][1]).not.toHaveProperty('headers')
  })
})

describe('listCajas (A-01): filtros en el servidor', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('manda business_date, status y cashier_user_id solo si vienen', async () => {
    apiRequest.mockResolvedValue([{ id: 'c1', status: 'open', total_ingresos: '100.00' }])
    await listCajas('loc-1')
    await listCajas('loc-1', { businessDate: '2026-10-14', status: 'closed', cashierUserId: 'u1' })
    expect(apiRequest.mock.calls.map(([p]) => p)).toEqual([
      '/cajas?local_id=loc-1',
      '/cajas?local_id=loc-1&business_date=2026-10-14&status=closed&cashier_user_id=u1',
    ])
  })
})

describe('closeCaja con arqueo (T-55)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('sin conteo cierra como antes', async () => {
    apiRequest.mockResolvedValue({ id: 'c1', status: 'closed' })
    await closeCaja('c1')
    expect(apiRequest).toHaveBeenCalledWith('/cajas/c1', { method: 'PATCH', body: { status: 'closed' } })
  })
  it('con el efectivo contado y la nota', async () => {
    apiRequest.mockResolvedValue({ id: 'c1', status: 'closed' })
    await closeCaja('c1', { montoCierreDeclarado: 8600, notaCierre: '  Vuelto mal dado ' })
    expect(apiRequest).toHaveBeenCalledWith('/cajas/c1', {
      method: 'PATCH', body: { status: 'closed', monto_cierre_declarado: '8600.00', nota_cierre: 'Vuelto mal dado' },
    })
  })
  it('0 contado también se manda', async () => {
    apiRequest.mockResolvedValue({ id: 'c1', status: 'closed' })
    await closeCaja('c1', { montoCierreDeclarado: 0 })
    expect(apiRequest.mock.calls[0][1].body).toEqual({ status: 'closed', monto_cierre_declarado: '0.00' })
  })
})

describe('turno terminado (T-41)', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('terminarTurno llama a POST /cajas/{id}/terminar-turno', async () => {
    apiRequest.mockResolvedValue({ id: 'c1', status: 'open', turno_terminado_at: '2026-10-14T20:00:00Z' })
    const r = await terminarTurno('c1')
    expect(apiRequest).toHaveBeenCalledWith('/cajas/c1/terminar-turno', { method: 'POST' })
    expect(r.turno_terminado_at).toBe('2026-10-14T20:00:00Z')
  })
  it('crear un pedido con el turno terminado se explica', async () => {
    getOptionalAuthContext.mockResolvedValue({ user: { id: 'u1' } })
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('400: El turno de esta caja ya terminó: inicia un turno nuevo'), {
      status: 400, detail: 'El turno de esta caja ya terminó: inicia un turno nuevo',
    }))
    await expect(createOrder({ local_id: 'loc-1', caja_id: 'c1', items: [] })).rejects.toThrow(/Tu turno ya terminó/)
  })
})
