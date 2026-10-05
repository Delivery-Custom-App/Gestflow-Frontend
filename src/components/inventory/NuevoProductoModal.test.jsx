import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NuevoProductoModal from './NuevoProductoModal'
import { postInventoryNewProduct } from '../../lib/inventoryApi'

vi.mock('../../lib/apiClient', () => ({ apiRequest: vi.fn(() => Promise.resolve([{ id: 'c1', name: 'Fondos' }])) }))
vi.mock('../../lib/inventoryApi', () => ({
  postCategory: vi.fn(({ name }) => Promise.resolve({ id: `c-${name}`, name })),
  postInventoryNewProduct: vi.fn(() => Promise.resolve(null)),
}))
// La categoría se confirma con Enter en el componente real; aquí basta con escribirla.
vi.mock('./CategoryTypeaheadField', () => ({
  default: ({ id, onConfirm }) => <input id={id} aria-label="Categoría" onChange={(e) => onConfirm(e.target.value)} />,
}))

async function completarLoBasico(user) {
  await user.type(screen.getByLabelText(/Nombre/), 'Lomo a lo pobre')
  await user.type(await screen.findByLabelText('Categoría'), 'Fondos')
  await user.type(screen.getByLabelText(/Costo unitario/), '4500')
}

beforeEach(() => vi.clearAllMocks())

describe('NuevoProductoModal · "Este producto se prepara"', () => {
  it('trae el switch apagado, con la línea que explica qué cambia, y pide el stock', () => {
    render(<NuevoProductoModal open localId="l1" />)

    const sw = screen.getByRole('switch', { name: 'Este producto se prepara' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(sw).toHaveAccessibleDescription(/Se cuenta por unidades/)
    expect(screen.getByLabelText('Actual')).toBeInTheDocument()
    expect(screen.getByLabelText('Mínimo')).toBeInTheDocument()
  })

  it('encendido: no pide cantidades y lo crea como RECIPE_BASED, sin stock', async () => {
    const user = userEvent.setup()
    render(<NuevoProductoModal open localId="l1" onSuccess={vi.fn()} onClose={vi.fn()} />)

    await user.click(screen.getByRole('switch', { name: 'Este producto se prepara' }))
    expect(screen.getByRole('switch', { name: 'Este producto se prepara' })).toHaveAccessibleDescription(/comanda de cocina/)
    expect(screen.queryByLabelText('Actual')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Mínimo')).not.toBeInTheDocument()

    await completarLoBasico(user)
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(postInventoryNewProduct).toHaveBeenCalled())
    const [, cuerpo] = postInventoryNewProduct.mock.calls[0]
    expect(cuerpo.stock_deduction_mode).toBe('RECIPE_BASED')
    expect(cuerpo).not.toHaveProperty('currentStock')
    expect(cuerpo).not.toHaveProperty('minStock')
  })

  it('apagado: lo crea como DIRECT_STOCK con el stock actual y el mínimo', async () => {
    const user = userEvent.setup()
    render(<NuevoProductoModal open localId="l1" onSuccess={vi.fn()} onClose={vi.fn()} />)

    await completarLoBasico(user)
    await user.clear(screen.getByLabelText('Actual'))
    await user.type(screen.getByLabelText('Actual'), '20')
    await user.clear(screen.getByLabelText('Mínimo'))
    await user.type(screen.getByLabelText('Mínimo'), '5')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    // Sin máximo (0) va como null: un máximo 0 con mínimo 5 lo rechaza la base.
    await waitFor(() => expect(postInventoryNewProduct).toHaveBeenCalledWith('l1', expect.objectContaining({
      stock_deduction_mode: 'DIRECT_STOCK', currentStock: 20, minStock: 5, maxStock: null,
    })))
  })

  it('un máximo menor que el mínimo se explica antes de enviar', async () => {
    const user = userEvent.setup()
    render(<NuevoProductoModal open localId="l1" />)

    await completarLoBasico(user)
    await user.clear(screen.getByLabelText('Mínimo'))
    await user.type(screen.getByLabelText('Mínimo'), '5')
    await user.clear(screen.getByLabelText('Máximo'))
    await user.type(screen.getByLabelText('Máximo'), '3')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('no puede ser menor que el mínimo')
    expect(postInventoryNewProduct).not.toHaveBeenCalled()
  })
})
