import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MesaWorkspace from './MesaWorkspace'
import { useMesaDetail } from '../../hooks/useMesaDetail'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { useOrderManagement } from '../../hooks/useOrderManagement'
import { createOrder, addOrderItem } from '../../lib/salesApi'

vi.mock('../../hooks/useMesaDetail', () => ({ useMesaDetail: vi.fn() }))
vi.mock('../../hooks/useMenuPOS', () => ({ useMenuPOS: vi.fn() }))
vi.mock('../../hooks/useOrderManagement', () => ({ useOrderManagement: vi.fn() }))
vi.mock('../../lib/salesApi', () => ({
  createOrder: vi.fn(),
  addOrderItem: vi.fn(),
  setMesaLibre: vi.fn(),
}))
vi.mock('../../lib/apiClient', () => ({
  getSplitPaymentSummary: vi.fn().mockResolvedValue({ splits: [], is_fully_paid: false }),
}))
vi.mock('../../lib/v2Features', () => ({ isV2FeatureEnabled: () => false }))
vi.mock('./MercadoPagoModal', () => ({ default: () => null }))
vi.mock('./MultiPaymentModal', () => ({ default: () => null }))

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

  it('agregar producto sin orden previa crea la orden (createOrder), no addOrderItem', async () => {
    const user = userEvent.setup()
    const { refresh } = setup({ activeOrders: [] })
    createOrder.mockResolvedValue({ id: 'order-nueva' })
    render(<MesaWorkspace mesa={mesa} localId="local1" cajaId="caja1" onBack={() => {}} onTableUpdated={() => {}} />)

    await user.click(screen.getByText('+'))
    await user.click(screen.getByRole('button', { name: /agregar al pedido/i }))

    await waitFor(() => expect(createOrder).toHaveBeenCalledWith({
      local_id: 'local1',
      mesa_id: 'mesa-1',
      caja_id: 'caja1',
      source: 'dine_in',
      items: [{ product_id: 'prod1', quantity: 1, unit_price: 1000 }],
    }))
    expect(addOrderItem).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
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
    ))
    expect(createOrder).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })
})
