import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MesaWorkspace from './MesaWorkspace'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import { createOrder, addOrderItem, updateOrderItem, removeOrderItem, liberarMesa, setMesaLibre } from '../../lib/salesApi'

vi.mock('../../hooks/useMesaDetail', () => ({ useMesaDetail: vi.fn() }))
vi.mock('../../hooks/useMenuPOS', () => ({ useMenuPOS: vi.fn() }))
vi.mock('../../hooks/useOrderManagement', () => ({ useOrderManagement: vi.fn() }))
vi.mock('../../lib/salesApi', () => ({
  createOrder: vi.fn(),
  addOrderItem: vi.fn(),
  setMesaLibre: vi.fn(),
  liberarMesa: vi.fn(),
  updateOrderItem: vi.fn(),
  removeOrderItem: vi.fn(),
}))
vi.mock('../../lib/apiClient', () => ({
  getSplitPaymentSummary: vi.fn().mockResolvedValue({ splits: [], is_fully_paid: false }),
}))
// Como en la app: la comanda encendida, el pago dividido apagado.
vi.mock('../../lib/v2Features', () => ({ isV2FeatureEnabled: (k) => k === 'comandas' }))
vi.mock('./MercadoPagoModal', () => ({ default: ({ open, onSuccess }) => open ? <button type="button" onClick={onSuccess}>Simular pago aprobado</button> : null }))
vi.mock('./MultiPaymentModal', () => ({ default: () => null }))
vi.mock('./TicketModal', () => ({
  default: ({ tipo, orderId, createdAt }) => <p>{`${tipo} de ${orderId} (${createdAt})`}</p>,
}))

const mesa = { id: 'mesa-1', name: 'Mesa 1', zona: 'Salón' }

const menuData = {
  categories: [
    { id: 'cat1', name: 'Bebidas', products: [{ id: 'prod1', name: 'Agua', price: 1000 }] },
  ],
}

