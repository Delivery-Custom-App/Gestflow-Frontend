import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ReportesModal from './ReportesModal'
import { fetchEnrichedInventoryForLocal, stockStatus } from '../../lib/v2CatalogApi'

const reportHook = vi.hoisted(() => ({ fetch: vi.fn() }))

vi.mock('../../hooks/useReportesPOS', () => ({
  useReportesPOS: () => ({ data: null, loading: false, error: null, fetch: reportHook.fetch }),
}))

vi.mock('../../lib/v2CatalogApi', () => ({
  fetchEnrichedInventoryForLocal: vi.fn(),
  stockStatus: vi.fn((stock, min, critical) => {
    if (Number(stock) <= 0 || (critical != null && Number(stock) <= Number(critical))) return 'CRITICO'
    return Number(min) > 0 && Number(stock) <= Number(min) ? 'BAJO' : 'OPTIMO'
  }),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }) => <div role="dialog">{children}</div>,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <header>{children}</header>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogFooter: ({ children }) => <footer>{children}</footer>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}))

const ROWS = [
  { product_id: 'ok', product_name: 'Stock normal', stock_current: 20, stock_min: 5, stock_critical: 2, stock_status: 'OPTIMO' },
  { product_id: 'low', product_name: 'Stock bajo', stock_current: 4, stock_min: 5, stock_critical: 2 },
  { product_id: 'critical', product_name: 'Stock crítico', stock_current: 0, stock_min: 5, stock_critical: 2 },
]

function montar() {
  return render(<ReportesModal localId="local-1" onClose={vi.fn()} />)
}

describe('ReportesModal · stock bajo (T-69)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reportHook.fetch.mockResolvedValue(undefined)
    fetchEnrichedInventoryForLocal.mockResolvedValue({ rows: ROWS })
  })

  afterEach(() => vi.restoreAllMocks())

  it('usa el inventario enriquecido del local, ordena críticos primero y comparte stockStatus', async () => {
    const { container } = montar()

    expect(await screen.findByText('Stock crítico')).toBeInTheDocument()
    expect(screen.getByText('Stock bajo')).toBeInTheDocument()
    expect(screen.queryByText('Stock normal')).not.toBeInTheDocument()
    expect(fetchEnrichedInventoryForLocal).toHaveBeenCalledWith('local-1')
    expect(stockStatus).toHaveBeenCalledWith(4, 5, 2)

    const critical = screen.getByText('Stock crítico')
    const low = screen.getByText('Stock bajo')
    expect(critical.compareDocumentPosition(low) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.textContent).toContain('0 uds')
    expect(container.textContent).toContain('mín 5')
  })

  it('muestra un error y permite reintentar si falla la carga', async () => {
    fetchEnrichedInventoryForLocal.mockRejectedValueOnce(new Error('500'))
    montar()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el stock del local')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Stock crítico')).toBeInTheDocument()
    await waitFor(() => expect(fetchEnrichedInventoryForLocal).toHaveBeenCalledTimes(2))
  })

  it('muestra el mensaje acordado si no hay productos bajos ni críticos', async () => {
    fetchEnrichedInventoryForLocal.mockResolvedValueOnce({ rows: [ROWS[0]] })
    montar()

    expect(await screen.findByText('Todo el stock está sobre el mínimo')).toBeInTheDocument()
  })
})
