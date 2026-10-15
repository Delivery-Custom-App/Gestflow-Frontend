/** Comparativa mensual del Inicio (T-28): cada mes sale de /reports/sales. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest, getOptionalAuthContext } from './apiClient'
import { fetchBusinessSalesSummary, rangosMensuales, variacion } from './businessSalesSummary'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn(), getOptionalAuthContext: vi.fn() }))

const LOCALES = [{ id: 'A' }, { id: 'B' }]
const HOY = new Date(2026, 9, 14, 12, 0, 0) // 14 de octubre de 2026

function params(path) {
  return Object.fromEntries(new URLSearchParams(path.split('?')[1]))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(HOY)
  getOptionalAuthContext.mockResolvedValue({ token: 'tok' })
})
afterEach(() => { vi.useRealTimers() })

describe('rangosMensuales', () => {
  it('cuatro meses con el primer y el último día; el actual se corta hoy', () => {
    expect(rangosMensuales(HOY, 4)).toEqual([
      { label: 'Jul', startDate: '2026-07-01', endDate: '2026-07-31' },
      { label: 'Ago', startDate: '2026-08-01', endDate: '2026-08-31' },
      { label: 'Sep', startDate: '2026-09-01', endDate: '2026-09-30' },
      { label: 'Oct', startDate: '2026-10-01', endDate: '2026-10-14' },
    ])
  })

  it('cruza el año y respeta febrero', () => {
    const r = rangosMensuales(new Date(2026, 2, 5), 3)
    expect(r.map((m) => [m.startDate, m.endDate])).toEqual([
      ['2026-01-01', '2026-01-31'], ['2026-02-01', '2026-02-28'], ['2026-03-01', '2026-03-05'],
    ])
  })
})

describe('variacion', () => {
  it('no divide por cero ni inventa datos', () => {
    expect(variacion(150, 100)).toBe(50)
    expect(variacion(100, 0)).toBeNull()
    expect(variacion(null, 100)).toBeNull()
    expect(variacion(100, null)).toBeNull()
  })
})

describe('fetchBusinessSalesSummary · mensual', () => {
  function responder({ fallaMes } = {}) {
    apiRequest.mockImplementation(async (path) => {
      const p = params(path)
      if (fallaMes && p.start_date === fallaMes && p.local_id === 'B') throw new Error('500: boom')
      if (p.start_date === '2026-10-12') {
        return {
          total_sales: '0',
          total_orders: 0,
          by_day: p.local_id === 'A'
            ? [
                { date: '2026-10-12', total_sales: '100', total_orders: 1 },
                { date: '2026-10-14', total_sales: '300', total_orders: 2 },
              ]
            : [{ date: '2026-10-14', total_sales: '400', total_orders: 1 }],
        }
      }
      // Ventas simuladas: julio y agosto con datos, el resto en 0.
      const ventas = { '2026-07-01': { A: '1000.00', B: '500.00' }, '2026-08-01': { A: '2000.00', B: '1000.00' } }
      return { total_sales: ventas[p.start_date]?.[p.local_id] ?? '0', total_orders: 1 }
    })
  }

  it('una llamada a /reports/sales por local y mes, con el filtro de local', async () => {
    responder()
    await fetchBusinessSalesSummary(LOCALES)
    const reportes = apiRequest.mock.calls.map(([p]) => p).filter((p) => p.startsWith('/reports/sales') && params(p).start_date !== '2026-10-12')
    expect(reportes).toHaveLength(8)
    expect(params(reportes[0])).toEqual({ local_id: 'A', start_date: '2026-07-01', end_date: '2026-07-31' })
    expect(reportes.map((p) => params(p).local_id).sort()).toEqual(['A', 'A', 'A', 'A', 'B', 'B', 'B', 'B'])
    expect(reportes.some((p) => params(p).end_date === '2026-10-14')).toBe(true)
    expect(apiRequest.mock.calls.some(([path]) => String(path).startsWith('/orders'))).toBe(false)
  })

  it('suma total_sales de los locales y calcula la variación entre meses', async () => {
    responder()
    const { monthly } = await fetchBusinessSalesSummary(LOCALES)
    expect(monthly.months.map((m) => [m.label, m.total])).toEqual([['Jul', 1500], ['Ago', 3000], ['Sep', 0], ['Oct', 0]])
    expect(monthly.months[1].momPercent).toBe(100)
    expect(monthly.months[2].momPercent).toBe(-100)
    expect(monthly.months[3].momPercent).toBeNull()
  })

  it('consolida el gráfico semanal desde by_day, agrupado por fecha contable', async () => {
    responder()
    const { weekly } = await fetchBusinessSalesSummary(LOCALES)

    expect(weekly.days[0]).toMatchObject({ total: 100, count: 1, isFuture: false })
    expect(weekly.days[2]).toMatchObject({ total: 700, count: 3, isToday: true })
    expect(weekly.total).toBe(800)
  })

  it('si falla un mes, ese mes queda en null (se muestra «—», no 0)', async () => {
    responder({ fallaMes: '2026-08-01' })
    const { monthly } = await fetchBusinessSalesSummary(LOCALES)
    expect(monthly.months[1].total).toBeNull()
    expect(monthly.months[1].momPercent).toBeNull()
    expect(monthly.months[2].momPercent).toBeNull()
    expect(monthly.months[0].total).toBe(1500)
  })
})
