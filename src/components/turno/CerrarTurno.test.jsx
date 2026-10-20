/** Cierre de caja con conteo, resumen, trabajadores sin terminar y comprobante (T-55). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import CerrarTurno from './CerrarTurno'
import { closeCaja, getCajaResumen, getMovimientosCaja, listCajas, listMesas, listOrdenesDelTurno } from '../../lib/salesApi'
import { forzarTermino } from '../../lib/supervision'
import { imprimirEnNavegador } from '../../lib/ticketPrint'
import { descargarComprobante } from '../../lib/comprobanteCierre'
import { etiquetaDenominacion } from '../../lib/efectivo'

vi.mock('../../lib/salesApi', () => ({
  closeCaja: vi.fn(), getCajaResumen: vi.fn(), getMovimientosCaja: vi.fn(), listCajas: vi.fn(), listMesas: vi.fn(), listOrdenesDelTurno: vi.fn(),
}))
vi.mock('../../lib/supervision', async (importOriginal) => ({ ...(await importOriginal()), forzarTermino: vi.fn() }))
vi.mock('../../lib/ticketPrint', async (importOriginal) => ({ ...(await importOriginal()), imprimirEnNavegador: vi.fn() }))
vi.mock('../../lib/comprobanteCierre', async (importOriginal) => ({ ...(await importOriginal()), descargarComprobante: vi.fn() }))
vi.mock('../../lib/fondoEmergencia', async (importOriginal) => ({ ...(await importOriginal()), hoyEnChile: () => '2026-10-17' }))

// Fondo 5.000 + efectivo 8.200 + ingresos 1.000 − retiros 5.300 = 8.900 esperado; tarjeta y transferencia no entran al cajón.
const RESUMEN = {
  monto_apertura: '5000.00', total_ingresos: '21200.00', total_vendido: '20200.00', ingresos_manuales: '1000.00',
  total_egresos: '5300.00', efectivo_esperado: '8900.00',
}
const MOVIMIENTOS = [
  { id: 'm1', tipo: 'ingreso', monto: '8200.00', payment_method: 'cash', order_id: 'o1' },
  { id: 'm2', tipo: 'ingreso', monto: '5000.00', payment_method: 'debit', order_id: 'o2' },
  { id: 'm3', tipo: 'ingreso', monto: '7000.00', payment_method: 'transfer', order_id: 'o3' },
  { id: 'm4', tipo: 'ingreso', monto: '1000.00', payment_method: 'cash', order_id: null },
  { id: 'm5', tipo: 'egreso', monto: '5300.00', payment_method: 'cash', order_id: null },
]
const FISICA = { id: 'cf1', name: 'Caja Principal', tipo: 'fisica' }
const DIGITAL = { id: 'cf2', name: 'Caja Digital', tipo: 'digital' }
const USUARIOS = [
  { id: 'beto', role: 'EMPLEADO', first_name: 'Beto', last_name: 'Soto' },
  { id: 'ana', role: 'EMPLEADO', first_name: 'Ana', last_name: 'Rojas' },
]
const NOMBRES = { beto: 'Beto Soto', ana: 'Ana Rojas' }

const turno = (id, quien, extra = {}) => ({
  id, status: 'open', caja_fisica_id: 'cf1', local_id: 'loc-1', cashier_user_id: quien, business_date: '2026-10-17',
  opened_at: '2026-10-17T13:00:00Z', turno_terminado_at: null, ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  getCajaResumen.mockResolvedValue(RESUMEN)
  getMovimientosCaja.mockResolvedValue(MOVIMIENTOS)
  closeCaja.mockResolvedValue({ id: 'c1', status: 'closed', closed_at: '2026-10-17T21:30:00Z' })
  listOrdenesDelTurno.mockResolvedValue([])
  listMesas.mockResolvedValue([])
  listCajas.mockResolvedValue([])
  forzarTermino.mockResolvedValue({})
})

const montar = (props = {}) => render(
  <MemoryRouter>
    <CerrarTurno
      cajaId="c1" localId="loc-1" cajaFisica={FISICA} localNombre="Sucursal Centro" vendedor="Beto Soto" cierra="Centro Admin"
      usuarios={USUARIOS} nombreDeUsuario={(id) => NOMBRES[id] || id}
      onCerrado={vi.fn()} onCancelar={vi.fn()} {...props}
    />
  </MemoryRouter>,
)

/** Escribe la cantidad de cada billete o moneda: { 5000: 1, 100: 4 }. */
async function contar(user, cantidades) {
  for (const [valor, n] of Object.entries(cantidades)) {
    const tipo = Number(valor) >= 1000 ? 'billetes' : 'monedas'
    await user.type(screen.getByLabelText(`Cantidad de ${tipo} de ${etiquetaDenominacion(Number(valor))}`), String(n))
  }
}

