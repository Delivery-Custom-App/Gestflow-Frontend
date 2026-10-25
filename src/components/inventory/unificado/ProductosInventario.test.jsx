/** Inventario · Productos (#176): filtros con cantidad, «En venta» por local, acciones y categorías. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductosInventario from './ProductosInventario'
import CategoriasDialog from '../CategoriasDialog'
import { cambiarEnVentaEnLocal, deleteCategory, sumarUnidades } from '../../../lib/inventoryApi'
import { guardarOrden } from '../../../lib/categoriasOrden'

vi.mock('../../../lib/inventoryApi', async (importOriginal) => ({
  ...(await importOriginal()),
  cambiarEnVentaEnLocal: vi.fn(() => Promise.resolve({})),
  sumarUnidades: vi.fn(() => Promise.resolve({})),
  deleteCategory: vi.fn(() => Promise.resolve()),
  patchCategory: vi.fn(() => Promise.resolve({})),
  postCategory: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../../lib/categoriasOrden', async (importOriginal) => ({
  ...(await importOriginal()),
  guardarOrden: vi.fn(() => Promise.resolve()),
  cambiarColorCategoria: vi.fn(() => Promise.resolve()),
}))
vi.mock('../ImportarCatalogoDrawer', () => ({ default: () => <div role="dialog" aria-label="Importar del catálogo" /> }))
vi.mock('../ImportarPlanillaDialog', () => ({ default: () => <div role="dialog" aria-label="Importar desde planilla" /> }))
vi.mock('../CategoryFilterSelect', () => ({
  default: ({ value, onChange, options }) => (
    <select aria-label="Filtrar por categoría" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Todas</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  ),
}))

const fila = (n, extra = {}) => ({
  inventory_id: `inv-${n}`, product_id: `p${n}`, product_name: `Producto ${n}`, category_id: 'c1', category_name: 'Bebidas',
  stock_current: 20, stock_min: 5, unit_cost_clp: 800, price: 1500, total_value: 16000, stock_status: 'OPTIMO',
  local_product_id: `lp-${n}`, en_venta: true, ...extra,
})
const FILAS = [
  fila(1, { product_name: 'Bebida lata' }),
  fila(2, { product_name: 'Jugo', stock_current: 4, stock_status: 'BAJO' }),
  fila(3, { product_name: 'Agua', stock_current: 0, stock_status: 'CRITICO', category_id: 'c2', category_name: 'Aguas' }),
]
const CATEGORIAS = [{ id: 'c1', name: 'Bebidas', sort_order: 10 }, { id: 'c2', name: 'Aguas', sort_order: 20 }]

function montar(props = {}) {
  const recargar = vi.fn(() => Promise.resolve())
  const setFilas = vi.fn()
  render(<ProductosInventario localId="l1" filas={FILAS} categorias={CATEGORIAS} loading={false} error="" recargar={recargar} setFilas={setFilas} {...props} />)
  return { recargar, setFilas }
}
const nombres = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)

beforeEach(() => vi.clearAllMocks())

describe('ProductosInventario', () => {
  it('los filtros Todos · Óptimo · Bajo · Crítico dicen cuántos hay y filtran', async () => {
    const user = userEvent.setup()
    montar()
    const grupo = screen.getByRole('group', { name: 'Filtrar por estado de stock' })
    expect(within(grupo).getByRole('button', { name: /Todos/ })).toHaveTextContent('3')
    expect(within(grupo).getByRole('button', { name: /Bajo/ })).toHaveTextContent('1')
    await user.click(within(grupo).getByRole('button', { name: /Crítico/ }))
    expect(nombres()).toEqual(['AguaAguas'])
  })

  it('busca por nombre y filtra por categoría', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByRole('searchbox', { name: 'Buscar productos por nombre' }), 'jug')
    expect(nombres()).toEqual(['JugoBebidas'])
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar productos por nombre' }))
    await user.selectOptions(screen.getByLabelText('Filtrar por categoría'), 'c2')
    expect(nombres()).toEqual(['AguaAguas'])
  })

  it('pagina de a 10', async () => {
    const user = userEvent.setup()
    montar({ filas: Array.from({ length: 12 }, (_, i) => fila(i + 1)) })
    expect(screen.getAllByRole('row')).toHaveLength(11)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('«En venta» cambia solo este local (PATCH /local-products) y se ve al instante', async () => {
    const user = userEvent.setup()
    const { setFilas } = montar()
    await user.click(screen.getByRole('switch', { name: 'En venta Bebida lata' }))
    expect(cambiarEnVentaEnLocal).toHaveBeenCalledWith('lp-1', false)
    const actualizar = setFilas.mock.calls[0][0]
    expect(actualizar(FILAS)[0].en_venta).toBe(false)
    expect(actualizar(FILAS)[1].en_venta).toBe(true)
  })

  it('si «En venta» falla, lo dice y vuelve atrás', async () => {
    cambiarEnVentaEnLocal.mockRejectedValueOnce(new Error('No tienes permiso para cambiar lo que está en venta en este local.'))
    const user = userEvent.setup()
    const { setFilas } = montar()
    await user.click(screen.getByRole('switch', { name: 'En venta Bebida lata' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso')
    expect(setFilas).toHaveBeenCalledTimes(2)
    expect(setFilas.mock.calls[1][0](FILAS)[0].en_venta).toBe(true)
  })

  it('sumar unidades guarda lo que llegó y recarga', async () => {
    const user = userEvent.setup()
    const { recargar } = montar()
    await user.click(screen.getByRole('button', { name: 'Sumar unidades a Bebida lata' }))
    const dialogo = screen.getByRole('dialog', { name: 'Sumar unidades' })
    await user.type(within(dialogo).getByLabelText('¿Cuántas unidades llegaron?'), '24')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(sumarUnidades).toHaveBeenCalledWith('inv-1', 24, ''))
    expect(recargar).toHaveBeenCalled()
  })

  it('tiene los botones Categorías, Importar del catálogo, Importar desde planilla y Nuevo producto', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /Importar del catálogo/ }))
    expect(screen.getByRole('dialog', { name: 'Importar del catálogo' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Importar desde planilla/ }))
    expect(screen.getByRole('dialog', { name: 'Importar desde planilla' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nuevo producto/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Categorías/ }))
    expect(screen.getByRole('dialog', { name: 'Categorías de carta' })).toBeInTheDocument()
  })
})

describe('CategoriasDialog', () => {
  it('eliminar una categoría ahora funciona (DELETE /categories) y recarga', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onCambio = vi.fn()
    const user = userEvent.setup()
    render(<CategoriasDialog localId="l1" categorias={CATEGORIAS} onCambio={onCambio} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Eliminar Aguas' }))
    expect(deleteCategory).toHaveBeenCalledWith('c2')
    await waitFor(() => expect(onCambio).toHaveBeenCalled())
  })

  it('si la categoría tiene productos, muestra el motivo del backend', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteCategory.mockRejectedValueOnce(Object.assign(new Error('400: No se puede eliminar la categoría porque hay productos vinculados a esta categoría.'), { status: 400 }))
    const user = userEvent.setup()
    render(<CategoriasDialog localId="l1" categorias={CATEGORIAS} onCambio={vi.fn()} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Eliminar Bebidas' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/^No se puede eliminar la categoría porque hay productos/)
  })

  it('sube y baja categorías', async () => {
    const user = userEvent.setup()
    render(<CategoriasDialog localId="l1" categorias={CATEGORIAS} onCambio={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Subir Bebidas' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Subir Aguas' }))
    expect(guardarOrden).toHaveBeenCalledWith([{ id: 'c2', sort_order: 10 }, { id: 'c1', sort_order: 20 }])
  })
})
