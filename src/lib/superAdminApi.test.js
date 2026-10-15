import { describe, expect, it, vi } from 'vitest'
import { apiRequest } from './apiClient'
import { getGlobalSalesReport } from './superAdminApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

describe('getGlobalSalesReport (T-36)', () => {
  it('consulta ventas globales por fechas, sin filtro de negocio ni local', async () => {
    apiRequest.mockResolvedValue({ total_sales: '12000', total_orders: 4, by_business: [] })

    const report = await getGlobalSalesReport({ startDate: '2026-10-01', endDate: '2026-10-14' }, 'token')

    expect(apiRequest).toHaveBeenCalledExactlyOnceWith(
      '/reports/sales?start_date=2026-10-01&end_date=2026-10-14',
      { token: 'token' },
    )
    expect(apiRequest.mock.calls[0][0]).not.toMatch(/business_id|local_id/)
    expect(report.by_business).toEqual([])
  })
})
