/**
 * Venta directa (local Al Paso): quien administra puede vincular Mercado Pago; el vendedor no.
 * El stock no bloquea la venta: se avisa que faltará (#147).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import VentaDirectaView from './VentaDirectaView'
import { createOrder, fetchProductsCatalog } from '../../lib/salesApi'

const state = { isWorker: false }

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isWorker: state.isWorker }) }))
vi.mock('../../hooks/useCajaActiva', () => ({ useCajaActiva: () => ({ cajaId: null }) }))
vi.mock('../../lib/salesApi', () => ({
  cancelOrder: vi.fn(), createOrder: vi.fn(), fetchProductsCatalog: vi.fn(() => Promise.resolve([])),
}))
vi.mock('./MercadoPagoModal', () => ({ default: () => null }))
vi.mock('./TicketModal', () => ({ default: () => null }))
vi.mock('./MPConfigDrawer', () => ({
  default: ({ open, localId }) => (open ? <div role="dialog" aria-label="Configurar POS">drawer del local {localId}</div> : null),
}))

function montar() {
  return render(
    <MemoryRouter initialEntries={['/local/l7/pos/venta-directa']}>
      <Routes><Route path="/local/:localId/pos/venta-directa" element={<VentaDirectaView />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.isWorker = false
  vi.clearAllMocks()
})

describe('VentaDirectaView · configurar POS', () => {
  it('quien administra el local ve «Configurar POS» y abre la vinculación de Mercado Pago de ese local', async () => {
    const user = userEvent.setup()
    montar()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Configurar POS/ }))
    expect(screen.getByRole('dialog', { name: 'Configurar POS' })).toHaveTextContent('drawer del local l7')
  })

  it('el vendedor no ve «Configurar POS»', async () => {
    state.isWorker = true
    montar()
    await screen.findByText('Venta directa')
    expect(screen.queryByRole('button', { name: /Configurar POS/ })).not.toBeInTheDocument()
  })
})

describe('VentaDirectaView · sobreventa', () => {
  const catalogo = (productos) => fetchProductsCatalog.mockResolvedValue([{ category: 'Bebidas', products: productos }])

  it('permite agregar más que el stock del sistema y avisa cuánto faltará', async () => {
    const user = userEvent.setup()
    catalogo([{ id: 'p1', name: 'Café', price: 1500, stock: 1, stock_deduction_mode: 'DIRECT_STOCK' }])
    montar()
    const agregar = await screen.findByRole('button', { name: 'Agregar Café' })
    await user.click(agregar)
    expect(screen.queryByText(/faltarán/)).not.toBeInTheDocument()
    await user.click(agregar)
    expect(agregar).toBeEnabled()
    expect(screen.getByText(/El sistema tiene 1: faltarán 1/)).toBeInTheDocument()
  })

  it('crea la orden con la cantidad vendida aunque supere el stock', async () => {
    const user = userEvent.setup()
    catalogo([{ id: 'p1', name: 'Café', price: 1500, stock: 0, stock_deduction_mode: 'DIRECT_STOCK' }])
    createOrder.mockResolvedValue({ id: 'o1', total: 3000 })
    montar()
    const agregar = await screen.findByRole('button', { name: 'Agregar Café' })
    await user.click(agregar)
    await user.click(agregar)
    await user.click(screen.getByRole('button', { name: /Cobrar/ }))
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ product_id: 'p1', quantity: 2, unit_price: 1500 }],
    }))
  })

  it('un producto que se prepara no muestra stock ni aviso', async () => {
    const user = userEvent.setup()
    catalogo([{ id: 'p2', name: 'Completo', price: 3000, stock: 0, stock_deduction_mode: 'RECIPE_BASED' }])
    montar()
    await user.click(await screen.findByRole('button', { name: 'Agregar Completo' }))
    expect(screen.queryByText(/Stock:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/faltarán/)).not.toBeInTheDocument()
  })
})
