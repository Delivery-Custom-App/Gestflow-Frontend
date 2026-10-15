/** Historial del stock (T-58). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HistorialStockModal from './HistorialStockModal'
import { apiRequest } from '../../lib/apiClient'
import { textoDelta, validarMovimientoStock } from '../../lib/movimientosStock'

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
