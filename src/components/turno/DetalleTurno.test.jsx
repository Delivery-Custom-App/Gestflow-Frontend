import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DetalleTurno from './DetalleTurno'
import { getCajaResumen, getMovimientosCaja } from '../../lib/salesApi'

vi.mock('../../lib/salesApi', () => ({ getCajaResumen: vi.fn(), getMovimientosCaja: vi.fn() }))

const RESUMEN = {
  monto_apertura: '20000.00', total_ingresos: '9500.00', total_esperado: '29500.00',
  por_metodo: [{ payment_method: 'cash', total: '5000.00' }, { payment_method: 'MERCADOPAGO_POINT', total: '4500.00' }],
}
const MOVIMIENTOS = [
  { id: 'm-1', tipo: 'ingreso', monto: '5000.00', order_id: 'o-1', payment_source: 'mostrador', created_at: '2026-10-04T15:00:00Z' },
  { id: 'm-2', tipo: 'ingreso', monto: '4500.00', order_id: 'o-2', payment_source: 'mostrador', created_at: '2026-10-04T16:00:00Z' },
  { id: 'm-3', tipo: 'egreso', monto: '1000.00', order_id: null, created_at: '2026-10-04T17:00:00Z' },
]
const cifra = (label) => screen.getByText(label).nextSibling

beforeEach(() => {
  vi.clearAllMocks()
  getCajaResumen.mockResolvedValue(RESUMEN)
  getMovimientosCaja.mockResolvedValue(MOVIMIENTOS)
})

describe('DetalleTurno', () => {
  it('resume ventas, ingresos y egresos del turno', async () => {
    render(<DetalleTurno caja={{ id: 't-1' }} />)

    expect(await screen.findByText('Ventas')).toBeInTheDocument()
    expect(cifra('Ventas')).toHaveTextContent('2')
    expect(cifra('Ingresos')).toHaveTextContent('$9.500')
    expect(cifra('Egresos')).toHaveTextContent('$1.000')
    expect(getCajaResumen).toHaveBeenCalledWith('t-1')
  })

  it('muestra el desglose por método y cada movimiento, con el egreso marcado', async () => {
    render(<DetalleTurno caja={{ id: 't-1' }} />)

    expect(await screen.findByText('Desglose por método de pago')).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('Egreso')).toBeInTheDocument()
    expect(screen.getByText('− $1.000')).toBeInTheDocument()
  })

  it('al vendedor no le muestra el arqueo; al encargado sí (apertura y total esperado)', async () => {
    const { unmount } = render(<DetalleTurno caja={{ id: 't-1' }} />)
    await screen.findByText('Ventas')
    expect(screen.queryByText('Apertura')).not.toBeInTheDocument()
    expect(screen.queryByText('Total esperado')).not.toBeInTheDocument()
    unmount()

    render(<DetalleTurno caja={{ id: 't-1' }} conArqueo />)
    await screen.findByText('Ventas')
    expect(cifra('Apertura')).toHaveTextContent('$20.000')
    expect(cifra('Total esperado')).toHaveTextContent('$29.500')
  })

  it('sin movimientos lo dice', async () => {
    getMovimientosCaja.mockResolvedValue([])
    render(<DetalleTurno caja={{ id: 't-1' }} />)
    expect(await screen.findByText('Todavía no hay movimientos registrados en este turno.')).toBeInTheDocument()
    expect(cifra('Ventas')).toHaveTextContent('0')
  })

  it('si no se puede cargar, lo explica', async () => {
    getCajaResumen.mockRejectedValue(new Error('No autorizado'))
    render(<DetalleTurno caja={{ id: 't-1' }} />)
    expect(await screen.findByText('No autorizado')).toBeInTheDocument()
  })
})
