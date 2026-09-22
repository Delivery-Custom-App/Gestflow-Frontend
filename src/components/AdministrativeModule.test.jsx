import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import AdministrativeModule from './AdministrativeModule'
import { getCajasByLocal, getOrdersByLocal } from '../lib/administrativeApi'

vi.mock('../lib/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  getAuthContext: vi.fn(() => Promise.resolve({ token: 'test-token' })),
  apiRequest: vi.fn(() => Promise.resolve([])),
}))

vi.mock('../lib/inventoryApi', async (importOriginal) => ({
  ...(await importOriginal()),
  getLocalById: vi.fn(() => Promise.resolve({ id: 'loc-1', name: 'Sucursal Centro' })),
}))

vi.mock('../hooks/useSelectedLocal', () => ({
  useSelectedLocal: () => null,
}))

vi.mock('./pos/CajaMpPairingModal', () => ({ default: () => null }))

// recharts no dibuja en jsdom: basta con verificar qué datos recibe el gráfico.
vi.mock('./charts/IncomeChart', () => ({
  default: ({ data }) => <p>Tendencia: {data.length} días</p>,
}))

const recent = new Date().toISOString()

const mockOrders = [
  {
    id: 'ord-1', status: 'completed', total_amount: 5000, payment_method: 'cash', created_at: recent,
    items: [{ product_name: 'Café Americano', quantity: 2, unit_price: 2500 }],
  },
  {
    id: 'ord-2', status: 'completed', total_amount: 4500, payment_method: 'debit', created_at: recent,
    items: [{ product_name: 'Sandwich Ave Palta', quantity: 1, unit_price: 4500 }],
  },
]

const mockCajas = [
  { id: 'caja-1', name: 'Caja 1', business_date: '2026-09-13', is_active: true, mp: null },
  { id: 'caja-2', name: 'Caja 2', business_date: '2026-09-12', is_active: false, status: 'closed', mp: null },
]

vi.mock('../lib/administrativeApi', async (importOriginal) => ({
  ...(await importOriginal()),
  getOrdersByLocal: vi.fn(() => Promise.resolve(mockOrders)),
  getLocalDashboard: vi.fn(() => Promise.resolve({ monthly_sales: 120000 })),
  getCajasByLocal: vi.fn(() => Promise.resolve(mockCajas)),
  getResumenDiario: vi.fn(() => Promise.resolve(null)),
}))

function renderAdmin(section) {
  return render(
    <MemoryRouter initialEntries={[`/local/loc-1/administrativo/${section}`]}>
      <Routes>
        <Route path="/local/:localId/administrativo/:sectionId?" element={<AdministrativeModule />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdministrativeModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(['rendiciones', 'reportes', 'alertas', 'bonos', 'dashboard'])(
    'redirige la sección eliminada "%s" a Ventas',
    async (section) => {
      renderAdmin(section)

      expect(await screen.findByRole('heading', { name: 'Ventas' })).toBeInTheDocument()
      await waitFor(() => expect(getOrdersByLocal).toHaveBeenCalledWith('loc-1', 'test-token'))
    },
  )

  it('Ventas incluye la tendencia y el top de productos que antes estaban en Reportes', async () => {
    renderAdmin('ventas')

    expect(await screen.findByText('Tendencia: 7 días')).toBeInTheDocument()
    const topPanel = screen.getByRole('heading', { name: 'Top Productos' }).closest('article')
    expect(within(topPanel).getByText('Café Americano')).toBeInTheDocument()
    expect(within(topPanel).getByText('Sandwich Ave Palta')).toBeInTheDocument()
  })

  it('Caja Virtual muestra ingresos del mes y cajas abiertas, sin gastos ni flujo neto', async () => {
    renderAdmin('flujo-caja')

    const cajasCard = (await screen.findByText('Cajas Abiertas')).closest('article')
    expect(within(cajasCard).getByText('1')).toBeInTheDocument()
    expect(within(cajasCard).getByText('De 2 registradas')).toBeInTheDocument()
    expect(screen.getByText('Ingresos del Mes')).toBeInTheDocument()
    expect(screen.queryByText('Total Gastos')).not.toBeInTheDocument()
    expect(screen.queryByText('Flujo Neto')).not.toBeInTheDocument()
    expect(getCajasByLocal).toHaveBeenCalledWith('loc-1', 'test-token')
  })
})
