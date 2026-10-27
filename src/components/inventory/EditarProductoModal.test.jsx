import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditarProductoModal from './EditarProductoModal'
import { cambiarSiSePrepara, getInventarioDelProducto, patchProduct } from '../../lib/inventoryApi'

vi.mock('../../lib/inventoryApi', () => ({ cambiarSiSePrepara: vi.fn(), getInventarioDelProducto: vi.fn(), patchProduct: vi.fn(() => Promise.resolve({})) }))

const POR_UNIDADES = { id: 'p1', product_id: 'p1', name: 'Bebida lata', stock_deduction_mode: 'DIRECT_STOCK' }
const PREPARADO = { id: 'p2', product_id: 'p2', name: 'Lomo a lo pobre', stock_deduction_mode: 'RECIPE_BASED' }
const sw = () => screen.getByRole('switch', { name: 'Este producto se prepara' })

beforeEach(() => {
  vi.clearAllMocks()
  cambiarSiSePrepara.mockResolvedValue(null)
  getInventarioDelProducto.mockResolvedValue(null)
})

describe('EditarProductoModal', () => {
  it('un producto por unidades viene con el switch apagado y su stock cargado', async () => {
    getInventarioDelProducto.mockResolvedValue({ id: 'inv-1', stock_actual: '12.000', stock_min: '3' })
    render(<EditarProductoModal localId="l1" producto={POR_UNIDADES} />)

    expect(sw()).toHaveAttribute('aria-checked', 'false')
    expect(await screen.findByDisplayValue('12')).toBeInTheDocument()
    expect(screen.getByLabelText('Mínimo')).toHaveValue('3')
    expect(getInventarioDelProducto).toHaveBeenCalledWith('l1', 'p1')
  })

  it('al encenderlo deja de pedir cantidades y lo guarda como que se prepara', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<EditarProductoModal localId="l1" producto={POR_UNIDADES} onSaved={onSaved} />)

    await user.click(sw())
    expect(screen.queryByLabelText('Actual')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(cambiarSiSePrepara).toHaveBeenCalledWith('l1', 'p1', expect.objectContaining({ prepara: true })))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ stock_deduction_mode: 'RECIPE_BASED' }))
  })

  it('un producto que se prepara viene encendido; al apagarlo pide el stock y lo envía', async () => {
    const user = userEvent.setup()
    render(<EditarProductoModal localId="l1" producto={PREPARADO} onSaved={vi.fn()} />)

    expect(sw()).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByLabelText('Actual')).not.toBeInTheDocument()
    await user.click(sw())
    await user.clear(screen.getByLabelText('Actual'))
    await user.type(screen.getByLabelText('Actual'), '8')
    await user.clear(screen.getByLabelText('Mínimo'))
    await user.type(screen.getByLabelText('Mínimo'), '2')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(cambiarSiSePrepara).toHaveBeenCalledWith('l1', 'p2', { prepara: false, stockActual: '8', stockMin: '2' }))
  })

  it('si el backend rechaza el cambio, lo dice y no cierra', async () => {
    cambiarSiSePrepara.mockRejectedValue(new Error('No autorizado'))
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<EditarProductoModal localId="l1" producto={PREPARADO} onSaved={onSaved} />)

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado')
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe('EditarProductoModal · nombre, categoría, precio y costo (#177)', () => {
  const PLATO = { ...PREPARADO, price: 9900, cost: 4500, category_id: 'c1' }
  const CATEGORIAS = [{ id: 'c1', name: 'Fondos' }, { id: 'c2', name: 'Postres' }]

  it('cambia el precio de venta y la categoría con PATCH /products, solo lo que cambió', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<EditarProductoModal localId="l1" producto={PLATO} categorias={CATEGORIAS} onSaved={onSaved} />)

    expect(screen.getByLabelText('Precio de venta (CLP)')).toHaveValue('9900')
    expect(screen.getByLabelText('Costo unitario (CLP)')).toHaveValue('4500')
    await user.clear(screen.getByLabelText('Precio de venta (CLP)'))
    await user.type(screen.getByLabelText('Precio de venta (CLP)'), '10500')
    await user.selectOptions(screen.getByLabelText('Categoría'), 'c2')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(patchProduct).toHaveBeenCalledWith('p2', { price: 10500, category_id: 'c2' }))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ price: 10500, category_id: 'c2' }))
  })

  it('sin cambios en los datos no llama a PATCH /products', async () => {
    const user = userEvent.setup()
    render(<EditarProductoModal localId="l1" producto={PLATO} categorias={CATEGORIAS} onSaved={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(cambiarSiSePrepara).toHaveBeenCalled())
    expect(patchProduct).not.toHaveBeenCalled()
  })

  it('un precio en 0 no se guarda', async () => {
    const user = userEvent.setup()
    render(<EditarProductoModal localId="l1" producto={PLATO} onSaved={vi.fn()} />)
    await user.clear(screen.getByLabelText('Precio de venta (CLP)'))
    await user.type(screen.getByLabelText('Precio de venta (CLP)'), '0')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El precio de venta debe ser mayor que 0.')
    expect(patchProduct).not.toHaveBeenCalled()
  })
})
