/** Lista de productos del pedido: editar cantidad (sin precio) y quitar (T-30). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductList from './ProductList'
import { removeOrderItem, updateOrderItem } from '../../lib/salesApi'

vi.mock('../../lib/salesApi', () => ({
  addOrderItem: vi.fn(),
  updateOrderItem: vi.fn(),
  removeOrderItem: vi.fn(),
}))

const productos = [{ id: 'it-1', product_name: 'Agua', quantity: 2, unit_price: 1000, total_price: 2000 }]

beforeEach(() => { vi.clearAllMocks() })

describe('ProductList', () => {
  it('editar cambia solo la cantidad: no hay campo de precio', async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    updateOrderItem.mockResolvedValue({ id: 'it-1' })
    render(<ProductList products={productos} orderId="ord-1" createdAt="2026-10-14T12:00:00Z" onProductsChanged={onChanged} />)

    await user.click(screen.getByRole('button', { name: 'Editar cantidad de Agua' }))
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1)
    const cantidad = screen.getByRole('spinbutton', { name: 'Cantidad de Agua' })
    await user.clear(cantidad)
    await user.type(cantidad, '5')
    await user.click(screen.getByRole('button', { name: 'Guardar cantidad' }))

    expect(updateOrderItem).toHaveBeenCalledWith('ord-1', 'it-1', { quantity: 5 }, '2026-10-14T12:00:00Z')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('quitar usa DELETE y avisa al padre para recargar el total', async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    removeOrderItem.mockResolvedValue(true)
    render(<ProductList products={productos} orderId="ord-1" createdAt="c" onProductsChanged={onChanged} />)

    await user.click(screen.getByRole('button', { name: 'Quitar Agua del pedido' }))
    expect(removeOrderItem).toHaveBeenCalledWith('ord-1', 'it-1', 'c')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    confirmar.mockRestore()
  })

  it('ya no aparece el «no disponible en Backend V2»; el error real se muestra', async () => {
    const user = userEvent.setup()
    updateOrderItem.mockRejectedValue(new Error('El pedido ya está cerrado'))
    render(<ProductList products={productos} orderId="ord-1" createdAt="c" />)

    await user.click(screen.getByRole('button', { name: 'Editar cantidad de Agua' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cantidad' }))
    expect(await screen.findByText('El pedido ya está cerrado')).toBeInTheDocument()
    expect(screen.queryByText(/no está disponible en Backend V2/)).not.toBeInTheDocument()
  })
})
