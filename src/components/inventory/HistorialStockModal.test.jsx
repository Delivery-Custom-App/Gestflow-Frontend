/** Historial del stock (T-58). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HistorialStockModal from './HistorialStockModal'
import { apiRequest } from '../../lib/apiClient'
import { faltanteDe, textoDelta, validarMovimientoStock } from '../../lib/movimientosStock'

vi.mock('../../lib/apiClient', () => ({ apiRequest: vi.fn() }))

const MOVS = [
  { id: 'm1', tipo: 'ajuste', cantidad: '12.000', delta: '-3.000', stock_anterior: '15.000', stock_resultante: '12.000', motivo: 'Conteo del domingo', actor_email: 'admin@demo.cl', created_at: '2026-10-11T23:35:52Z' },
  { id: 'm2', tipo: 'ingreso', cantidad: '5.000', delta: '5.000', stock_anterior: '10.000', stock_resultante: '15.000', motivo: null, actor_email: 'marta@demo.cl', created_at: '2026-10-11T23:30:00Z' },
]

beforeEach(() => { vi.clearAllMocks() })

describe('HistorialStockModal', () => {
  it('pide los movimientos del inventario y muestra tipo, cambio, antes y después, motivo y quién', async () => {
    apiRequest.mockResolvedValue({ data: MOVS, total: 2 })
    render(<HistorialStockModal row={{ inventory_id: 'inv-1', product_name: 'Bebida lata' }} onClose={() => {}} />)
    const lista = await screen.findByRole('list', { name: 'Movimientos de stock' })
    expect(apiRequest).toHaveBeenCalledWith('/inventory/inv-1/movimientos?limit=20&offset=0', { withTotal: true })
    const [ajuste, ingreso] = within(lista).getAllByRole('listitem')
    expect(ajuste).toHaveTextContent('Ajuste de conteo')
    expect(ajuste).toHaveTextContent('-3 · de 15 a 12 (contado: 12)')
    expect(ajuste).toHaveTextContent('Motivo: Conteo del domingo')
    expect(ingreso).toHaveTextContent('+5 · de 10 a 15')
    expect(ingreso).toHaveTextContent('marta@demo.cl')
  })

  it('pagina según X-Total-Count', async () => {
    const user = userEvent.setup()
    apiRequest.mockResolvedValue({ data: MOVS, total: 45 })
    render(<HistorialStockModal row={{ inventory_id: 'inv-1' }} onClose={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }))
    expect(apiRequest).toHaveBeenLastCalledWith('/inventory/inv-1/movimientos?limit=20&offset=20', { withTotal: true })
  })
})

describe('lib/movimientosStock', () => {
  it('reglas: ingreso con cantidad > 0; merma y ajuste con motivo; ajuste admite 0', () => {
    expect(validarMovimientoStock({ tipo: 'ingreso', cantidad: 5 })).toBeNull()
    expect(validarMovimientoStock({ tipo: 'merma', cantidad: 3, motivo: '' })).toMatch(/motivo/)
    expect(validarMovimientoStock({ tipo: 'ajuste', cantidad: 0, motivo: 'Se acabó' })).toBeNull()
    expect(validarMovimientoStock({ tipo: 'ajuste', cantidad: null, motivo: 'x y z' })).toMatch(/contaste/)
  })
  it('textoDelta con signo', () => {
    expect(textoDelta('5.000')).toBe('+5')
    expect(textoDelta('-3.500')).toBe('-3.5')
  })
})

describe('#132 · ventas con faltante', () => {
  const VENTA_CON_FALTANTE = { id: 'v1', tipo: 'venta', cantidad: '2.000', delta: '-1.000', faltante: '1.000', stock_anterior: '1.000', stock_resultante: '0.000', order_id: 'o-1', created_at: '2026-10-20T12:00:00Z' }
  const VENTA_NORMAL = { id: 'v2', tipo: 'venta', cantidad: '3.000', delta: '-3.000', faltante: '0.000', stock_anterior: '10.000', stock_resultante: '7.000', created_at: '2026-10-20T11:00:00Z' }
  const VENTA_SIN_CAMPO = { id: 'v3', tipo: 'venta', cantidad: '1.000', delta: '-1.000', stock_anterior: '7.000', stock_resultante: '6.000', created_at: '2026-10-20T10:00:00Z' }

  it('faltanteDe: 0 si no viene, si es 0 o si no es un número', () => {
    expect(faltanteDe(VENTA_CON_FALTANTE)).toBe(1)
    expect(faltanteDe(VENTA_NORMAL)).toBe(0)
    expect(faltanteDe(VENTA_SIN_CAMPO)).toBe(0)
    expect(faltanteDe({ faltante: 'x' })).toBe(0)
  })

  it('una venta muestra lo vendido; si faltó, lo destaca y ofrece corregir el conteo', async () => {
    const user = userEvent.setup()
    const onCorregirConteo = vi.fn()
    const row = { inventory_id: 'inv-1', product_name: 'Café' }
    apiRequest.mockResolvedValue({ data: [VENTA_CON_FALTANTE, VENTA_NORMAL, VENTA_SIN_CAMPO], total: 3 })
    render(<HistorialStockModal row={row} onClose={() => {}} onCorregirConteo={onCorregirConteo} />)
    const [conFaltante, normal, sinCampo] = within(await screen.findByRole('list', { name: 'Movimientos de stock' })).getAllByRole('listitem')

    expect(conFaltante).toHaveTextContent('-1 · de 1 a 0 · vendido: 2')
    const aviso = within(conFaltante).getByRole('note', { name: 'Faltante en la venta' })
    expect(aviso).toHaveTextContent('Faltaron 1')
    expect(aviso).toHaveTextContent('Vuelve a contar el producto')

    expect(normal).toHaveTextContent('-3 · de 10 a 7 · vendido: 3')
    expect(within(normal).queryByRole('note')).not.toBeInTheDocument()
    // Con el backend anterior el campo no viene: se trata como 0.
    expect(within(sinCampo).queryByRole('note')).not.toBeInTheDocument()

    await user.click(within(aviso).getByRole('button', { name: 'Corregir conteo' }))
    expect(onCorregirConteo).toHaveBeenCalledWith(row)
  })

  it('sin onCorregirConteo el aviso se muestra sin el botón', async () => {
    apiRequest.mockResolvedValue({ data: [VENTA_CON_FALTANTE], total: 1 })
    render(<HistorialStockModal row={{ inventory_id: 'inv-1' }} onClose={() => {}} />)
    const aviso = await screen.findByRole('note', { name: 'Faltante en la venta' })
    expect(within(aviso).queryByRole('button')).not.toBeInTheDocument()
  })
})
