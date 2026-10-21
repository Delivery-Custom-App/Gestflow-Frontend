/** La caja física manda (#133 y #140): abrir, cerrar en dos pasos, retiros e ingresos y máquinas. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AbrirCajaFisica from './AbrirCajaFisica'
import CerrarCajaFisica from './CerrarCajaFisica'
import MovimientoCajaFisica from './MovimientoCajaFisica'
import AperturaCierreCajas from './AperturaCierreCajas'
import MaquinasDeLasCajas from './MaquinasDeLasCajas'
import HistorialAperturas from './HistorialAperturas'
import RegistroAperturas from './RegistroAperturas'
import IniciarMiTurno from './IniciarMiTurno'
import ResumenDelDiaCajas from './ResumenDelDiaCajas'
import { MemoryRouter } from 'react-router'
import { createCajaV2 } from '../../lib/salesApi'
import {
  abrirCajaFisica, aperturasDelLocal, resumenesDeHoy, asignarCajaAMaquina, cerrarCajaFisica, listarAperturas, listarCajasFisicasDelLocal, registrarMovimientoCajaFisica, resumenDeApertura, revisarCierreCajaFisica,
} from '../../lib/cajaFisica'
import { forzarTermino } from '../../lib/supervision'
import { listarMaquinasDelLocal } from '../../lib/maquinasCobro'

vi.mock('../../lib/cajaFisica', async (importOriginal) => ({
  ...(await importOriginal()),
  abrirCajaFisica: vi.fn(),
  revisarCierreCajaFisica: vi.fn(),
  cerrarCajaFisica: vi.fn(),
  resumenDeApertura: vi.fn(),
  registrarMovimientoCajaFisica: vi.fn(),
  listarAperturas: vi.fn(() => Promise.resolve({ aperturas: [], total: 0 })),
  asignarCajaAMaquina: vi.fn(),
  aperturasDelLocal: vi.fn(),
  listarCajasFisicasDelLocal: vi.fn(),
  resumenesDeHoy: vi.fn(),
}))
vi.mock('../../lib/salesApi', async (importOriginal) => ({ ...(await importOriginal()), createCajaV2: vi.fn() }))
vi.mock('../../lib/supervision', async (importOriginal) => ({ ...(await importOriginal()), forzarTermino: vi.fn() }))
vi.mock('../../lib/maquinasCobro', async (importOriginal) => ({ ...(await importOriginal()), listarMaquinasDelLocal: vi.fn() }))

const err = (status, detail) => Object.assign(new Error(`${status}: ${detail}`), { status, detail })
const CAJA = { id: 'cf-1', name: 'Caja principal', is_active: true, abierta: false, ultimo_cierre: null }
const CERRADA_CON_50 = { ...CAJA, ultimo_cierre: { monto_cierre_declarado: '50000.00', cerrada_at: '2026-10-20T23:00:00Z', cerrada_por_email: 'encargado@demo' } }

beforeEach(() => { vi.clearAllMocks() })

describe('AbrirCajaFisica', () => {
  it('la primera apertura no compara; contar abre con el desglose', async () => {
    abrirCajaFisica.mockResolvedValue({ id: 'ap-1', monto_apertura: '50000.00' })
    const onAbierta = vi.fn()
    const user = userEvent.setup()
    render(<AbrirCajaFisica caja={CAJA} localNombre="Sucursal Centro" onClose={() => {}} onAbierta={onAbierta} />)
    expect(screen.getByText(/primera apertura de esta caja/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Cantidad de billetes de $20.000'), '2')
    await user.type(screen.getByLabelText('Cantidad de billetes de $10.000'), '1')
    await user.click(screen.getByRole('button', { name: 'Abrir caja' }))
    expect(abrirCajaFisica).toHaveBeenCalledWith('cf-1', { cantidades: { 20000: 2, 10000: 1 }, nota: '' })
    expect(onAbierta).toHaveBeenCalledWith({ id: 'ap-1', monto_apertura: '50000.00' })
  })

  it('compara con el último cierre (quién y cuánto) y exige nota si no coincide', async () => {
    abrirCajaFisica.mockResolvedValue({ id: 'ap-2' })
    const user = userEvent.setup()
    render(<AbrirCajaFisica caja={CERRADA_CON_50} onClose={() => {}} onAbierta={() => {}} />)
    const nota = screen.getByRole('note', { name: 'Último cierre de la caja' })
    expect(nota).toHaveTextContent('encargado@demo contó $50.000')

    await user.type(screen.getByLabelText('Cantidad de billetes de $20.000'), '2')
    expect(screen.getByTestId('apertura-vs-cierre')).toHaveTextContent('Faltan $10.000 respecto del último cierre')
    expect(screen.getByLabelText('Nota (obligatoria: explica la diferencia)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Abrir caja' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/explica la diferencia en la nota/)
    expect(abrirCajaFisica).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Nota/), 'Se depositó en el banco')
    await user.click(screen.getByRole('button', { name: 'Abrir caja' }))
    expect(abrirCajaFisica).toHaveBeenCalledWith('cf-1', { cantidades: { 20000: 2 }, nota: 'Se depositó en el banco' })
  })

  it('si coincide no pide nota', async () => {
    const user = userEvent.setup()
    render(<AbrirCajaFisica caja={CERRADA_CON_50} onClose={() => {}} onAbierta={() => {}} />)
    await user.type(screen.getByLabelText('Cantidad de billetes de $10.000'), '5')
    expect(screen.getByTestId('apertura-vs-cierre')).toHaveTextContent('Coincide con el último cierre')
    expect(screen.getByLabelText('Nota (opcional)')).toBeInTheDocument()
  })

  it('en $0 pide confirmar; el 422 del backend se muestra en palabras', async () => {
    abrirCajaFisica.mockRejectedValue(err(422, 'Contaste $0 y el último cierre de esta caja dejó $50.000: explica la diferencia en nota_apertura'))
    const user = userEvent.setup()
    render(<AbrirCajaFisica caja={CAJA} onClose={() => {}} onAbierta={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Abrir caja' }))
    expect(screen.getByRole('alertdialog', { name: '¿Abrir la caja sin efectivo?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sí, abrir sin efectivo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('explica la diferencia en la nota')
  })
})

describe('CerrarCajaFisica', () => {
  const REVISION = {
    apertura_id: 'ap-1',
    pedidos_abiertos: [{ order_id: 'o-1', mesa: 'Mesa 4', email: 'ana@demo', total: '12500.00' }],
    cobro_en_curso: false,
    turnos_abiertos: [{ caja_id: 't-1', email: 'luis@demo' }],
    puede_contar: false,
  }

  it('primero revisa: pedidos que quedarán no cobrados, cobro y empleados en turno; sin poder contar todavía', async () => {
    revisarCierreCajaFisica.mockResolvedValue(REVISION)
    render(<CerrarCajaFisica caja={{ ...CAJA, abierta: true }} onClose={() => {}} />)
    const pedidos = await screen.findByRole('region', { name: 'Pedidos que quedarán no cobrados' })
    expect(pedidos).toHaveTextContent('Mesa 4 · ana@demo')
    expect(pedidos).toHaveTextContent('$12.500')
    expect(screen.getByRole('region', { name: 'Cobro con tarjeta en curso' })).toHaveTextContent('No hay cobros en curso')
    expect(screen.getByRole('region', { name: 'Empleados en turno' })).toHaveTextContent('luis@demo sigue en turno')
    expect(screen.getByRole('button', { name: 'Contar el efectivo' })).toBeDisabled()
    expect(cerrarCajaFisica).not.toHaveBeenCalled()
  })

  it('termina el turno del empleado (cerrando su sesión, sin reasignar) y vuelve a revisar', async () => {
    revisarCierreCajaFisica.mockResolvedValueOnce(REVISION).mockResolvedValueOnce({ ...REVISION, turnos_abiertos: [], puede_contar: true })
    forzarTermino.mockResolvedValue({})
    const user = userEvent.setup()
    render(<CerrarCajaFisica caja={{ ...CAJA, abierta: true }} onClose={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Terminar el turno de luis@demo' }))
    await user.type(screen.getByLabelText('Motivo'), 'Cierre de caja')
    await user.click(screen.getByRole('button', { name: 'Terminar turno' }))
    expect(forzarTermino).toHaveBeenCalledWith('t-1', { motivo: 'Cierre de caja', cerrarSesion: true, paraCerrarLaCaja: true })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Contar el efectivo' })).toBeEnabled())
    expect(revisarCierreCajaFisica).toHaveBeenCalledTimes(2)
  })

  it('con un cobro en curso avisa que hay que esperar', async () => {
    revisarCierreCajaFisica.mockResolvedValue({ ...REVISION, pedidos_abiertos: [], turnos_abiertos: [], cobro_en_curso: true, puede_contar: false })
    render(<CerrarCajaFisica caja={{ ...CAJA, abierta: true }} onClose={() => {}} />)
    expect(await screen.findByRole('region', { name: 'Cobro con tarjeta en curso' })).toHaveTextContent(/el cliente puede estar pagando/)
  })

  it('cuenta a ciegas; si no cuadra pide la nota; al cerrar muestra el resumen y el comprobante', async () => {
    revisarCierreCajaFisica.mockResolvedValue({ ...REVISION, pedidos_abiertos: [], turnos_abiertos: [], puede_contar: true })
    cerrarCajaFisica
      .mockRejectedValueOnce(err(422, 'Contaste $40.000 y debería haber $50.000 en la caja (diferencia de -$10.000): explícala en nota_cierre'))
      .mockResolvedValueOnce({ id: 'ap-1', cerrada_at: '2026-10-21T23:00:00Z', cerrada_por_email: 'encargado@demo', nota_cierre: 'Faltó' })
    resumenDeApertura.mockResolvedValue({ fondo: '50000.00', ventas_por_medio: { efectivo: '0', tarjeta: '0', transferencia: '0', otros: '0' }, total_ingresos_manuales: '0', total_retiros: '0', efectivo_esperado: '50000.00', monto_cierre_declarado: '40000.00', diferencia: '-10000.00' })
    const onCerrada = vi.fn()
    const user = userEvent.setup()
    render(<CerrarCajaFisica caja={{ ...CAJA, abierta: true }} onClose={() => {}} onCerrada={onCerrada} />)
    await user.click(await screen.findByRole('button', { name: 'Contar el efectivo' }))
    // El conteo es a ciegas: no se muestra lo esperado antes de contar.
    expect(screen.queryByText(/debería haber/)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Cantidad de billetes de $20.000'), '2')
    await user.click(screen.getByRole('button', { name: 'Cerrar caja con $40.000' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('debería haber $50.000')
    expect(screen.getByLabelText('Nota (obligatoria: explica la diferencia)')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nota/), 'Faltó')
    await user.click(screen.getByRole('button', { name: 'Cerrar caja con $40.000' }))
    expect(cerrarCajaFisica).toHaveBeenLastCalledWith('cf-1', { cantidades: { 20000: 2 }, nota: 'Faltó' })
    expect(await screen.findByRole('status')).toHaveTextContent('Caja cerrada')
    expect(onCerrada).toHaveBeenCalled()
    expect(await screen.findByTestId('resumen-diferencia')).toHaveTextContent('Faltan $10.000')
    expect(screen.getByTestId('resumen-retiros').previousSibling).toHaveTextContent('Retiros')
    expect(screen.getByRole('button', { name: 'Descargar comprobante' })).toBeInTheDocument()
  })

  it('un 409 al cerrar (algo cambió) vuelve a la revisión', async () => {
    revisarCierreCajaFisica.mockResolvedValue({ ...REVISION, pedidos_abiertos: [], turnos_abiertos: [], puede_contar: true })
    cerrarCajaFisica.mockRejectedValue(err(409, 'Hay un cobro con tarjeta en curso'))
    const user = userEvent.setup()
    render(<CerrarCajaFisica caja={{ ...CAJA, abierta: true }} onClose={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Contar el efectivo' }))
    await user.click(screen.getByRole('button', { name: /Cerrar caja con/ }))
    expect(await screen.findByText('Hay un cobro con tarjeta en curso')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Contar el efectivo' })).toBeInTheDocument()
  })
})

describe('MovimientoCajaFisica', () => {
  it('un retiro pide a dónde fue la plata; se registra en la caja física', async () => {
    registrarMovimientoCajaFisica.mockResolvedValue({})
    const onRegistrado = vi.fn()
    const user = userEvent.setup()
    render(<MovimientoCajaFisica caja={CAJA} onClose={() => {}} onRegistrado={onRegistrado} />)
    expect(screen.queryByRole('option', { name: /gasto/i })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Monto'), '20.000')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/a dónde fue la plata/)
    await user.type(screen.getByLabelText('A dónde fue la plata'), 'Depósito')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(registrarMovimientoCajaFisica).toHaveBeenCalledWith('cf-1', { tipo: 'egreso', monto: 20000, note: 'Depósito', paymentMethod: 'cash' })
    expect(onRegistrado).toHaveBeenCalledWith({ tipo: 'egreso', monto: 20000 })
  })
})

describe('AperturaCierreCajas', () => {
  const CAJAS = [
    { id: 'cf-1', name: 'Caja principal', is_active: true, abierta: true, apertura_actual: { abierta_at: '2026-10-21T12:00:00Z', abierta_por_email: 'encargado@demo', monto_apertura: '50000.00' } },
    { ...CERRADA_CON_50, id: 'cf-2', name: 'Caja terraza' },
    { id: 'cf-3', name: 'Archivada', is_active: false, abierta: false },
  ]

  it('muestra el estado de cada caja activa y lo que se puede hacer', () => {
    render(<AperturaCierreCajas cajasFisicas={CAJAS} puedeGestionar />)
    const items = within(screen.getByRole('list', { name: 'Cajas del local' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Abierta')
    expect(items[0]).toHaveTextContent('por encargado@demo · fondo $50.000')
    expect(within(items[0]).getByRole('button', { name: 'Cerrar Caja principal' })).toBeInTheDocument()
    expect(within(items[0]).getByRole('button', { name: 'Retiro o ingreso en Caja principal' })).toBeInTheDocument()
    expect(items[1]).toHaveTextContent('Último cierre: $50.000')
    // Abierta en verde y cerrada en rojo.
    expect(within(items[0]).getByText('Abierta')).toHaveClass('text-[hsl(149,60%,28%)]')
    expect(within(items[1]).getByText('Cerrada')).toHaveClass('text-[hsl(354,70%,36%)]')
    expect(within(items[1]).getByRole('button', { name: 'Abrir Caja terraza' })).toBeInTheDocument()
  })

  it('sin permiso solo muestra el estado', () => {
    render(<AperturaCierreCajas cajasFisicas={CAJAS} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('abrir una caja abre la ventana y, al terminar, avisa y refresca', async () => {
    abrirCajaFisica.mockResolvedValue({ id: 'ap-9', monto_apertura: '50000.00' })
    const onCambio = vi.fn()
    const user = userEvent.setup()
    render(<AperturaCierreCajas cajasFisicas={CAJAS} puedeGestionar onCambio={onCambio} />)
    await user.click(screen.getByRole('button', { name: 'Abrir Caja terraza' }))
    await user.type(screen.getByLabelText('Cantidad de billetes de $10.000'), '5')
    await user.click(screen.getByRole('button', { name: 'Abrir caja' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Caja terraza quedó abierta con $50.000')
    expect(onCambio).toHaveBeenCalled()
  })
})

describe('MaquinasDeLasCajas (#140)', () => {
  const CAJAS = [
    { id: 'cf-1', name: 'Caja principal', is_active: true },
    { id: 'cf-9', name: 'Archivada', is_active: false },
  ]

  it('dice qué máquina no tiene caja y le asigna una, solo entre las activas', async () => {
    listarMaquinasDelLocal.mockResolvedValue([
      { id: 'pm-1', nombre: 'Point barra', cajaFisicaId: null, estado: 'libre', usuarios: [] },
      { id: 'pm-2', nombre: 'Point terraza', cajaFisicaId: 'cf-1', estado: 'libre', usuarios: [] },
    ])
    asignarCajaAMaquina.mockResolvedValue({})
    const user = userEvent.setup()
    render(<MaquinasDeLasCajas localId="loc-1" cajasFisicas={CAJAS} puedeGestionar />)
    const [barra, terraza] = within(await screen.findByRole('list', { name: 'Máquinas POS del local' })).getAllByRole('listitem')
    expect(barra).toHaveTextContent('Sin caja: no se puede elegir para un turno')
    expect(terraza).toHaveTextContent('En Caja principal')
    const select = screen.getByLabelText('Caja de Point barra')
    expect(within(select).queryByRole('option', { name: 'Archivada' })).not.toBeInTheDocument()
    await user.selectOptions(select, 'cf-1')
    expect(asignarCajaAMaquina).toHaveBeenCalledWith('pm-1', 'cf-1')
    expect(await screen.findByRole('status')).toHaveTextContent('Point barra quedó en Caja principal')
  })
})

describe('los turnos trabajados en cada apertura', () => {
  const TURNOS = [
    { caja_id: 't-1', cashier_user_id: 'u-ana', status: 'closed', opened_at: '2026-10-21T12:00:00Z', turno_terminado_at: '2026-10-21T18:00:00Z', total_vendido: '45000.00' },
    { caja_id: 't-2', cashier_user_id: 'u-luis', status: 'open', opened_at: '2026-10-21T13:00:00Z', turno_terminado_at: null, total_vendido: '12000.00' },
  ]
  const nombreDe = (id) => ({ 'u-ana': 'Ana Rojas', 'u-luis': 'Luis Soto' }[id])

  it('al cerrar la caja se ven los turnos que se trabajaron, con quién y cuánto vendió', async () => {
    revisarCierreCajaFisica.mockResolvedValue({ pedidos_abiertos: [], cobro_en_curso: false, turnos_abiertos: [], puede_contar: true })
    cerrarCajaFisica.mockResolvedValue({ id: 'ap-1', cerrada_at: '2026-10-21T23:00:00Z' })
    resumenDeApertura.mockResolvedValue({ fondo: '0', efectivo_esperado: '0', turnos: TURNOS })
    const user = userEvent.setup()
    render(<CerrarCajaFisica caja={{ ...CAJA, abierta: true }} nombreDe={nombreDe} onClose={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Contar el efectivo' }))
    await user.click(screen.getByRole('button', { name: /Cerrar caja con/ }))
    const turnos = within(await screen.findByRole('region', { name: 'Turnos de esta apertura' })).getAllByRole('listitem')
    expect(turnos[0]).toHaveTextContent('Ana Rojas')
    expect(turnos[0]).toHaveTextContent('Vendió $45.000')
    expect(turnos[1]).toHaveTextContent('Luis Soto')
    expect(turnos[1]).toHaveTextContent('en turno')
  })

  it('en el historial, «Ver turnos» muestra los de esa apertura', async () => {
    listarAperturas.mockResolvedValueOnce({ aperturas: [{ id: 'ap-1', status: 'closed', abierta_por_email: 'enc@demo', monto_apertura: '0', abierta_at: '2026-10-21T11:00:00Z' }], total: 1 })
    resumenDeApertura.mockResolvedValue({ turnos: TURNOS })
    const user = userEvent.setup()
    render(<HistorialAperturas caja={CAJA} nombreDe={nombreDe} onClose={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Ver turnos' }))
    expect(resumenDeApertura).toHaveBeenCalledWith('ap-1')
    const lista = await screen.findByRole('list', { name: 'Turnos trabajados' })
    expect(lista).toHaveTextContent('Ana Rojas')
    expect(lista).toHaveTextContent('Luis Soto')
  })

  it('una apertura sin turnos lo dice', async () => {
    listarAperturas.mockResolvedValueOnce({ aperturas: [{ id: 'ap-2', status: 'open', monto_apertura: '0', abierta_at: '2026-10-21T11:00:00Z' }], total: 1 })
    resumenDeApertura.mockResolvedValue({ turnos: [] })
    const user = userEvent.setup()
    render(<HistorialAperturas caja={CAJA} onClose={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Ver turnos' }))
    expect(await screen.findByText('No se trabajaron turnos en esta apertura.')).toBeInTheDocument()
  })
})

describe('RegistroAperturas · aperturas y cierres de todas las cajas', () => {
  const APERTURAS = [
    { id: 'ap-2', cajaNombre: 'Caja terraza', status: 'open', abierta_at: '2026-10-21T12:00:00Z', abierta_por_email: 'enc@demo', monto_apertura: '30000.00' },
    { id: 'ap-1', cajaNombre: 'Caja principal', status: 'closed', abierta_at: '2026-10-21T09:00:00Z', abierta_por_email: 'admin@demo', monto_apertura: '50000.00',
      cerrada_at: '2026-10-21T18:00:00Z', cerrada_por_email: 'admin@demo', monto_cierre_declarado: '49000.00', efectivo_esperado_cierre: '50000.00', diferencia_cierre: '-1000.00', nota_cierre: 'Faltó cambio' },
  ]

  it('lista cada apertura con su estado en color, el fondo y el cierre', async () => {
    aperturasDelLocal.mockResolvedValue(APERTURAS)
    render(<RegistroAperturas cajasFisicas={[{ id: 'cf-1' }, { id: 'cf-2' }]} />)
    const [abierta, cerrada] = within(await screen.findByRole('list', { name: 'Apertura de caja' })).getAllByRole('listitem')
    expect(abierta).toHaveTextContent('Caja terraza')
    expect(within(abierta).getByText('Abierta')).toHaveClass('text-[hsl(149,60%,28%)]')
    expect(abierta).toHaveTextContent('Abrió enc@demo')
    expect(abierta).toHaveTextContent('$30.000')
    expect(within(cerrada).getByText('Cerrada')).toHaveClass('text-[hsl(354,70%,36%)]')
    expect(cerrada).toHaveTextContent('contado $49.000 · esperado $50.000')
    expect(cerrada).toHaveTextContent('Faltan $1.000')
    expect(cerrada).toHaveTextContent('Nota: Faltó cambio')
  })

  it('dice el nombre de quien abrió y cerró, no su correo', async () => {
    aperturasDelLocal.mockResolvedValue([{ ...APERTURAS[1], abierta_por_user_id: 'u-admin', cerrada_por_user_id: 'u-enc' }])
    const nombreDe = (id) => ({ 'u-admin': 'Dueño Demo', 'u-enc': 'Encargada Centro' }[id])
    render(<RegistroAperturas cajasFisicas={[{ id: 'cf-1' }]} nombreDe={nombreDe} />)
    const fila = within(await screen.findByRole('list', { name: 'Apertura de caja' })).getByRole('listitem')
    expect(fila).toHaveTextContent('Abrió Dueño Demo')
    expect(fila).toHaveTextContent('Cerró Encargada Centro')
    expect(fila).not.toHaveTextContent('admin@demo')
  })

  it('vuelve a pedir la lista cuando se abre o se cierra una caja', async () => {
    aperturasDelLocal.mockResolvedValue([])
    const { rerender } = render(<RegistroAperturas cajasFisicas={[{ id: 'cf-1' }]} version={0} />)
    expect(await screen.findByText('Todavía no se ha abierto ninguna caja en este local.')).toBeInTheDocument()
    aperturasDelLocal.mockResolvedValue(APERTURAS)
    rerender(<RegistroAperturas cajasFisicas={[{ id: 'cf-1' }]} version={1} />)
    expect(await screen.findByRole('list', { name: 'Apertura de caja' })).toBeInTheDocument()
    expect(aperturasDelLocal).toHaveBeenCalledTimes(2)
  })

  it('«Ver turnos» muestra los turnos de esa apertura', async () => {
    aperturasDelLocal.mockResolvedValue([APERTURAS[1]])
    resumenDeApertura.mockResolvedValue({ turnos: [{ caja_id: 't-1', cashier_user_id: 'u-ana', status: 'closed', opened_at: '2026-10-21T10:00:00Z', turno_terminado_at: '2026-10-21T17:00:00Z', total_vendido: '20000.00' }] })
    const user = userEvent.setup()
    render(<RegistroAperturas cajasFisicas={[{ id: 'cf-1' }]} nombreDe={() => 'Ana Rojas'} />)
    await user.click(await screen.findByRole('button', { name: 'Ver turnos' }))
    expect(await screen.findByRole('list', { name: 'Turnos trabajados' })).toHaveTextContent('Ana Rojas')
  })
})

describe('IniciarMiTurno · el dueño o el encargado que vende en un local al paso', () => {
  const montar = (props) => render(<MemoryRouter><IniciarMiTurno localId="loc-1" {...props} /></MemoryRouter>)

  it('con una caja abierta ofrece iniciar su turno sobre ella, sin plata', async () => {
    listarCajasFisicasDelLocal.mockResolvedValue([{ id: 'cf-1', name: 'Caja principal', is_active: true, abierta: true }, { id: 'cf-2', is_active: true, abierta: false }])
    createCajaV2.mockResolvedValue({ id: 't-1' })
    const onIniciado = vi.fn()
    const user = userEvent.setup()
    montar({ onIniciado })
    await user.click(await screen.findByRole('button', { name: 'Iniciar mi turno en Caja principal' }))
    expect(createCajaV2).toHaveBeenCalledWith({ caja_fisica_id: 'cf-1', monto_apertura: 0 })
    expect(onIniciado).toHaveBeenCalled()
  })

  it('con varias cajas abiertas pide elegir', async () => {
    listarCajasFisicasDelLocal.mockResolvedValue([{ id: 'cf-1', name: 'Caja 1', is_active: true, abierta: true }, { id: 'cf-2', name: 'Caja 2', is_active: true, abierta: true }])
    createCajaV2.mockResolvedValue({ id: 't-1' })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Iniciar mi turno' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Elige la caja')
    await user.selectOptions(screen.getByLabelText('Caja donde vas a vender'), 'cf-2')
    await user.click(screen.getByRole('button', { name: 'Iniciar mi turno' }))
    expect(createCajaV2).toHaveBeenCalledWith({ caja_fisica_id: 'cf-2', monto_apertura: 0 })
  })

  it('sin cajas abiertas dice dónde abrir una', async () => {
    listarCajasFisicasDelLocal.mockResolvedValue([{ id: 'cf-1', is_active: true, abierta: false }])
    montar()
    expect(await screen.findByRole('link', { name: 'Administración → Caja y turnos' })).toHaveAttribute('href', '/local/loc-1/administrativo/flujo-caja')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('ResumenDelDiaCajas · el día con las aperturas', () => {
  const RES = (o) => ({ fondo: '0', ventas_por_medio: { efectivo: '0', tarjeta: '0', transferencia: '0', otros: '0' }, total_vendido: '0', total_ingresos_manuales: '0', total_retiros: '0', efectivo_esperado: '0', monto_cierre_declarado: null, diferencia: null, ...o })

  it('muestra los totales del día y cada caja con su estado', async () => {
    resumenesDeHoy.mockResolvedValue([
      { apertura: { id: 'a1', status: 'closed', cajaNombre: 'Caja principal' }, resumen: RES({ fondo: '40000', total_vendido: '2500', total_ingresos_manuales: '1000', total_retiros: '5000', efectivo_esperado: '38500', monto_cierre_declarado: '20000', diferencia: '-18500' }) },
      { apertura: { id: 'a2', status: 'open', cajaNombre: 'caja' }, resumen: RES({ fondo: '0' }) },
    ])
    render(<ResumenDelDiaCajas cajasFisicas={[{ id: 'cf-1' }, { id: 'cf-2' }]} hoy="2026-10-21" />)
    expect(await screen.findByTestId('dia-fondo')).toHaveTextContent('$40.000')
    expect(screen.getByTestId('dia-esperado')).toHaveTextContent('$38.500')
    expect(screen.getByTestId('dia-retiros')).toHaveTextContent('$5.000')
    expect(screen.getByTestId('dia-contado')).toHaveTextContent('$20.000')
    expect(screen.getByTestId('dia-diferencia')).toHaveTextContent('Faltan $18.500')
    expect(screen.getByText(/2 aperturas hoy · 1 abierta · 1 cerrada/)).toBeInTheDocument()
    const [principal, otra] = within(screen.getByRole('list', { name: 'Cajas de hoy' })).getAllByRole('listitem')
    expect(principal).toHaveTextContent('Cerrada')
    expect(principal).toHaveTextContent('Contado $20.000')
    expect(otra).toHaveTextContent('Sin cerrar')
    expect(resumenesDeHoy).toHaveBeenCalledWith([{ id: 'cf-1' }, { id: 'cf-2' }], '2026-10-21')
  })

  it('sin aperturas hoy lo dice', async () => {
    resumenesDeHoy.mockResolvedValue([])
    render(<ResumenDelDiaCajas cajasFisicas={[{ id: 'cf-1' }]} hoy="2026-10-21" />)
    expect(await screen.findByText('Hoy todavía no se ha abierto ninguna caja en este local.')).toBeInTheDocument()
  })
})
