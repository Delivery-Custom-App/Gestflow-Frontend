/** Inventario · Resumen (#175). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResumenInventario from './ResumenInventario'
import { getProductsReport } from '../../../lib/reportsApi'
import { listarMovimientosStock } from '../../../lib/movimientosStock'
import { sumarUnidades } from '../../../lib/inventoryApi'
import { listarPlatosPreparados } from '../../../lib/inventarioUnificado'

vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal()),
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}))
vi.mock('../../../lib/reportsApi', () => ({ getProductsReport: vi.fn() }))
vi.mock('../../../lib/movimientosStock', async (importOriginal) => ({ ...(await importOriginal()), listarMovimientosStock: vi.fn() }))
vi.mock('../../../lib/inventarioUnificado', async (importOriginal) => ({ ...(await importOriginal()), listarPlatosPreparados: vi.fn() }))
vi.mock('../../../lib/inventoryApi', () => ({ sumarUnidades: vi.fn(() => Promise.resolve({})) }))

const FILAS = [
  { inventory_id: 'i1', product_id: 'p1', product_name: 'Bebida', stock_current: 20, stock_min: 5, stock_status: 'OPTIMO', total_value: 16000, price: 1500, cost: 800 },
  { inventory_id: 'i2', product_id: 'p2', product_name: 'Jugo', stock_current: 4, stock_min: 5, stock_status: 'BAJO', total_value: 3200 },
  { inventory_id: 'i3', product_id: 'p3', product_name: 'Agua', stock_current: 0, stock_min: 5, stock_status: 'CRITICO', total_value: 0 },
]

beforeEach(() => {
  vi.clearAllMocks()
  getProductsReport.mockResolvedValue({ ranking: [{ product_id: 'p1', product_name: 'Bebida', quantity_sold: 12 }] })
  listarMovimientosStock.mockResolvedValue({ movimientos: [] })
  listarPlatosPreparados.mockResolvedValue([])
})

describe('ResumenInventario', () => {
  it('mantiene los KPI de siempre y suma Por reponer', async () => {
    render(<ResumenInventario localId="l1" filas={FILAS} recargar={vi.fn()} />)
    const kpi = (nombre) => screen.getByText(nombre).closest('div')
    expect(kpi('Total productos')).toHaveTextContent('3')
    expect(kpi('Stock óptimo')).toHaveTextContent('1')
    expect(kpi('Stock crítico')).toHaveTextContent('1')
    expect(kpi('Valor total')).toHaveTextContent('19.200')
    expect(kpi('Por reponer')).toHaveTextContent('2')
    await waitFor(() => expect(listarMovimientosStock).toHaveBeenCalled())
  })

  it('la distribución tiene leyenda con porcentajes', async () => {
    render(<ResumenInventario localId="l1" filas={FILAS} recargar={vi.fn()} />)
    const leyenda = screen.getByRole('list', { name: 'Leyenda de la distribución' })
    expect(within(leyenda).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Óptimo133%', 'Bajo133%', 'Crítico133%'])
    await waitFor(() => expect(getProductsReport).toHaveBeenCalled())
  })

  it('«Hay que reponer» lista los críticos primero y suma desde ahí', async () => {
    const recargar = vi.fn()
    const user = userEvent.setup()
    render(<ResumenInventario localId="l1" filas={FILAS} recargar={recargar} />)
    const lista = screen.getByRole('list', { name: 'Productos por reponer' })
    expect(within(lista).getAllByRole('listitem')[0]).toHaveTextContent('Agua')
    await user.click(within(lista).getByRole('button', { name: 'Sumar unidades a Jugo' }))
    const dialogo = screen.getByRole('dialog', { name: 'Sumar unidades' })
    await user.type(within(dialogo).getByLabelText('¿Cuántas unidades llegaron?'), '10')
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(sumarUnidades).toHaveBeenCalledWith('i2', 10, ''))
    expect(recargar).toHaveBeenCalled()
  })

  it('muestra los más vendidos de la semana con su margen', async () => {
    render(<ResumenInventario localId="l1" filas={FILAS} recargar={vi.fn()} />)
    const fila = (await screen.findByRole('cell', { name: 'Bebida' })).closest('tr')
    expect(fila).toHaveTextContent('12')
    expect(fila).toHaveTextContent('700')
  })
  it('«Total productos» dice cuántos más hay sin stock registrado, para no contar distinto que Productos', async () => {
    render(<ResumenInventario localId="l1" filas={[...FILAS, { inventory_id: null, sin_registro: true, product_id: 'p4', product_name: 'Galletas' }]} recargar={vi.fn()} />)
    const kpi = screen.getByText('Total productos').closest('div')
    expect(kpi).toHaveTextContent('3')
    expect(kpi).toHaveTextContent('1 más sin registrar')
    await waitFor(() => expect(listarMovimientosStock).toHaveBeenCalled())
  })

  it('«Mermas de la semana» avisa si no se revisaron todos los movimientos', async () => {
    listarMovimientosStock.mockRejectedValue(new Error('500'))
    render(<ResumenInventario localId="l1" filas={FILAS} recargar={vi.fn()} />)
    expect(await screen.findByText('Puede ser más: no se revisaron todos los movimientos')).toBeInTheDocument()
  })

  it('un plato preparado entre los más vendidos también trae su margen', async () => {
    getProductsReport.mockResolvedValue({ ranking: [{ product_id: 'pl1', product_name: 'Lomo', quantity_sold: 30 }] })
    listarPlatosPreparados.mockResolvedValue([{ id: 'pl1', name: 'Lomo', price: 6000, cost: 2500 }])
    render(<ResumenInventario localId="l1" filas={FILAS} recargar={vi.fn()} />)
    const fila = (await screen.findByRole('cell', { name: 'Lomo' })).closest('tr')
    await waitFor(() => expect(fila).toHaveTextContent('3.500'))
  })
})
