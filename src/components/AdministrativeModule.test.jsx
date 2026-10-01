import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import AdministrativeModule from './AdministrativeModule'
import userEvent from '@testing-library/user-event'
import { getCajasByLocal, getOrdersByLocal, getVentasIndicadores } from '../lib/administrativeApi'

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

const mockIndicadores = {
  hoy: { total: 9500, ordenes: 2 },
  porMetodo: { efectivo: 5000, tarjetas: 4500, otros: 0 },
  tendencia: Array.from({ length: 7 }, (_, i) => ({ date: `2${i}/09`, ingresos: 1000 * i, promedio: 3000 })),
  topProductos: [
    { product_id: 'p1', product_name: 'Café Americano', units_sold: 2, revenue: 5000 },
    { product_id: 'p2', product_name: 'Sandwich Ave Palta', units_sold: 1, revenue: 4500 },
  ],
}

const mockCajasFisicas = [
  { id: 'cf-1', name: 'Caja principal', is_active: true, mp: null },
  { id: 'cf-2', name: 'Caja terraza', is_active: true, mp: { pairing_status: 'paired', terminal_id: 'PAX-123' } },
]

vi.mock('../lib/administrativeApi', async (importOriginal) => ({
  ...(await importOriginal()),
  getOrdersByLocal: vi.fn(() => Promise.resolve(mockOrders)),
  getLocalDashboard: vi.fn(() => Promise.resolve({ monthly_sales: 120000 })),
  getCajasByLocal: vi.fn(() => Promise.resolve(mockCajas)),
  getCajasFisicasByLocal: vi.fn(() => Promise.resolve(mockCajasFisicas)),
  getVentasIndicadores: vi.fn(() => Promise.resolve(mockIndicadores)),
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
      await waitFor(() => expect(getVentasIndicadores).toHaveBeenCalledWith('loc-1'))
    },
  )

  it('Ventas incluye la tendencia y el top de productos que antes estaban en Reportes', async () => {
    renderAdmin('ventas')

    expect(await screen.findByText('Tendencia: 7 días')).toBeInTheDocument()
    const topPanel = screen.getByRole('heading', { name: 'Top Productos' }).closest('article')
    expect(within(topPanel).getByText('Café Americano')).toBeInTheDocument()
    expect(within(topPanel).getByText('Sandwich Ave Palta')).toBeInTheDocument()
  })

  it('los indicadores salen de los reportes agregados, sin descargar el histórico de órdenes', async () => {
    renderAdmin('ventas')

    await waitFor(() => expect(getVentasIndicadores).toHaveBeenCalledWith('loc-1'))
    expect(getOrdersByLocal).not.toHaveBeenCalled()

    // Los KPI del día vienen del backend, no de sumar órdenes en el navegador.
    const kpi = (await screen.findByText('Total Hoy')).closest('article')
    expect(within(kpi).getByText('$9.500')).toBeInTheDocument()
    expect(within(kpi).getByText('2 ventas')).toBeInTheDocument()
  })

  it('el detalle orden por orden se descarga solo si el usuario lo pide', async () => {
    const user = userEvent.setup()
    renderAdmin('ventas')

    const boton = await screen.findByRole('button', { name: 'Cargar detalle de órdenes' })
    expect(getOrdersByLocal).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Ventas del Día' })).not.toBeInTheDocument()

    await user.click(boton)

    await waitFor(() => expect(getOrdersByLocal).toHaveBeenCalledWith('loc-1', 'test-token'))
    expect(await screen.findByRole('heading', { name: 'Ventas del Día' })).toBeInTheDocument()
  })

  it('Caja Virtual vincula MercadoPago desde las cajas físicas, no desde los turnos', async () => {
    renderAdmin('flujo-caja')

    // El panel de cajas físicas es el que ofrece la vinculación.
    const panelFisicas = (await screen.findByRole('heading', { name: 'Cajas físicas' })).closest('article')
    expect(within(panelFisicas).getByText('Caja principal')).toBeInTheDocument()
    expect(within(panelFisicas).getByText('PAX-123')).toBeInTheDocument()
    expect(within(panelFisicas).getAllByRole('button').length).toBe(mockCajasFisicas.length)

    // La tabla de turnos ya no habla de MercadoPago: ese estado era por caja física.
    const panelTurnos = screen.getByRole('heading', { name: 'Cajas del Local' }).closest('article')
    expect(within(panelTurnos).queryByText('MercadoPago')).not.toBeInTheDocument()
    expect(within(panelTurnos).queryByText('Vincular MP')).not.toBeInTheDocument()
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
