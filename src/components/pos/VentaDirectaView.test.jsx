/**
 * Venta directa (local Al Paso): quien administra puede vincular Mercado Pago; el vendedor no.
 * El stock no bloquea la venta: se avisa que faltará (#147).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import VentaDirectaView from './VentaDirectaView'
import { cancelOrder, createOrder, fetchProductsCatalog, listPedidosSinCobrarDelTurno } from '../../lib/salesApi'

const state = { isWorker: false, cajaId: null }

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isWorker: state.isWorker }) }))
vi.mock('../../hooks/useCajaActiva', () => ({ useCajaActiva: () => ({ cajaId: state.cajaId }) }))
vi.mock('../../lib/salesApi', () => ({
  cancelOrder: vi.fn(() => Promise.resolve({})), createOrder: vi.fn(), fetchProductsCatalog: vi.fn(() => Promise.resolve([])),
  listPedidosSinCobrarDelTurno: vi.fn(() => Promise.resolve([])),
}))
vi.mock('./MercadoPagoModal', () => ({
  default: ({ open, total, onClose }) => (open ? <div role="dialog" aria-label="Cobro">Cobro de {total}<button type="button" onClick={onClose}>Cerrar cobro</button></div> : null),
}))
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
  state.cajaId = null
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

describe('VentaDirectaView · una venta que falla a medias (#159)', () => {
  const catalogo = () => fetchProductsCatalog.mockResolvedValue([{ category: 'Bebidas', products: [
    { id: 'p1', name: 'Café', price: 1800, stock: 5, stock_deduction_mode: 'DIRECT_STOCK' },
    { id: 'p2', name: 'Jugo', price: 1500, stock: 5, stock_deduction_mode: 'DIRECT_STOCK' },
  ] }])

  it('si cambia el carrito, el reintento va con otra clave', async () => {
    const user = userEvent.setup()
    catalogo()
    createOrder.mockRejectedValueOnce(Object.assign(new Error('400: El producto no está activo en este local'), { status: 400 }))
    createOrder.mockResolvedValueOnce({ id: 'o2', total: 1800 })
    montar()
    await user.click(await screen.findByRole('button', { name: 'Agregar Café' }))
    await user.click(screen.getByRole('button', { name: 'Agregar Jugo' }))
    await user.click(screen.getByRole('button', { name: /Cobrar/ }))
    expect(await screen.findByText(/El producto no está activo/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar Jugo' }))
    await user.click(screen.getByRole('button', { name: /Cobrar/ }))
    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2))
    const [primera, segunda] = createOrder.mock.calls.map(([body]) => body.idempotency_key)
    expect(segunda).not.toBe(primera)
  })

  it('el pedido a medias cancelado se explica y el 409 de la clave se traduce', async () => {
    const user = userEvent.setup()
    catalogo()
    createOrder.mockRejectedValueOnce(Object.assign(new Error('400: El producto no está activo en este local'), { status: 400, pedidoCancelado: true }))
    createOrder.mockRejectedValueOnce(Object.assign(new Error('409: Esa Idempotency-Key ya se usó con otra operación u otros datos'), { status: 409 }))
    montar()
    await user.click(await screen.findByRole('button', { name: 'Agregar Café' }))
    await user.click(screen.getByRole('button', { name: /Cobrar/ }))
    expect(await screen.findByText(/La venta no quedó guardada: revisa el carrito y vuelve a cobrar/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Cobrar/ }))
    expect(await screen.findByText('Esta venta ya se había enviado con otros productos. Vuelve a intentarlo: se enviará como una nueva.')).toBeInTheDocument()
  })

  it('muestra los pedidos sin cobrar del turno y deja cobrarlos o cancelarlos', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    state.cajaId = 'turno-1'
    listPedidosSinCobrarDelTurno.mockResolvedValueOnce([{ id: '6466b0fb-aaaa', total: 1800, created_at: '2026-10-24T15:00:00Z' }])
    montar()
    const seccion = (await screen.findByRole('heading', { name: 'Tienes 1 pedido sin cobrar' })).closest('section')
    expect(within(seccion).getByText(/Pedido #6466b0fb/)).toHaveTextContent('$1.800')
    expect(listPedidosSinCobrarDelTurno).toHaveBeenCalledWith('turno-1')

    await user.click(within(seccion).getByRole('button', { name: 'Cobrar el pedido #6466b0fb' }))
    expect(screen.getByRole('dialog', { name: 'Cobro' })).toHaveTextContent('Cobro de 1800')
    // Cerrar el cobro de un pedido retomado no lo cancela.
    await user.click(screen.getByRole('button', { name: 'Cerrar cobro' }))
    expect(cancelOrder).not.toHaveBeenCalled()

    await user.click(within(seccion).getByRole('button', { name: 'Cancelar el pedido #6466b0fb' }))
    await waitFor(() => expect(cancelOrder).toHaveBeenCalledWith('6466b0fb-aaaa', '2026-10-24T15:00:00Z'))
    expect(listPedidosSinCobrarDelTurno).toHaveBeenCalledTimes(2)
  })
})
