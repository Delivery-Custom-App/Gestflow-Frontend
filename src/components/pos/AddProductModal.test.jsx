import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddProductModal from './AddProductModal'
import { addOrderItem, createOrder } from '../../lib/salesApi'

vi.mock('../../hooks/useCajaActiva', () => ({ useCajaActiva: () => ({ cajaId: 'caja-1' }) }))
vi.mock('../../lib/salesApi', () => ({ addOrderItem: vi.fn(), createOrder: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('AddProductModal · Idempotency-Key (T-64)', () => {
  it('reintenta la misma creación con la clave original y usa una clave nueva en la siguiente acción', async () => {
    createOrder.mockRejectedValueOnce(new Error('409: reintenta la misma acción')).mockResolvedValue({ id: 'ord-1' })
    addOrderItem.mockResolvedValue({ id: 'item-1' })
    const user = userEvent.setup()
    render(
      <AddProductModal
        mesaId="mesa-1"
        localId="local-1"
        onClose={vi.fn()}
        products={[{ id: 'prod-1', name: 'Agua' }]}
      />,
    )

    const seleccionarProducto = async () => user.selectOptions(screen.getByLabelText('Producto'), 'prod-1')
    const enviar = async () => user.click(screen.getByRole('button', { name: 'Agregar Producto' }))
    await seleccionarProducto()
    await enviar()
    expect(await screen.findByText('409: reintenta la misma acción')).toBeInTheDocument()
    const firstKey = createOrder.mock.calls[0][0].idempotency_key

    await enviar()
    expect(createOrder.mock.calls[1][0].idempotency_key).toBe(firstKey)
    expect(addOrderItem).toHaveBeenNthCalledWith(1, 'ord-1', { product_id: 'prod-1', quantity: 1 }, undefined, `${firstKey}:item:0`)

    await seleccionarProducto()
    await enviar()
    expect(addOrderItem.mock.calls[1][3]).not.toBe(`${firstKey}:item:0`)
  })
})
