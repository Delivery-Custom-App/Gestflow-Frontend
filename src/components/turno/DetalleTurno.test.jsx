import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DetalleTurno from './DetalleTurno'
import { getCajaResumen, getMovimientosCaja, listOrdenesDelTurno } from '../../lib/salesApi'

vi.mock('../../lib/salesApi', () => ({ getCajaResumen: vi.fn(), getMovimientosCaja: vi.fn(), listOrdenesDelTurno: vi.fn() }))

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

  it('con el desglose de apertura (B-28), el encargado ve los billetes y monedas', async () => {
    getCajaResumen.mockResolvedValue({
      ...RESUMEN,
      apertura_desglose: [
        { denominacion: 100, tipo: 'moneda', cantidad: 50 },
        { denominacion: 5000, tipo: 'billete', cantidad: 3 },
      ],
    })
    render(<DetalleTurno caja={{ id: 't-1' }} conArqueo />)

    const lista = await screen.findByRole('list', { name: 'Efectivo de apertura' })
    const filas = lista.querySelectorAll('li')
    expect(filas[0]).toHaveTextContent('3 × $5.000')
    expect(filas[0]).toHaveTextContent('$15.000')
    expect(filas[1]).toHaveTextContent('50 × $100')
    expect(filas[1]).toHaveTextContent('$5.000')
  })

  it('sin desglose (o para el vendedor) no muestra la lista de billetes', async () => {
    const { unmount } = render(<DetalleTurno caja={{ id: 't-1' }} conArqueo />)
    await screen.findByText('Ventas')
    expect(screen.queryByText('Efectivo de apertura')).not.toBeInTheDocument()
    unmount()

    getCajaResumen.mockResolvedValue({ ...RESUMEN, apertura_desglose: [{ denominacion: 1000, tipo: 'billete', cantidad: 2 }] })
    render(<DetalleTurno caja={{ id: 't-1' }} />)
    await screen.findByText('Ventas')
    expect(screen.queryByText('Efectivo de apertura')).not.toBeInTheDocument()
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

describe('DetalleTurno · efectivo esperado y por máquina (T-48)', () => {
  const CON_MAQUINAS = {
    ...RESUMEN,
    total_vendido: '9500.00', total_egresos: '1000.00', efectivo_esperado: '24000.00',
    por_maquina: [{ pos_machine_id: 'pm-1', display_name: 'Point barra', total: '4500.00', cobros: 2 }],
  }

  it('destaca el efectivo esperado en el cajón y muestra lo cobrado por máquina', async () => {
    getCajaResumen.mockResolvedValue(CON_MAQUINAS)
    render(<DetalleTurno caja={{ id: 't-1' }} conArqueo />)
    expect(await screen.findByText('Efectivo esperado en el cajón')).toBeInTheDocument()
    expect(cifra('Efectivo esperado en el cajón')).toHaveTextContent('$24.000')
    const tabla = screen.getByRole('table', { name: 'Por máquina' })
    expect(within(tabla).getByText('Point barra')).toBeInTheDocument()
    expect(within(tabla).getByText('$4.500')).toBeInTheDocument()
    expect(within(tabla).getByText('2')).toBeInTheDocument()
  })

  it('sin cobros con tarjeta no muestra la tabla por máquina', async () => {
    getCajaResumen.mockResolvedValue({ ...CON_MAQUINAS, por_maquina: [] })
    render(<DetalleTurno caja={{ id: 't-1' }} conArqueo />)
    await screen.findByText('Efectivo esperado en el cajón')
    expect(screen.queryByRole('table', { name: 'Por máquina' })).not.toBeInTheDocument()
  })

  it('«Ver órdenes del turno» las pide con GET /orders?caja_id=', async () => {
    const user = userEvent.setup()
    getCajaResumen.mockResolvedValue(CON_MAQUINAS)
    listOrdenesDelTurno.mockResolvedValue([{ id: 'abcdef1234', created_at: '2026-10-04T15:00:00Z', status: 'COMPLETED', total: 5000 }])
    render(<DetalleTurno caja={{ id: 't-1' }} conArqueo />)
    await user.click(await screen.findByRole('button', { name: 'Ver órdenes del turno' }))
    expect(listOrdenesDelTurno).toHaveBeenCalledWith('t-1')
    const lista = await screen.findByRole('list', { name: 'Órdenes del turno' })
    expect(within(lista).getByText('#ABCDEF12')).toBeInTheDocument()
    expect(within(lista).getByText('Cobrada')).toBeInTheDocument()
  })

  it('al vendedor no le muestra el arqueo ni las órdenes', async () => {
    getCajaResumen.mockResolvedValue(CON_MAQUINAS)
    render(<DetalleTurno caja={{ id: 't-1' }} />)
    await screen.findByText('Ventas')
    expect(screen.queryByText('Efectivo esperado en el cajón')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver órdenes del turno' })).not.toBeInTheDocument()
  })
})

describe('DetalleTurno · vendido, ingresos manuales, egresos y arqueo (T-57)', () => {
  const CERRADO = {
    ...RESUMEN, total_ingresos: '7100.00', total_vendido: '6600.00', ingresos_manuales: '500.00', total_egresos: '1000.00',
    efectivo_esperado: '8900.00', monto_cierre_declarado: '8600.00', diferencia: '-300.00', nota_cierre: 'Vuelto mal dado',
  }

  it('separa lo vendido, lo que entró a mano y lo que salió', async () => {
    getCajaResumen.mockResolvedValue({ ...CERRADO, monto_cierre_declarado: null, diferencia: null, nota_cierre: null })
    render(<DetalleTurno caja={{ id: 't-1', status: 'open' }} conArqueo />)
    expect(await screen.findByText('Vendido')).toBeInTheDocument()
    expect(cifra('Vendido')).toHaveTextContent('$6.600')
    expect(cifra('Ingresos manuales')).toHaveTextContent('$500')
    expect(cifra('Egresos')).toHaveTextContent('$1.000')
    expect(cifra('Efectivo esperado en el cajón')).toHaveTextContent('$8.900')
    // Turno abierto: todavía no hay arqueo.
    expect(screen.queryByRole('group', { name: 'Arqueo del cierre' })).not.toBeInTheDocument()
  })

  it('en un turno cerrado muestra contado, diferencia en rojo si falta, nota y quién cerró', async () => {
    getCajaResumen.mockResolvedValue(CERRADO)
    render(<DetalleTurno caja={{ id: 't-1', status: 'closed' }} conArqueo cerradoPor="Marta Díaz" />)
    const arqueo = await screen.findByRole('group', { name: 'Arqueo del cierre' })
    expect(within(arqueo).getByText('Contado').nextSibling).toHaveTextContent('$8.600')
    expect(within(arqueo).getByTestId('diferencia-cierre')).toHaveTextContent('Faltan $300')
    expect(within(arqueo).getByTestId('diferencia-cierre').className).toMatch(/red/)
    expect(arqueo).toHaveTextContent('Nota: Vuelto mal dado')
    expect(arqueo).toHaveTextContent('Cerró: Marta Díaz')
  })

  it('un turno cerrado antes del cambio (campos en null) dice «Sin arqueo»', async () => {
    getCajaResumen.mockResolvedValue({ ...RESUMEN, monto_cierre_declarado: null, diferencia: null, nota_cierre: null })
    render(<DetalleTurno caja={{ id: 't-1', status: 'closed' }} conArqueo />)
    const arqueo = await screen.findByRole('group', { name: 'Arqueo del cierre' })
    expect(arqueo).toHaveTextContent(/Sin arqueo/)
  })
})
