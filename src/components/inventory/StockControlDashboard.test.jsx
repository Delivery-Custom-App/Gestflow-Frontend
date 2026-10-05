/**
 * Control de stock sin lo que repite Estado Inventario: sin tarjetas de
 * resumen, con el filtro por estado en un selector.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import StockControlDashboard from './StockControlDashboard'
import { AuthProvider } from '../../context/AuthContext'
import { getInventoryProductsPage } from '../../lib/inventoryApi'

vi.mock('../../lib/apiClient', () => ({
  getAuthContext: vi.fn(() => Promise.resolve({ token: 'test-token' })),
}))

vi.mock('../../lib/inventoryApi', () => ({
  getInventoryKpisByLocal: vi.fn(() => Promise.resolve({ total_products: 5 })),
  getInventoryProductsPage: vi.fn(() => Promise.resolve({ items: [], total: 0, limit: 10, offset: 0 })),
  getCategoriesForLocal: vi.fn(() => Promise.resolve([])),
  patchInventoryProductUnitCost: vi.fn(),
  patchInventoryStock: vi.fn(),
}))

// El Select de Radix necesita APIs del navegador que jsdom no tiene: aquí basta
// un <select> nativo con la misma interfaz (valor, onValueChange, opciones).
vi.mock('@/components/ui/select', async () => {
  const { Children, isValidElement } = await import('react')
  const SelectTrigger = () => null
  const SelectValue = () => null
  const SelectContent = () => null
  const SelectItem = () => null
  function Select({ value, onValueChange, children }) {
    const partes = Children.toArray(children)
    const trigger = partes.find((c) => isValidElement(c) && c.type === SelectTrigger)
    const content = partes.find((c) => isValidElement(c) && c.type === SelectContent)
    const items = Children.toArray(content?.props.children).filter(isValidElement)
    return (
      <select aria-label={trigger?.props['aria-label']} value={value} onChange={(e) => onValueChange(e.target.value)}>
        {items.map((it) => <option key={it.props.value} value={it.props.value}>{it.props.children}</option>)}
      </select>
    )
  }
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

function renderStock() {
  return render(
    <AuthProvider user={{ email: 'a@b.cl', user_metadata: {} }} userRole="Admin" logout={vi.fn()}>
      <MemoryRouter initialEntries={['/local/loc-1/inventario/stock-control']}>
        <Routes>
          <Route path="/local/:localId/inventario/stock-control" element={<StockControlDashboard />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const ultimoFiltro = () => getInventoryProductsPage.mock.calls.at(-1)[1]

describe('StockControlDashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no repite las tarjetas de resumen de Estado Inventario', async () => {
    renderStock()
    await waitFor(() => expect(getInventoryProductsPage).toHaveBeenCalled())

    expect(screen.queryByRole('region', { name: /KPIs de inventario/i })).not.toBeInTheDocument()
    for (const tarjeta of ['Total productos', 'Stock óptimo', 'Stock bajo', 'Stock crítico', 'Valor total']) {
      expect(screen.queryByText(tarjeta)).not.toBeInTheDocument()
    }
  })

  it('filtra por estado con un selector (antes se hacía tocando las tarjetas)', async () => {
    const user = userEvent.setup()
    renderStock()
    await waitFor(() => expect(getInventoryProductsPage).toHaveBeenCalled())
    expect(ultimoFiltro().status).toBeUndefined()

    const selector = screen.getByLabelText('Filtrar por estado de stock')
    expect([...selector.options].map((o) => o.textContent)).toEqual(['Todos los estados', 'Óptimo', 'Bajo', 'Crítico'])

    await user.selectOptions(selector, 'Bajo')
    await waitFor(() => expect(ultimoFiltro().status).toEqual(['BAJO']))

    await user.selectOptions(selector, 'Todos los estados')
    await waitFor(() => expect(ultimoFiltro().status).toBeUndefined())
  })
})
