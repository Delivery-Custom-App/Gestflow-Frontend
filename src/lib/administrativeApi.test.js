/**
 * Vinculación de MercadoPago: el terminal cuelga de la CAJA FÍSICA, no del turno.
 *
 * Backend V2 expone estas acciones bajo `/cajas-fisicas/{id}/mp/...`. El front
 * las pedía bajo `/cajas/{id}/mp/...` y recibía 404 en las tres. Estas pruebas
 * fijan las rutas correctas para que la regresión no vuelva en silencio.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest } from './apiClient'
import {
  assignExistingMpPos,
  cambiarEstadoCajaFisica,
  eliminarCajaFisica,
  listarCajasFisicas,
  getCajasByLocal,
  getCajasFisicasByLocal,
  getVentasIndicadores,
  getDashboardSalesReport,
  mapDashboardSalesReport,
  provisionCajaFisicaMp,
  verifyCajaFisicaMpPairing,
} from './administrativeApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const LOCAL = 'loc-1'
const CAJA_FISICA = 'cf-1'

const rutasPedidas = () => apiRequest.mock.calls.map(([path]) => String(path))

describe('Vinculación MercadoPago por caja física', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-26T12:00:00'))
    apiRequest.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('provisionar apunta a /cajas-fisicas/{id}/mp/provision', async () => {
    await provisionCajaFisicaMp(CAJA_FISICA)

    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas/cf-1/mp/provision', { method: 'POST' })
    expect(rutasPedidas().some((p) => p.startsWith('/cajas/'))).toBe(false)
  })

  it('verificar el emparejamiento apunta a /cajas-fisicas/{id}/mp/verify-pairing', async () => {
    await verifyCajaFisicaMpPairing(CAJA_FISICA)

    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas/cf-1/mp/verify-pairing', { method: 'POST' })
    expect(rutasPedidas().some((p) => p.startsWith('/cajas/'))).toBe(false)
  })

  it('asignar un POS existente apunta a /cajas-fisicas/{id}/mp/assign-existing', async () => {
    await assignExistingMpPos(CAJA_FISICA, 'pos-9')

    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas/cf-1/mp/assign-existing', {
      method: 'POST',
      body: { mercadopago_pos_id: 'pos-9' },
    })
  })

  it('lista las cajas físicas con su estado MP y normaliza nombre a name', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/cajas-fisicas')) {
        return Promise.resolve([
          { id: 'cf-1', nombre: 'Caja principal', is_active: true },
          { id: 'cf-2', nombre: 'Caja terraza', is_active: true },
        ])
      }
      if (path.includes('/mp/cajas-fisicas-status')) {
        return Promise.resolve([
          { caja_fisica_id: 'cf-2', pairing_status: 'paired', terminal_id: 'PAX-123' },
        ])
      }
      return Promise.resolve([])
    })

    const filas = await getCajasFisicasByLocal(LOCAL)

    expect(rutasPedidas()).toContain('/cajas-fisicas?local_id=loc-1')
    expect(rutasPedidas()).toContain('/locals/loc-1/mp/cajas-fisicas-status')
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ id: 'cf-1', name: 'Caja principal', mp: null })
    expect(filas[1]).toMatchObject({ id: 'cf-2', name: 'Caja terraza' })
    expect(filas[1].mp).toMatchObject({ pairing_status: 'paired', terminal_id: 'PAX-123' })
  })

  it('si el estado MP falla, las cajas se listan igual pero marcadas como estado no consultable', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/cajas-fisicas')) return Promise.resolve([{ id: 'cf-1', nombre: 'Caja 1' }])
      return Promise.reject(new Error('403'))
    })

    const filas = await getCajasFisicasByLocal(LOCAL)

    expect(filas).toHaveLength(1)
    expect(filas[0].mp).toBeNull()
    // Sin vinculación y sin poder consultarla son cosas distintas: el segundo
    // caso no debe pintarse como "Sin vincular".
    expect(filas[0].mpDisponible).toBe(false)
  })

  it('si el estado MP responde, las filas quedan marcadas como consultables', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/cajas-fisicas')) return Promise.resolve([{ id: 'cf-1', nombre: 'Caja 1' }])
      if (path.includes('/mp/cajas-fisicas-status')) return Promise.resolve([])
      return Promise.resolve([])
    })

    const filas = await getCajasFisicasByLocal(LOCAL)

    expect(filas[0].mpDisponible).toBe(true)
    expect(filas[0].mp).toBeNull()
  })

  it('los indicadores de Ventas los calcula el backend, sin bajar el histórico de órdenes', async () => {
    vi.setSystemTime(new Date('2026-09-26T12:00:00'))
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/reports/sales')) {
        const dia = new URLSearchParams(path.split('?')[1]).get('start_date')
        return Promise.resolve({ total_sales: dia === '2026-09-26' ? '9400.00' : '1000.00', total_orders: dia === '2026-09-26' ? 2 : 1 })
      }
      if (path.startsWith('/reports/products')) {
        return Promise.resolve({ ranking: [{ product_id: 'p1', product_name: 'Café Americano', quantity_sold: '6.000', revenue: '15000.00' }] })
      }
      if (path.startsWith('/cajas/resumen-diario')) {
        return Promise.resolve({
          total_ingresos: '9400.00',
          por_metodo: [
            { payment_method: 'cash', total: '5000.00' },
            { payment_method: 'debit', total: '2000.00' },
            { payment_method: 'mercadopago', total: '2400.00' },
          ],
        })
      }
      return Promise.resolve([])
    })

    const ind = await getVentasIndicadores(LOCAL)

    // Nunca se pide el listado completo de órdenes.
    expect(rutasPedidas().some((p) => p.startsWith('/orders'))).toBe(false)
    // Siete días de tendencia, uno por consulta agregada.
    expect(rutasPedidas().filter((p) => p.startsWith('/reports/sales'))).toHaveLength(7)
    expect(ind.tendencia).toHaveLength(7)
    expect(ind.tendencia[6]).toMatchObject({ ingresos: 9400 })
    // Totales y desglose por método, del arqueo del día.
    expect(ind.hoy).toEqual({ total: 9400, ordenes: 2 })
    expect(ind.porMetodo).toEqual({ efectivo: 5000, tarjetas: 2000, otros: 2400 })
    // Ranking del backend, ya mapeado.
    expect(ind.topProductos[0]).toMatchObject({ product_name: 'Café Americano', units_sold: 6, revenue: 15000 })
  })

  it('si un día del período falla, la tendencia lo cuenta como cero y no rompe', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.startsWith('/reports/sales')) return Promise.reject(new Error('500'))
      return Promise.resolve({})
    })

    const ind = await getVentasIndicadores(LOCAL)

    expect(ind.tendencia).toHaveLength(7)
    expect(ind.tendencia.every((p) => p.ingresos === 0)).toBe(true)
    expect(ind.topProductos).toEqual([])
  })

  it('las cajas (turnos) ya no consultan el estado MP, que era por turno y no existe', async () => {
    apiRequest.mockResolvedValue([])

    await getCajasByLocal(LOCAL, 'token')

    expect(rutasPedidas().some((p) => p.includes('/mp/cajas-status'))).toBe(false)
    expect(rutasPedidas()).toContain('/cajas?local_id=loc-1')
  })
})

describe('reporte de ventas del dashboard (T-31)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequest.mockResolvedValue({
      total_sales: '16600.00',
      total_orders: 3,
      avg_ticket: '5533.33',
      cancelled_orders: 2,
      by_day: [
        { date: '2026-10-08', total_sales: '0', total_orders: 0 },
        { date: '2026-10-09', total_sales: '1000', total_orders: 1 },
        { date: '2026-10-10', total_sales: '0', total_orders: 0 },
        { date: '2026-10-11', total_sales: '0', total_orders: 0 },
        { date: '2026-10-12', total_sales: '6200', total_orders: 1 },
        { date: '2026-10-13', total_sales: '0', total_orders: 0 },
        { date: '2026-10-14', total_sales: '9400', total_orders: 1 },
      ],
      by_payment_method: [
        { method: 'cash', total: '10000.00', count: 2 },
        { method: 'debit', total: '6600.00', count: 1 },
      ],
      previous_period: { total_sales: '0.00', total_orders: 0 },
    })
  })

  it('hace una sola consulta para los últimos siete días usando la fecha de Chile', async () => {
    const data = await getDashboardSalesReport(LOCAL, new Date('2026-10-15T02:30:00Z'))

    expect(apiRequest).toHaveBeenCalledExactlyOnceWith(
      '/reports/sales?local_id=loc-1&start_date=2026-10-08&end_date=2026-10-14',
    )
    expect(apiRequest.mock.calls.some(([path]) => String(path).startsWith('/orders'))).toBe(false)
    expect(data.by_day).toHaveLength(7)
    expect(data.by_day[0]).toMatchObject({ date: '08/10', ingresos: 0, ordenes: 0 })
    expect(data.by_day[6]).toMatchObject({ date: '14/10', ingresos: 9400, ordenes: 1 })
    expect(data).toMatchObject({
      total_sales: 16600,
      daily_sales: 9400,
      avg_ticket: 5533.33,
      cancelled_orders: 2,
      week_comparison: { current_week_sales: 16600, prev_week_sales: 0, change_pct: null },
    })
    expect(data.payment_breakdown).toEqual([
      { method: 'cash', total: 10000, count: 2 },
      { method: 'debit', total: 6600, count: 1 },
    ])
  })

  it('calcula la variación porcentual sin dividir por cero', () => {
    const data = mapDashboardSalesReport({
      total_sales: '15000',
      previous_period: { total_sales: '5000', total_orders: 1 },
    })

    expect(data.week_comparison.change_pct).toBe(200)
  })
})

describe('cajas físicas: desactivar, reactivar y eliminar (T-75)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('al abrir turnos no se ofrecen las desactivadas', async () => {
    apiRequest.mockResolvedValue([
      { id: 'cf-1', nombre: 'Caja principal', is_active: true },
      { id: 'cf-2', nombre: 'Caja vieja', is_active: false },
    ])
    const filas = await listarCajasFisicas('loc-1')
    expect(filas.map((c) => c.name)).toEqual(['Caja principal'])
  })

  it('desactivar y reactivar usan PATCH is_active', async () => {
    apiRequest.mockResolvedValue({ id: 'cf-1', nombre: 'Caja principal', is_active: false })
    await cambiarEstadoCajaFisica('cf-1', false)
    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas/cf-1', { method: 'PATCH', body: { is_active: false } })
    await cambiarEstadoCajaFisica('cf-1', true)
    expect(apiRequest).toHaveBeenLastCalledWith('/cajas-fisicas/cf-1', { method: 'PATCH', body: { is_active: true } })
  })

  it('eliminar usa DELETE /cajas-fisicas/{id}', async () => {
    apiRequest.mockResolvedValue(null)
    await eliminarCajaFisica('cf-1')
    expect(apiRequest).toHaveBeenCalledWith('/cajas-fisicas/cf-1', { method: 'DELETE' })
  })
})

