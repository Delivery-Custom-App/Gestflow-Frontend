/** Inventario · Platos preparados (#174): lo del Menú para los productos que se preparan. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlatosPreparados from './PlatosPreparados'
import { fetchLocalMenuCatalog } from '../../../lib/salesApi'
import { cambiarEnVentaEnLocal, removeFromLocalMenu } from '../../../lib/inventoryApi'

vi.mock('../../../lib/salesApi', () => ({ fetchLocalMenuCatalog: vi.fn() }))
vi.mock('../../../lib/inventoryApi', async (importOriginal) => ({
  ...(await importOriginal()),
  cambiarEnVentaEnLocal: vi.fn(() => Promise.resolve({})),
  removeFromLocalMenu: vi.fn(() => Promise.resolve(null)),
  getInventarioDelProducto: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('../CategoryFilterSelect', () => ({ default: () => null }))
vi.mock('../NuevoProductoModal', () => ({ default: ({ open, platoPreparado }) => (open ? <p>{platoPreparado ? 'nuevo-plato' : 'nuevo-producto'}</p> : null) }))

const MENU = {
  categories: [{
    id: 'c1', name: 'Fondos', products: [
      { id: 'p1', product_id: 'p1', local_product_id: 'lp1', name: 'Bebida lata', price: 1500, cost: 800, stock_deduction_mode: 'DIRECT_STOCK', local_product_is_active: true },
      { id: 'p2', product_id: 'p2', local_product_id: 'lp2', name: 'Lomo a lo pobre', price: 9900, cost: 4500, stock_deduction_mode: 'RECIPE_BASED', local_product_is_active: true },
      { id: 'p3', product_id: 'p3', local_product_id: 'lp3', name: 'Cazuela', price: 7000, cost: null, stock_deduction_mode: 'RECIPE_BASED', local_product_is_active: false },
    ],
  }],
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchLocalMenuCatalog.mockResolvedValue(MENU)
})

const tarjeta = (nombre) => screen.getByText(nombre).closest('li')

describe('PlatosPreparados', () => {
  it('muestra solo los que se preparan, con precio, costo y margen', async () => {
    render(<PlatosPreparados localId="l1" />)
    expect(await screen.findByText('Lomo a lo pobre')).toBeInTheDocument()
    expect(screen.queryByText('Bebida lata')).not.toBeInTheDocument()
    expect(fetchLocalMenuCatalog).toHaveBeenCalledWith('l1', { includeInactive: true })
    const lomo = tarjeta('Lomo a lo pobre')
    expect(lomo).toHaveTextContent('9.900')
    expect(lomo).toHaveTextContent('4.500')
    expect(lomo).toHaveTextContent('5.400')
    // Sin costo (empleado) el margen no se inventa.
    expect(within(tarjeta('Cazuela')).getAllByText('—')).toHaveLength(2)
  })

  it('«En venta» cambia solo este local', async () => {
    const user = userEvent.setup()
    render(<PlatosPreparados localId="l1" />)
    const sw = await screen.findByRole('switch', { name: 'En venta Cazuela' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(within(tarjeta('Cazuela')).getByText('Oculto')).toBeInTheDocument()
    await user.click(sw)
    expect(cambiarEnVentaEnLocal).toHaveBeenCalledWith('lp3', true)
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('quita del menú con confirmación', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<PlatosPreparados localId="l1" />)
    await user.click(await screen.findByRole('button', { name: 'Quitar Lomo a lo pobre del menú' }))
    expect(removeFromLocalMenu).toHaveBeenCalledWith('lp2')
    await waitFor(() => expect(screen.queryByText('Lomo a lo pobre')).not.toBeInTheDocument())
  })

  it('«Editar» abre el plato con nombre, precio y «se prepara»; «Nuevo plato preparado» abre encendido', async () => {
    const user = userEvent.setup()
    render(<PlatosPreparados localId="l1" categorias={[{ id: 'c1', name: 'Fondos' }]} />)
    await user.click(await screen.findByRole('button', { name: 'Editar Lomo a lo pobre' }))
    const dialogo = screen.getByRole('dialog', { name: 'Editar producto' })
    expect(within(dialogo).getByLabelText('Precio de venta (CLP)')).toHaveValue('9900')
    expect(within(dialogo).getByRole('switch', { name: 'Este producto se prepara' })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: /Nuevo plato preparado/ }))
    expect(screen.getByText('nuevo-plato')).toBeInTheDocument()
  })
})
