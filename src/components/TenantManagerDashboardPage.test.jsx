import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import TenantManagerDashboardPage from './TenantManagerDashboardPage'
import { getPlatformSummary } from '../lib/superAdminApi'

const auth = vi.hoisted(() => ({ getAuthContext: vi.fn() }))
vi.mock('../lib/apiClient', () => ({
  getAuthContext: auth.getAuthContext,
  formatApiErrorDetail: (value) => value,
}))

const salesStats = vi.hoisted(() => ({ getPlatformSummary: vi.fn() }))
vi.mock('../lib/superAdminApi', () => salesStats)

function renderPage() {
  return render(
    <MemoryRouter>
      <TenantManagerDashboardPage />
    </MemoryRouter>,
  )
}

describe('TenantManagerDashboardPage · ventas globales (T-36)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T02:30:00Z'))
    auth.getAuthContext.mockResolvedValue({ token: 'token-superadmin' })
    salesStats.getPlatformSummary.mockResolvedValue({
      generated_at: '2026-10-14T12:00:00Z',
      totals: { businesses: 3, active_businesses: 3, users: 5, locals: 3 },
      orders_by_status: {},
      users_by_role: {},
      businesses_by_plan: {},
      tenants: [
        { id: 'b1', name: 'Marca Alfa', plan: 'professional', is_active: true, locals: 2, users: 3 },
        { id: 'b2', name: 'Marca Beta', plan: 'starter', is_active: true, locals: 1, users: 2 },
        { id: 'b3', name: 'Marca Sin Ventas', plan: 'starter', is_active: true, locals: 0, users: 0 },
      ],
      sales: {
        start_date: '2026-10-01',
        end_date: '2026-10-14',
        total_sales: 12300,
        total_orders: 7,
        by_business: [
          { business_id: 'b2', name: 'Marca Beta', total_sales: 9000, total_orders: 5 },
          { business_id: 'b1', name: 'Marca Alfa', total_sales: 3300, total_orders: 2 },
          { business_id: 'b3', name: 'Marca Sin Ventas', total_sales: 0, total_orders: 0 },
        ],
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('usa el período del mes en Chile, muestra los totales del reporte y ordena negocios por ventas', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Ventas por negocio' })).toBeInTheDocument()
    expect(getPlatformSummary).toHaveBeenCalledExactlyOnceWith(
      { startDate: '2026-10-01', endDate: '2026-10-14' },
      'token-superadmin',
    )
    expect(screen.getByText('Marca Beta')).toBeInTheDocument()
    expect(screen.getByText('Marca Alfa')).toBeInTheDocument()
    expect(screen.queryByText('Marca Sin Ventas')).not.toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('$12.300')).toBeInTheDocument()
    expect(screen.getByText('Marca Beta').compareDocumentPosition(screen.getByText('Marca Alfa'))
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
