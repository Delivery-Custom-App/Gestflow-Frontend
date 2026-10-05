import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import MenuBuilderPage from './MenuBuilderPage'
import { cambiarSiSePrepara } from '../../lib/inventoryApi'

vi.mock('./InventoryShell', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('./ImportarCatalogoDrawer', () => ({ default: () => null }))
vi.mock('../../hooks/useSelectedLocal', () => ({ useSelectedLocal: () => ({ name: 'Sucursal Centro' }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../../lib/apiClient', () => ({ apiRequest: vi.fn(() => Promise.resolve([])) }))
vi.mock('../../lib/inventoryApi', () => ({
  getCategoriesForLocal: vi.fn(() => Promise.resolve([{ id: 'c1', name: 'Fondos' }])),
  patchCategory: vi.fn(),
  patchProduct: vi.fn(),
  postCategory: vi.fn(),
  postInventoryNewProduct: vi.fn(),
  getInventarioDelProducto: vi.fn(() => Promise.resolve(null)),
  cambiarSiSePrepara: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('../../lib/salesApi', () => ({
  fetchLocalMenuCatalog: vi.fn(() => Promise.resolve({
    categories: [{
      id: 'c1', name: 'Fondos', products: [
        { id: 'p1', product_id: 'p1', name: 'Bebida lata', price: 1500, is_active: true, stock_deduction_mode: 'DIRECT_STOCK' },
        { id: 'p2', product_id: 'p2', name: 'Lomo a lo pobre', price: 9900, is_active: true, stock_deduction_mode: 'RECIPE_BASED' },
      ],
    }],
  })),
}))

function montar() {
  return render(
    <MemoryRouter initialEntries={['/local/l1/inventario/stock']}>
      <Routes><Route path="/local/:localId/inventario/stock" element={<MenuBuilderPage />} /></Routes>
    </MemoryRouter>,
  )
}
const tarjeta = (nombre) => screen.getByText(nombre).closest('article')

beforeEach(() => vi.clearAllMocks())

describe('MenuBuilderPage · productos que se preparan', () => {
  it('en la lista se ve cuáles se preparan', async () => {
    montar()

    expect(await screen.findByText('Lomo a lo pobre')).toBeInTheDocument()
    expect(within(tarjeta('Lomo a lo pobre')).getByText('Se prepara')).toBeInTheDocument()
    expect(within(tarjeta('Bebida lata')).queryByText('Se prepara')).not.toBeInTheDocument()
  })

  it('"Editar" abre el producto con su switch y, al guardar, la lista se actualiza', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(await screen.findByRole('button', { name: 'Editar Bebida lata' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar producto' })
    const sw = within(dialogo).getByRole('switch', { name: 'Este producto se prepara' })
    expect(sw).toHaveAttribute('aria-checked', 'false')

    await user.click(sw)
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(cambiarSiSePrepara).toHaveBeenCalledWith('l1', 'p1', expect.objectContaining({ prepara: true })))
    expect(await within(tarjeta('Bebida lata')).findByText('Se prepara')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
