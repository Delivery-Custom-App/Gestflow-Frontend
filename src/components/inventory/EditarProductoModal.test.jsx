import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditarProductoModal from './EditarProductoModal'
import { cambiarSiSePrepara, getInventarioDelProducto } from '../../lib/inventoryApi'

vi.mock('../../lib/inventoryApi', () => ({ cambiarSiSePrepara: vi.fn(), getInventarioDelProducto: vi.fn() }))

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