function setup({ activeOrders = [] } = {}) {
  const refresh = vi.fn()
  useMesaDetail.mockReturnValue({ detail: { active_orders: activeOrders }, loading: false, error: null, refresh })
  useMenuPOS.mockReturnValue({ data: menuData, loading: false, fetch: vi.fn() })
  useOrderManagement.mockReturnValue({ updateOrderStatus: vi.fn() })
  return { refresh }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MesaWorkspace', () => {
  it('solo el administrador o el dueño ve Liberar mesa', () => {
    setup({ activeOrders: [{ id: 'order-1', items: [] }] })
    const props = { mesa: { ...mesa, state: 'ocupada' }, localId: 'local1', cajaId: 'caja1', onBack: vi.fn(), onTableUpdated: vi.fn() }

    const { rerender } = render(<MesaWorkspace {...props} puedeLiberarMesa />)
    expect(screen.getByRole('button', { name: 'Liberar mesa' })).toBeInTheDocument()

    rerender(<MesaWorkspace {...props} puedeLiberarMesa={false} />)
    expect(screen.queryByRole('button', { name: 'Liberar mesa' })).not.toBeInTheDocument()
  })

  it('pide motivo, muestra el total y vuelve al plano con el total sin cobrar', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const onTableUpdated = vi.fn()
    setup({ activeOrders: [{ id: 'order-1', items: [{ id: 'i1', quantity: 1, total_price: 5000 }] }] })
    liberarMesa.mockResolvedValue({ status: 'available', total_sin_cobrar: '5000.00' })
    render(<MesaWorkspace mesa={{ ...mesa, state: 'ocupada' }} localId="local1" cajaId="caja1" puedeLiberarMesa onBack={onBack} onTableUpdated={onTableUpdated} />)

    await user.click(screen.getByRole('button', { name: 'Liberar mesa' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Total actual que quedar/)).toHaveTextContent('$5.000')
    await user.type(within(dialog).getByLabelText('Motivo'), 'Clientes se retiraron')
    await user.click(within(dialog).getByRole('button', { name: 'Liberar mesa' }))

    expect(liberarMesa).toHaveBeenCalledWith('mesa-1', 'Clientes se retiraron')
    expect(screen.getByRole('dialog')).toHaveTextContent(/Total sin cobrar\s*\$5\.000/)
    await user.click(screen.getByRole('button', { name: 'Volver a mesas' }))
    expect(onTableUpdated).toHaveBeenCalledOnce()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('un 409 al intentar dejar la mesa disponible ofrece Liberar mesa al administrador', async () => {
    const user = userEvent.setup()
    setup({ activeOrders: [{ id: 'order-1', items: [] }] })
    setMesaLibre.mockRejectedValue(Object.assign(new Error('409: Hay un cobro con tarjeta en curso'), { status: 409 }))
    render(<MesaWorkspace mesa={{ ...mesa, state: 'ocupada' }} localId="local1" cajaId="caja1" puedeLiberarMesa onBack={vi.fn()} onTableUpdated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(screen.getByRole('button', { name: 'Simular pago aprobado' }))

    expect(await screen.findByText('409: Hay un cobro con tarjeta en curso')).toBeInTheDocument()
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Liberar mesa' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Total actual que quedaría sin cobrar')
  })

  it('Cobrar deshabilitado cuando la mesa no tiene orden activa', () => {
    setup({ activeOrders: [] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)
    expect(screen.getByRole('button', { name: /cobrar/i })).toBeDisabled()
  })

  it('Cobrar habilitado cuando ya hay una orden activa', () => {
    setup({ activeOrders: [{ id: 'order-1', created_at: '2024-01-01T00:00:00Z', items: [] }] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)
    expect(screen.getByRole('button', { name: /cobrar/i })).not.toBeDisabled()
  })

  it('la cantidad decimal del backend se muestra como cantidad ("1.000" -> 1)', () => {
    setup({ activeOrders: [{
      id: 'order-1',
      created_at: '2024-01-01T00:00:00Z',
      items: [
        { id: 'i1', item_name: 'Café Americano', quantity: '1.000', unit_price: 2500, total_price: 2500 },
        { id: 'i2', item_name: 'Queso', quantity: '0.500', unit_price: 1000, total_price: 500 },
      ],
    }] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)
    const fila = (nombre) => screen.getAllByText(nombre)[0].closest('tr')
    expect(within(fila('Café Americano')).getByText('1')).toBeInTheDocument()
    expect(within(fila('Queso')).getByText('0,5')).toBeInTheDocument()
    expect(screen.queryByText('1.000')).not.toBeInTheDocument()
  })

  it('agregar producto sin orden previa crea la orden (createOrder), no addOrderItem', async () => {
    const user = userEvent.setup()
    const { refresh } = setup({ activeOrders: [] })
    createOrder.mockResolvedValue({ id: 'order-nueva' })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.clear(screen.getByLabelText('Comensales'))
    await user.type(screen.getByLabelText('Comensales'), '4')
    await user.click(screen.getByText('+'))
    await user.click(screen.getByRole('button', { name: /agregar al pedido/i }))

    await waitFor(() => expect(createOrder).toHaveBeenCalledWith({
      local_id: 'local1',
      mesa_id: 'mesa-1',
      caja_id: 'caja1',
      source: 'dine_in',
      guests: 4,
      items: [{ product_id: 'prod1', quantity: 1, unit_price: 1000 }],
      idempotency_key: expect.any(String),
    }))
    expect(addOrderItem).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('reutiliza la clave si falla la creación y el usuario reintenta la misma acción', async () => {
    const user = userEvent.setup()
    setup({ activeOrders: [] })
    createOrder.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce({ id: 'order-nueva' })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getByText('+'))
    await user.click(screen.getByRole('button', { name: /agregar al pedido/i }))
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    const firstKey = createOrder.mock.calls[0][0].idempotency_key

    await user.click(screen.getByRole('button', { name: /agregar al pedido/i }))

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2))
    expect(createOrder.mock.calls[1][0].idempotency_key).toBe(firstKey)
  })

  it('agregar producto con orden ya activa llama addOrderItem, no createOrder', async () => {
    const user = userEvent.setup()
    const { refresh } = setup({ activeOrders: [{ id: 'order-existing', created_at: '2024-01-01T00:00:00Z', items: [] }] })
    addOrderItem.mockResolvedValue({})
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getByText('+'))
    await user.click(screen.getByRole('button', { name: /agregar al pedido/i }))

    await waitFor(() => expect(addOrderItem).toHaveBeenCalledWith(
      'order-existing',
      { product_id: 'prod1', quantity: 1, unit_price: 1000 },
      '2024-01-01T00:00:00Z',
      expect.stringMatching(/:item:0$/),
    ))
    expect(createOrder).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  // La pantalla de Cocina está apagada: la comanda se ve e imprime desde la mesa.
  it('con una orden activa abre la comanda de esa orden', async () => {
    const user = userEvent.setup()
    setup({ activeOrders: [{ id: 'order-1', created_at: '2024-01-01T00:00:00Z', items: [] }] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Comanda' }))

    expect(screen.getByText('comanda de order-1 (2024-01-01T00:00:00Z)')).toBeInTheDocument()
  })

  it('sin orden activa no hay comanda que abrir', () => {
    setup({ activeOrders: [] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    expect(screen.getByRole('button', { name: 'Comanda' })).toBeDisabled()
  })
})

describe('MesaWorkspace · editar y quitar ítems (T-30)', () => {
  const orden = { id: 'order-1', created_at: '2026-10-14T12:00:00Z', items: [{ id: 'it-1', product_name: 'Agua', quantity: 2, total_price: 2000 }] }

  it('«+» manda PATCH solo con la cantidad nueva y recarga la mesa', async () => {
    const user = userEvent.setup()
    const { refresh } = setup({ activeOrders: [orden] })
    updateOrderItem.mockResolvedValue({})
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getAllByRole('button', { name: 'Sumar uno de Agua' })[0])
    expect(updateOrderItem).toHaveBeenCalledWith('order-1', 'it-1', { quantity: 3 }, '2026-10-14T12:00:00Z')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('«Quitar» confirma, usa DELETE y recarga', async () => {
    const user = userEvent.setup()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { refresh } = setup({ activeOrders: [orden] })
    removeOrderItem.mockResolvedValue(true)
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getAllByRole('button', { name: 'Quitar Agua del pedido' })[0])
    expect(removeOrderItem).toHaveBeenCalledWith('order-1', 'it-1', '2026-10-14T12:00:00Z')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    confirmar.mockRestore()
  })

  it('un pedido cerrado muestra «El pedido ya está cerrado»', async () => {
    const user = userEvent.setup()
    setup({ activeOrders: [orden] })
    updateOrderItem.mockRejectedValue(new Error('El pedido ya está cerrado'))
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getAllByRole('button', { name: 'Sumar uno de Agua' })[0])
    expect((await screen.findAllByText('El pedido ya está cerrado')).length).toBeGreaterThan(0)
  })
})

describe('MesaWorkspace · roles de caja (A-03)', () => {
  const orden = { id: 'order-1', created_at: '2026-10-14T12:00:00Z', items: [] }

  it('el administrador de restaurante no ve «Cobrar», pero sí cancelar', () => {
    setup({ activeOrders: [orden] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" puedeCobrar={false} onBack={() => {}} onTableUpdated={() => {}} />)
    expect(screen.queryByRole('button', { name: /^cobrar$/i })).not.toBeInTheDocument()
    expect(screen.getAllByTitle('Cancelar orden').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/el administrador no cobra/).length).toBeGreaterThan(0)
  })

  it('el dueño y el vendedor ven «Cobrar»', () => {
    setup({ activeOrders: [orden] })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)
    expect(screen.getAllByRole('button', { name: /cobrar/i }).length).toBeGreaterThan(0)
  })
})
