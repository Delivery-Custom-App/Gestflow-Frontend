import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SuppliersKpisDashboard from './SuppliersKpisDashboard'

vi.mock('../../lib/apiClient', () => ({
  getAuthContext: vi.fn(() => Promise.resolve({ token: 'test-token', businessId: 'biz-1' })),
}))

const mockKpis = {
  total_suppliers: 4,
  active_suppliers: 3,
  month_purchases_clp: 1250000,
  year: 2026,
  month: 4,
  period_start: '2026-04-01',
  period_end: '2026-04-30',
}

vi.mock('../../lib/inventoryApi', () => ({
  getSupplierKpisByLocal: vi.fn(() => Promise.resolve(mockKpis)),
  getSuppliersWithMetricsForBusiness: vi.fn(() =>
    Promise.resolve([
      {
        id: 's-1',
        name: 'Proveedor Demo',
        is_active: true,
        purchased_products_count: 12,
        supplier_purchases_total_clp: 48000,
      },
    ]),
  ),
  getLocalById: vi.fn(),
}))

const mockUser = { email: 'a@b.cl', user_metadata: {} }

function renderSuppliers(role = 'Admin') {
  return render(
    <MemoryRouter initialEntries={['/local/loc-1/inventario/proveedores']}>
      <Routes>
        <Route
          path="/local/:localId/inventario/proveedores"
          element={<SuppliersKpisDashboard user={mockUser} userRole={role} onLogout={vi.fn()} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SuppliersKpisDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra tres KPIs: total, activos y compras del mes', async () => {
    renderSuppliers('Admin')

    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument()
    })

    const region = screen.getByRole('region', { name: /KPIs de proveedores/i })
    const labels = [...region.querySelectorAll('.scd-kpi-label')].map((el) => el.textContent.trim())

    expect(labels).toEqual(['Total proveedores', 'Proveedores activos', 'Compras del mes (CLP)'])

    const values = [...region.querySelectorAll('.scd-kpi-value')].map((el) => el.textContent.trim())
    expect(values).toEqual(['4', '3', '$1.250.000'])

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Listado de proveedores/i })).toBeInTheDocument()
    })
    expect(screen.getByText('Proveedor Demo')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('$48.000')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Registrar proveedor/i })).toBeInTheDocument()
  })

  it('sin rol admin muestra mensaje de permisos', async () => {
    renderSuppliers('Empleado')

    await waitFor(() => {
      expect(
        screen.getByText(/Solo administradores \(Admin o Superadmin\) pueden ver los KPIs de proveedores/i),
      ).toBeInTheDocument()
    })
  })
})
