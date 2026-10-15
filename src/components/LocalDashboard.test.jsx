/**
 * Dashboard del local sin "Ver detalles" (y su panel lateral) ni "Procesos
 * Recientes"; la guía tampoco los menciona.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import LocalDashboard from './LocalDashboard'
import { getDashboardSalesReport } from '../lib/administrativeApi'

vi.mock('../lib/apiClient', () => ({ getAuthContext: vi.fn(() => Promise.resolve({ token: 't' })) }))
vi.mock('../lib/inventoryApi', () => ({ getInventoryKpisByLocal: vi.fn(() => Promise.resolve({ total_products: 3 })) }))
const salesApi = vi.hoisted(() => ({ getDashboardSalesReport: vi.fn() }))
vi.mock('../lib/administrativeApi', () => salesApi)
// recharts no dibuja en jsdom: basta con que no rompa.
vi.mock('recharts', async () => {
  const { createElement } = await import('react')
  const caja = ({ children }) => createElement('div', null, children)
  const nombres = ['BarChart', 'Bar', 'Cell', 'XAxis', 'YAxis', 'CartesianGrid', 'ResponsiveContainer', 'Tooltip',
    'PieChart', 'Pie', 'LabelList', 'LineChart', 'Line', 'Legend']
  return Object.fromEntries(nombres.map((n) => [n, caja]))
})
vi.mock('./charts/IncomeChart', () => ({ default: () => null }))
const banderas = vi.hoisted(() => ({ fondoEmergencia: false }))
vi.mock('../lib/v2Features', () => ({ isV2FeatureEnabled: (k) => Boolean(banderas[k]) }))
vi.mock('./TarjetaFondoEmergencia', () => ({ default: ({ localId }) => <p>tarjeta-fondo {localId}</p> }))

beforeEach(() => {
  salesApi.getDashboardSalesReport.mockReset().mockResolvedValue({
    total_sales: 16600,
    total_orders: 3,
    daily_sales: 9400,
    avg_ticket: 8300,
    cancelled_orders: 2,
    by_day: [
      { date: '08/10', ingresos: 0, ordenes: 0 },
      { date: '09/10', ingresos: 1200, ordenes: 1 },
      { date: '10/10', ingresos: 0, ordenes: 0 },
      { date: '11/10', ingresos: 0, ordenes: 0 },
      { date: '12/10', ingresos: 6000, ordenes: 1 },
      { date: '13/10', ingresos: 0, ordenes: 0 },
      { date: '14/10', ingresos: 9400, ordenes: 1 },
    ],
    payment_breakdown: [
      { method: 'cash', total: 10000, count: 2 },
      { method: 'debit', total: 5000, count: 1 },
      { method: 'sin_metodo', total: 1600, count: 1 },
    ],
    week_comparison: {
      current_week_sales: 16600,
      prev_week_sales: 0,
      change_pct: null,
    },
  })
})

afterEach(() => { banderas.fondoEmergencia = false })

function montar() {
  return render(
    <MemoryRouter initialEntries={['/local/l1/dashboard']}>
      <Routes><Route path="/local/:localId/dashboard" element={<LocalDashboard />} /></Routes>
    </MemoryRouter>,
  )
}

describe('LocalDashboard', () => {
  it('carga las ventas del dashboard con un único reporte agregado, sin descargar órdenes', async () => {
    montar()

    expect(await screen.findByText('Pedidos cancelados')).toBeInTheDocument()
    expect(screen.getByText('Ventas últimos 7 días')).toBeInTheDocument()
    expect(screen.getByText('Sin ventas en la semana anterior')).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('Débito')).toBeInTheDocument()
    expect(screen.getByText('Sin método')).toBeInTheDocument()
    expect(getDashboardSalesReport).toHaveBeenCalledExactlyOnceWith('l1')
  })

  it('muestra el cambio semanal cuando el período anterior tiene ventas', async () => {
    salesApi.getDashboardSalesReport.mockResolvedValueOnce({
      total_sales: 16600,
      daily_sales: 9400,
      avg_ticket: 8300,
      cancelled_orders: 0,
      by_day: [],
      payment_breakdown: [],
      week_comparison: { current_week_sales: 16600, prev_week_sales: 8300, change_pct: 100 },
    })
    montar()

    expect(await screen.findByText(/100\.0% vs semana anterior/)).toBeInTheDocument()
  })

  it('muestra un error y no convierte un fallo del reporte en ceros', async () => {
    salesApi.getDashboardSalesReport.mockRejectedValueOnce(new Error('503'))
    montar()

    expect(await screen.findByText('No se pudieron cargar los indicadores de ventas. Inténtalo nuevamente.')).toBeInTheDocument()
    expect(screen.getByText('No se pudo cargar la tendencia de ventas.')).toBeInTheDocument()
    expect(screen.queryByText('+0.0% vs semana anterior')).not.toBeInTheDocument()
  })

  it('no tiene "Ver detalles" ni la sección "Procesos Recientes"', async () => {
    montar()
    expect(await screen.findByRole('heading', { name: 'Resumen Financiero' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ver detalles/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Procesos Recientes/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/incluidas canceladas/i)).not.toBeInTheDocument()
  })

  it('la guía ya no los menciona', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: /Cómo leer este dashboard/ }))

    expect(screen.getByRole('heading', { name: 'Guía del Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Ventas por día', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByText(/Ver detalles/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pedidos Recientes|Procesos Recientes/)).not.toBeInTheDocument()
  })

  it('sin la bandera no hay tarjeta del fondo ni entrada en la guía', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByRole('heading', { name: 'Resumen Financiero' })
    expect(screen.queryByText(/tarjeta-fondo/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Cómo leer este dashboard/ }))
    expect(screen.queryByText('Fondo de emergencia')).not.toBeInTheDocument()
  })

  it('con la bandera muestra la tarjeta del fondo del local y la guía la explica', async () => {
    banderas.fondoEmergencia = true
    const user = userEvent.setup()
    montar()
    expect(await screen.findByText('tarjeta-fondo l1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Cómo leer este dashboard/ }))
    expect(screen.getByText('Fondo de emergencia', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText(/aportar, registrar un uso o ver el historial completo/)).toBeInTheDocument()
  })
})
