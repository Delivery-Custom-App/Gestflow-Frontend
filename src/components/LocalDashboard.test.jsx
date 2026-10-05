/**
 * Dashboard del local sin "Ver detalles" (y su panel lateral) ni "Procesos
 * Recientes"; la guía tampoco los menciona.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import LocalDashboard from './LocalDashboard'

vi.mock('../lib/apiClient', () => ({ getAuthContext: vi.fn(() => Promise.resolve({ token: 't' })) }))
vi.mock('../lib/inventoryApi', () => ({ getInventoryKpisByLocal: vi.fn(() => Promise.resolve({ total_products: 3 })) }))
vi.mock('../lib/administrativeApi', () => ({
  getLocalDashboard: vi.fn(() => Promise.resolve({ daily_sales: 1000, monthly_sales: 5000, payment_breakdown: [] })),
  getOrdersByLocal: vi.fn(() => Promise.resolve([
    { id: 'o1', status: 'cancelled', total: 1000, created_at: '2026-10-05T12:00:00Z' },
  ])),
  getIncomeTrend: vi.fn(() => Promise.resolve([])),
}))
// recharts no dibuja en jsdom: basta con que no rompa.
vi.mock('recharts', async () => {
  const { createElement } = await import('react')
  const caja = ({ children }) => createElement('div', null, children)
  const nombres = ['BarChart', 'Bar', 'Cell', 'XAxis', 'YAxis', 'CartesianGrid', 'ResponsiveContainer', 'Tooltip',
    'PieChart', 'Pie', 'LabelList', 'LineChart', 'Line', 'Legend']
  return Object.fromEntries(nombres.map((n) => [n, caja]))
})
vi.mock('./charts/IncomeChart', () => ({ default: () => null }))

function montar() {
  return render(
    <MemoryRouter initialEntries={['/local/l1/dashboard']}>
      <Routes><Route path="/local/:localId/dashboard" element={<LocalDashboard />} /></Routes>
    </MemoryRouter>,
  )
}

describe('LocalDashboard', () => {
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
    expect(screen.getByText('Tendencia de Ingresos', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByText(/Ver detalles/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pedidos Recientes|Procesos Recientes/)).not.toBeInTheDocument()
  })
})