// 5.000 + 2.000 + 1.000 + 500 + 4 × 100 = 8.900
const CUADRA = { 5000: 1, 2000: 1, 1000: 1, 500: 1, 100: 4 }
const cerrarTurno = (user) => user.click(screen.getByRole('button', { name: /Cerrar turno/ }))
// El resumen aparece cuando ya llegaron el resumen y los movimientos del turno.
const listo = () => screen.findByTestId('resumen-fondo')
const resumen = () => within(screen.getByRole('region', { name: 'Resumen del cierre' }))

describe('CerrarTurno · caja física: conteo de billetes y monedas', () => {
  it('muestra siempre el conteo por billetes y monedas, sin una bandera y sin un campo de total', async () => {
    montar()
    await listo()
    expect(screen.getByTestId('efectivo-esperado-cierre')).toHaveTextContent('$8.900')
    expect(screen.getByLabelText('Cantidad de billetes de $20.000')).toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad de monedas de $10')).toBeInTheDocument()
    expect(screen.queryByLabelText('Efectivo contado')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Contar por billetes y monedas')).not.toBeInTheDocument()
  })

  it('cuadra: el total contado es lo que se manda como monto_cierre_declarado y no pide nota', async () => {
    const user = userEvent.setup()
    montar()
    await listo()
    await contar(user, CUADRA)
    expect(resumen().getByTestId('resumen-contado')).toHaveTextContent('$8.900')
    expect(resumen().getByTestId('resumen-diferencia')).toHaveTextContent('Cuadra')
    expect(screen.getByLabelText('Nota (opcional)')).toBeInTheDocument()
    await cerrarTurno(user)
    expect(closeCaja).toHaveBeenCalledWith('c1', { montoCierreDeclarado: 8900, notaCierre: '' })
  })

  it('falta: muestra «Faltan $X» y la nota es obligatoria', async () => {
    const user = userEvent.setup()
    montar()
    await listo()
    await contar(user, { 5000: 1, 2000: 1, 1000: 1, 100: 6 }) // 8.600
    expect(resumen().getByTestId('resumen-diferencia')).toHaveTextContent('Faltan $300')

    await cerrarTurno(user)
    expect(screen.getByRole('alert')).toHaveTextContent(/explica la diferencia/)
    expect(screen.getByLabelText(/Nota \(obligatoria/)).toHaveFocus()
    expect(closeCaja).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Nota \(obligatoria/), 'Vuelto mal dado')
    await cerrarTurno(user)
    expect(closeCaja).toHaveBeenCalledWith('c1', { montoCierreDeclarado: 8600, notaCierre: 'Vuelto mal dado' })
  })

  it('sobra: muestra «Sobran $X» y la nota es obligatoria', async () => {
    const user = userEvent.setup()
    montar()
    await listo()
    await contar(user, { 5000: 1, 2000: 1, 1000: 1, 500: 1, 100: 6 }) // 9.100
    expect(resumen().getByTestId('resumen-diferencia')).toHaveTextContent('Sobran $200')

    await cerrarTurno(user)
    expect(screen.getByRole('alert')).toHaveTextContent(/explica la diferencia/)
    expect(closeCaja).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Nota \(obligatoria/), 'Propina sin anotar')
    await cerrarTurno(user)
    expect(closeCaja).toHaveBeenCalledWith('c1', { montoCierreDeclarado: 9100, notaCierre: 'Propina sin anotar' })
  })

  it('un cajón vacío con efectivo esperado es una diferencia: pide la nota, no cierra en silencio', async () => {
    const user = userEvent.setup()
    montar()
    await listo()
    expect(resumen().getByTestId('resumen-diferencia')).toHaveTextContent('Faltan $8.900')
    await cerrarTurno(user)
    expect(closeCaja).not.toHaveBeenCalled()
  })

  it('dice que lo contado es lo que queda en la caja para mañana y que un retiro se registra antes', async () => {
    const user = userEvent.setup()
    const onRegistrarRetiro = vi.fn()
    montar({ onRegistrarRetiro })
    const aviso = await screen.findByRole('note', { name: 'Lo contado queda en la caja' })
    expect(aviso).toHaveTextContent('Lo que cuentas es lo que queda en la caja para mañana')
    expect(aviso).toHaveTextContent(/retirar plata \(por ejemplo, un depósito\), regístrala antes como retiro/)
    await user.click(within(aviso).getByRole('button', { name: 'Registrar un retiro' }))
    expect(onRegistrarRetiro).toHaveBeenCalled()
  })

  it('sin forma de registrar retiros no ofrece el atajo, pero el texto sigue', async () => {
    montar()
    const aviso = await screen.findByRole('note', { name: 'Lo contado queda en la caja' })
    expect(within(aviso).queryByRole('button', { name: 'Registrar un retiro' })).not.toBeInTheDocument()
  })

  it('el 400 «Explícala en nota_cierre» no borra lo contado y enfoca la nota', async () => {
    const user = userEvent.setup()
    getCajaResumen.mockRejectedValue(new Error('sin red')) // sin el esperado, se descubre al cerrar
    closeCaja.mockRejectedValue(Object.assign(new Error('400: x'), {
      status: 400,
      detail: 'El efectivo contado (8600.00) no coincide con lo esperado (8900.00): diferencia de -300.00. Explícala en nota_cierre',
    }))
    montar()
    await listo()
    expect(screen.getByTestId('efectivo-esperado-cierre')).toHaveTextContent('—')
    await contar(user, { 5000: 1, 2000: 1, 1000: 1, 100: 6 })
    await cerrarTurno(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('diferencia de -300.00: explícala en la nota.')
    expect(screen.getByLabelText('Cantidad de billetes de $5.000')).toHaveValue('1')
    expect(screen.getByLabelText(/Nota/)).toHaveFocus()
  })

  it('el 409 de órdenes en curso se explica y no cierra', async () => {
    const user = userEvent.setup()
    const onCerrado = vi.fn()
    closeCaja.mockRejectedValue(Object.assign(new Error('409: No se puede cerrar la caja: hay órdenes en curso contra ella'), { status: 409 }))
    montar({ onCerrado })
    await listo()
    await contar(user, CUADRA)
    await cerrarTurno(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(/pedido de mostrador reciente/)
    expect(onCerrado).not.toHaveBeenCalled()
  })
})

describe('CerrarTurno · caja digital', () => {
  it('se cierra sin conteo de efectivo: no muestra el conteo y no manda monto_cierre_declarado', async () => {
    const user = userEvent.setup()
    montar({ cajaFisica: DIGITAL })
    expect(await screen.findByText(/Esta caja es digital: no hay efectivo que contar/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Cantidad de billetes de $20.000')).not.toBeInTheDocument()
    expect(screen.queryByTestId('efectivo-esperado-cierre')).not.toBeInTheDocument()
    expect(screen.queryByRole('note', { name: 'Lo contado queda en la caja' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('resumen-contado')).not.toBeInTheDocument()
    expect(screen.queryByTestId('resumen-diferencia')).not.toBeInTheDocument()
    expect(await screen.findByTestId('resumen-fondo')).toHaveTextContent('$5.000')

    await cerrarTurno(user)
    expect(closeCaja).toHaveBeenCalledWith('c1', { notaCierre: '' })
    expect(closeCaja.mock.calls[0][1]).not.toHaveProperty('montoCierreDeclarado')
    expect(await screen.findByRole('status')).toHaveTextContent('Se cerró sin contar efectivo')
  })
})

describe('CerrarTurno · resumen antes de confirmar', () => {
  it('muestra, en una sola pantalla, los montos del backend', async () => {
    const user = userEvent.setup()
    montar()
    await screen.findByTestId('resumen-fondo')
    expect(resumen().getByTestId('resumen-fondo')).toHaveTextContent('$5.000')
    expect(resumen().getByTestId('resumen-ventas-efectivo')).toHaveTextContent('$8.200')
    expect(resumen().getByTestId('resumen-ventas-tarjeta')).toHaveTextContent('$5.000')
    expect(resumen().getByTestId('resumen-ventas-transferencia')).toHaveTextContent('$7.000')
    expect(resumen().getByTestId('resumen-ingresos')).toHaveTextContent('$1.000')
    expect(resumen().getByTestId('resumen-retiros')).toHaveTextContent('$5.300')
    expect(resumen().getByTestId('resumen-esperado')).toHaveTextContent('$8.900')
    expect(resumen().getByTestId('resumen-contado')).toHaveTextContent('$0')
    expect(resumen().getByTestId('resumen-diferencia')).toHaveTextContent('Faltan $8.900')

    // Lo contado y la diferencia se actualizan mientras se cuenta.
    await contar(user, CUADRA)
    expect(resumen().getByTestId('resumen-contado')).toHaveTextContent('$8.900')
    expect(resumen().getByTestId('resumen-diferencia')).toHaveTextContent('Cuadra')
    expect(screen.queryByTestId('resumen-ventas-otros')).not.toBeInTheDocument()
  })

  it('si no llegan los movimientos, las ventas por medio quedan en «—» y lo demás sigue', async () => {
    getMovimientosCaja.mockRejectedValue(new Error('sin red'))
    montar()
    expect(await screen.findByTestId('resumen-ventas-efectivo')).toHaveTextContent('—')
    expect(screen.getByTestId('resumen-fondo')).toHaveTextContent('$5.000')
    expect(screen.getByTestId('resumen-esperado')).toHaveTextContent('$8.900')
  })

  it('las ventas con un medio que no es efectivo, tarjeta ni transferencia no se pierden', async () => {
    getMovimientosCaja.mockResolvedValue([...MOVIMIENTOS, { id: 'm9', tipo: 'ingreso', monto: '900.00', payment_method: 'mercadopago', order_id: 'o9' }])
    montar()
    expect(await screen.findByTestId('resumen-ventas-otros')).toHaveTextContent('$900')
  })
})

describe('CerrarTurno · trabajadores con el turno sin terminar (T-42)', () => {
  beforeEach(() => {
    listCajas.mockResolvedValue([
      turno('c1', 'beto'),
      turno('c2', 'ana'),
      turno('c3', 'ana', { caja_fisica_id: 'cf9' }), // otra caja física: no es de esta caja
      turno('c4', 'beto', { turno_terminado_at: '2026-10-17T15:00:00Z' }), // ya terminó
    ])
  })

  it('lista quién no terminó su turno en esa caja, cada uno con «Forzar término»', async () => {
    montar()
    const aviso = await screen.findByRole('note', { name: 'Trabajadores con el turno sin terminar' })
    expect(within(aviso).getByText('Beto Soto')).toBeInTheDocument()
    expect(within(aviso).getByText(/este turno/)).toBeInTheDocument()
    expect(within(aviso).getByText('Ana Rojas')).toBeInTheDocument()
    expect(within(aviso).getAllByRole('listitem')).toHaveLength(2)
    expect(within(aviso).getByRole('button', { name: 'Forzar término del turno de Beto Soto' })).toBeInTheDocument()
    expect(within(aviso).getByRole('button', { name: 'Forzar término del turno de Ana Rojas' })).toBeInTheDocument()
    // No bloquea el cierre.
    expect(screen.getByRole('button', { name: /Cerrar turno/ })).toBeEnabled()
  })

  it('«Forzar término» pide el motivo, termina ese turno y recarga la lista', async () => {
    const user = userEvent.setup()
    montar()
    const aviso = await screen.findByRole('note', { name: 'Trabajadores con el turno sin terminar' })
    await user.click(within(aviso).getByRole('button', { name: 'Forzar término del turno de Ana Rojas' }))

    await user.click(within(aviso).getByRole('button', { name: 'Forzar término' }))
    expect(within(aviso).getByRole('alert')).toHaveTextContent(/motivo/)
    expect(forzarTermino).not.toHaveBeenCalled()

    listCajas.mockResolvedValue([turno('c1', 'beto')])
    await user.type(within(aviso).getByLabelText('Motivo'), 'Se fue a las 5')
    await user.click(within(aviso).getByRole('button', { name: 'Forzar término' }))

    expect(forzarTermino).toHaveBeenCalledWith('c2', { motivo: 'Se fue a las 5', reasignarAUserId: null, cerrarSesion: false })
    expect(await within(aviso).findByRole('status')).toHaveTextContent('Ana Rojas: Se terminó el turno')
    await waitFor(() => expect(within(aviso).queryByText('Ana Rojas', { selector: 'span.font-semibold' })).not.toBeInTheDocument())
    expect(listCajas.mock.calls.length).toBeGreaterThan(1)
  })

  it('forzar el término de un turno no cierra el turno aunque el conteo ya cuadre', async () => {
    const user = userEvent.setup()
    montar()
    await listo()
    await contar(user, CUADRA) // un cierre sin diferencia: si el envío subiera al cierre, cerraría el turno
    const aviso = await screen.findByRole('note', { name: 'Trabajadores con el turno sin terminar' })
    await user.click(within(aviso).getByRole('button', { name: 'Forzar término del turno de Ana Rojas' }))
    await user.type(within(aviso).getByLabelText('Motivo'), 'Se fue a las 5')
    await user.click(within(aviso).getByRole('button', { name: 'Forzar término' }))

    await waitFor(() => expect(forzarTermino).toHaveBeenCalledWith('c2', expect.objectContaining({ motivo: 'Se fue a las 5' })))
    expect(closeCaja).not.toHaveBeenCalled()
    expect(screen.getByRole('form', { name: 'Cerrar turno' })).toBeInTheDocument()
    // El formulario de «Forzar término» no está dentro del de cierre.
    expect(within(screen.getByRole('form', { name: 'Cerrar turno' })).queryByLabelText('Motivo')).not.toBeInTheDocument()
  })

  it('con mesas abiertas pide a quién pasarlas y ofrece solo a quienes tienen turno hoy', async () => {
    const user = userEvent.setup()
    forzarTermino.mockRejectedValueOnce(Object.assign(new Error('409: x'), {
      status: 409, detail: 'El turno tiene mesas abiertas: indica a qué empleado se reasignan (reasignar_a_user_id)',
    }))
    montar()
    const aviso = await screen.findByRole('note', { name: 'Trabajadores con el turno sin terminar' })
    await user.click(within(aviso).getByRole('button', { name: 'Forzar término del turno de Beto Soto' }))
    await user.type(within(aviso).getByLabelText('Motivo'), 'Emergencia')
    await user.click(within(aviso).getByRole('button', { name: 'Forzar término' }))

    expect(await within(aviso).findByRole('alert')).toHaveTextContent(/indica a qué empleado se reasignan/)
    const destino = within(aviso).getByLabelText('Pasar sus mesas abiertas a (obligatorio)')
    expect(within(destino).getByRole('option', { name: 'Ana Rojas' })).toBeInTheDocument()
    expect(within(destino).queryByRole('option', { name: 'Beto Soto' })).not.toBeInTheDocument()

    await user.selectOptions(destino, 'ana')
    await user.click(within(aviso).getByRole('button', { name: 'Forzar término' }))
    expect(forzarTermino).toHaveBeenLastCalledWith('c1', { motivo: 'Emergencia', reasignarAUserId: 'ana', cerrarSesion: false })
  })

  it('si nadie sigue con el turno abierto, no muestra el aviso', async () => {
    listCajas.mockResolvedValue([turno('c4', 'beto', { turno_terminado_at: '2026-10-17T15:00:00Z' })])
    montar()
    await screen.findByTestId('resumen-fondo')
    await waitFor(() => expect(listCajas).toHaveBeenCalled())
    expect(screen.queryByRole('note', { name: 'Trabajadores con el turno sin terminar' })).not.toBeInTheDocument()
  })
})

describe('CerrarTurno · mesas que quedan no cobradas (T-45)', () => {
  beforeEach(() => {
    listOrdenesDelTurno.mockResolvedValue([
      { id: 'o1', status: 'PENDING', mesa_id: 'm2', total: 4400 },
      { id: 'o2', status: 'PENDING', mesa_id: null, total: 1500 },
    ])
    listMesas.mockResolvedValue([{ id: 'm2', name: 'Mesa 2' }])
  })

  it('antes de cerrar avisa qué mesas quedarán no cobradas y su total; no bloquea el cierre', async () => {
    montar()
    const aviso = await screen.findByRole('note', { name: 'Mesas que quedarán no cobradas' })
    expect(aviso).toHaveTextContent('Mesa 2')
    expect(aviso).toHaveTextContent('Total sin cobrar: $4.400')
    expect(screen.getByText(/pedido de mostrador sin cobrar/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cerrar turno/ })).toBeEnabled()
  })

  it('después de cerrar ofrece ir a «Mesas no cobradas»', async () => {
    const user = userEvent.setup()
    const onCerrado = vi.fn()
    montar({ onCerrado })
    await screen.findByRole('note', { name: 'Mesas que quedarán no cobradas' })
    await contar(user, CUADRA)
    await cerrarTurno(user)
    const enlace = await screen.findByRole('link', { name: 'Ver mesas no cobradas' })
    expect(enlace).toHaveAttribute('href', '/local/loc-1/administrativo/no-cobradas')
    expect(screen.getByRole('status')).toHaveTextContent('Una mesa quedó como «no cobrada» por $4.400')
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onCerrado).toHaveBeenCalled()
  })

  it('el 409 (pedido de mostrador reciente o cobro con tarjeta) se muestra y no se cierra', async () => {
    const user = userEvent.setup()
    const onCerrado = vi.fn()
    closeCaja.mockRejectedValue(Object.assign(new Error('409: No se puede cerrar la caja: hay órdenes en curso contra ella'), { status: 409 }))
    montar({ onCerrado })
    await screen.findByRole('note', { name: 'Mesas que quedarán no cobradas' })
    await contar(user, CUADRA)
    await cerrarTurno(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(/pedido de mostrador reciente o un cobro con tarjeta/)
    expect(onCerrado).not.toHaveBeenCalled()
  })
})

describe('CerrarTurno · comprobante del cierre', () => {
  const cerrarContando = async (user, cantidades = CUADRA, extra = {}) => {
    const props = { onCierreRegistrado: vi.fn(), onCerrado: vi.fn(), ...extra }
    montar(props)
    await listo()
    await contar(user, cantidades)
    await cerrarTurno(user)
    await screen.findByRole('button', { name: 'Imprimir comprobante' })
    return props
  }

  it('al cerrar avisa el cierre y ofrece imprimir, descargar y terminar; no cierra la pantalla sola', async () => {
    const user = userEvent.setup()
    const { onCierreRegistrado, onCerrado } = await cerrarContando(user)
    expect(onCierreRegistrado).toHaveBeenCalledTimes(1)
    expect(onCerrado).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Turno cerrado. Contado $8.900: Cuadra.')
    expect(screen.getByRole('button', { name: 'Descargar comprobante' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onCerrado).toHaveBeenCalledTimes(1)
  })

  it('imprime el comprobante con caja, local, fecha, quién cerró, resumen, desglose, diferencia y nota', async () => {
    const user = userEvent.setup()
    montar()
    await listo()
    await contar(user, { 5000: 1, 2000: 1, 1000: 1, 100: 6 }) // 8.600: faltan $300, la nota es obligatoria
    await user.type(screen.getByLabelText(/Nota \(obligatoria/), 'Vuelto mal dado')
    await cerrarTurno(user)
    await user.click(await screen.findByRole('button', { name: 'Imprimir comprobante' }))

    expect(imprimirEnNavegador).toHaveBeenCalledTimes(1)
    const html = imprimirEnNavegador.mock.calls[0][0]
    for (const texto of [
      'CIERRE DE CAJA', 'Sucursal Centro', 'Caja Principal', '17/10/2026 18:30', 'Centro Admin', 'Beto Soto',
      'Fondo inicial', 'Ventas en efectivo', 'Ventas con tarjeta', 'Ventas por transferencia', 'Ingresos de caja', 'Retiros y gastos',
      'Efectivo esperado', '$8.900', 'Efectivo contado', '$8.600', 'Faltan $300', 'Nota: Vuelto mal dado',
      '1 × $5.000', '1 × $2.000', '1 × $1.000', '6 × $100',
    ]) {
      expect(html).toContain(texto)
    }
  })

  it('descarga el comprobante con un nombre que lleva la caja y el día', async () => {
    const user = userEvent.setup()
    await cerrarContando(user)
    await user.click(screen.getByRole('button', { name: 'Descargar comprobante' }))
    expect(descargarComprobante).toHaveBeenCalledTimes(1)
    const [html, nombre] = descargarComprobante.mock.calls[0]
    expect(nombre).toBe('comprobante-cierre-caja-principal-2026-10-17.html')
    expect(html).toContain('CIERRE DE CAJA')
  })

  it('el comprobante de una caja digital dice que se cerró sin contar efectivo', async () => {
    const user = userEvent.setup()
    montar({ cajaFisica: DIGITAL })
    await listo()
    await cerrarTurno(user)
    await user.click(await screen.findByRole('button', { name: 'Imprimir comprobante' }))
    const html = imprimirEnNavegador.mock.calls[0][0]
    expect(html).toContain('Caja Digital')
    expect(html).toContain('Caja digital: se cerró sin contar efectivo.')
    expect(html).not.toContain('Efectivo contado')
  })

  it('manda sobre lo calculado en pantalla lo que el backend dejó guardado', async () => {
    const user = userEvent.setup()
    closeCaja.mockResolvedValue({
      id: 'c1', status: 'closed', closed_at: '2026-10-17T21:30:00Z', efectivo_esperado_cierre: '8950.00', diferencia: '-50.00',
    })
    await cerrarContando(user)
    await user.click(screen.getByRole('button', { name: 'Imprimir comprobante' }))
    const html = imprimirEnNavegador.mock.calls[0][0]
    expect(html).toContain('$8.950')
    expect(html).toContain('Faltan $50')
  })
})
