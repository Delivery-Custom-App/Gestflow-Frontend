/**
 * La barra del turno, solo en la vista del vendedor. El vendedor no cierra la
 * caja (A-03: el backend le responde 403). La máquina del turno sigue el contrato de
 * la sección 5b (T-71): la elegida en restaurante, la de la caja en al paso, y
 * se puede cambiar desde aquí.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import TurnoVendedorBarra from './TurnoVendedorBarra'
import { TurnoVendedorContext } from '../../context/turnoVendedor'
import { getCaja, terminarTurno } from '../../lib/salesApi'
import { elegirMaquinaDelTurno, listarMaquinasDelLocal, mapMaquina } from '../../lib/maquinasCobro'
import { V2_FEATURES } from '../../lib/v2Features'

const sesion = vi.hoisted(() => ({ modelo: 'RESTAURANT' }))

vi.mock('../../lib/salesApi', () => ({ getCaja: vi.fn(), terminarTurno: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'yo', local_sales_model: sesion.modelo } }),
}))
vi.mock('../../lib/maquinasCobro', async (importOriginal) => ({
  ...(await importOriginal()),
  listarMaquinasDelLocal: vi.fn(),
  elegirMaquinaDelTurno: vi.fn(),
}))

const TURNO = {
  id: 'turno-1', local_id: 'loc-1', caja_fisica_id: 'cf-1', opened_at: '2026-10-04T12:05:00',
  pos_machine_id: 'm-1', pos_machine_released_at: null,
}
const maquina = (extra) => mapMaquina({ provider: 'mercadopago', is_active: true, ocupacion: 1, usuarios: ['Yo'], ...extra })
const BARRA = maquina({ id: 'm-1', display_name: 'Point barra' })
const TERRAZA = maquina({ id: 'm-2', display_name: 'Point terraza', ocupacion: 0, usuarios: [] })
const DE_LA_CAJA = maquina({ id: 'm-3', display_name: 'Point mostrador', caja_fisica_id: 'cf-1', ocupacion: 0, usuarios: [] })
const original = { ...V2_FEATURES }

function montar(valor) {
  return render(
    <TurnoVendedorContext.Provider value={valor}>
      <TurnoVendedorBarra />
    </TurnoVendedorContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sesion.modelo = 'RESTAURANT'
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  listarMaquinasDelLocal.mockResolvedValue([BARRA, TERRAZA])
  getCaja.mockResolvedValue(TURNO)
})
afterEach(() => {
  Object.assign(V2_FEATURES, original)
  vi.restoreAllMocks()
})

describe('TurnoVendedorBarra', () => {
  it('fuera de la vista del vendedor no muestra nada', () => {
    const { container } = render(<TurnoVendedorBarra />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra que su turno está abierto y desde qué hora', () => {
    montar({ turno: TURNO, alCerrar: vi.fn() })
    expect(screen.getByText(/Turno abierto desde las 12:05/)).toBeInTheDocument()
  })

  it('A-03: el vendedor no tiene «Cerrar turno» (la caja la cierra el administrador)', () => {
    montar({ turno: TURNO, alCerrar: vi.fn() })
    expect(screen.queryByRole('button', { name: /Cerrar turno/ })).not.toBeInTheDocument()
    expect(V2_FEATURES).not.toHaveProperty('cierreTurnoVendedor')
  })
})

describe('TurnoVendedorBarra · máquina del turno (T-71)', () => {
  it('restaurante: muestra la máquina que eligió y su proveedor, leyendo el turno y las máquinas del local', async () => {
    montar({ turno: TURNO, alCerrar: vi.fn() })
    expect(await screen.findByText(/Point barra · Mercado Pago/)).toBeInTheDocument()
    expect(getCaja).toHaveBeenCalledWith('turno-1')
    expect(listarMaquinasDelLocal).toHaveBeenCalledWith('loc-1')
    expect(screen.queryByText(/Point terraza/)).not.toBeInTheDocument()
  })

  it('compartida con otra persona lo indica', async () => {
    listarMaquinasDelLocal.mockResolvedValue([maquina({ id: 'm-1', display_name: 'Point barra', ocupacion: 2, usuarios: ['Yo', 'Ana'] })])
    montar({ turno: TURNO, alCerrar: vi.fn() })
    expect(await screen.findByText(/Point barra · Mercado Pago · compartida/)).toBeInTheDocument()
  })

  it('si el administrador le liberó la máquina, avisa que solo cobra sin tarjeta y ofrece elegir otra', async () => {
    getCaja.mockResolvedValue({ ...TURNO, pos_machine_released_at: '2026-10-14T13:00:00Z' })
    montar({ turno: TURNO, alCerrar: vi.fn() })
    expect(await screen.findByText('Te liberaron la máquina: solo cobros sin tarjeta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elegir máquina' })).toBeInTheDocument()
  })

  it('"Cambiar máquina" abre la lista y cambia con PUT /cajas/{id}/maquina', async () => {
    elegirMaquinaDelTurno.mockResolvedValue({ ...TURNO, pos_machine_id: 'm-2' })
    const user = userEvent.setup()
    montar({ turno: TURNO, alCerrar: vi.fn() })

    await user.click(await screen.findByRole('button', { name: 'Cambiar máquina' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Cambiar de máquina' })
    expect(within(dialogo).getByRole('radio', { name: 'Point barra · Tu máquina' })).toBeDisabled()
    await user.click(within(dialogo).getByRole('button', { name: 'Usar esta máquina' }))

    expect(elegirMaquinaDelTurno).toHaveBeenCalledWith('turno-1', 'm-2', { compartir: false })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toast.success).toHaveBeenCalledWith('Cobrarás con Point terraza')
  })

  it('al paso: muestra la máquina de su caja física y no ofrece cambiarla', async () => {
    sesion.modelo = 'AL_PASO'
    listarMaquinasDelLocal.mockResolvedValue([DE_LA_CAJA])
    getCaja.mockResolvedValue({ ...TURNO, pos_machine_id: null })
    montar({ turno: { ...TURNO, pos_machine_id: null }, alCerrar: vi.fn() })

    expect(await screen.findByText(/Point mostrador · Mercado Pago/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /máquina/ })).not.toBeInTheDocument()
  })

  it('con la bandera apagada muestra la máquina pero no deja cambiarla', async () => {
    V2_FEATURES.eleccionMaquinaVendedor = false
    montar({ turno: TURNO, alCerrar: vi.fn() })
    expect(await screen.findByText(/Point barra/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar máquina' })).not.toBeInTheDocument()
  })

  it('se actualiza sola al volver a la pestaña', async () => {
    montar({ turno: TURNO, alCerrar: vi.fn() })
    await screen.findByText(/Point barra/)
    getCaja.mockResolvedValue({ ...TURNO, pos_machine_released_at: '2026-10-14T13:00:00Z' })
    window.dispatchEvent(new Event('focus'))
    expect(await screen.findByText('Te liberaron la máquina: solo cobros sin tarjeta')).toBeInTheDocument()
  })

  it('si no se pueden consultar las máquinas, no afirma nada', async () => {
    listarMaquinasDelLocal.mockRejectedValue(new Error('500'))
    montar({ turno: TURNO, alCerrar: vi.fn() })
    await waitFor(() => expect(listarMaquinasDelLocal).toHaveBeenCalled())
    expect(screen.queryByText(/máquina/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Turno abierto/)).toBeInTheDocument()
  })
})

describe('TurnoVendedorBarra · terminar mi turno (T-41)', () => {
  it('muestra el recordatorio y «Terminar mi turno»', () => {
    montar({ turno: TURNO, alCerrar: vi.fn(), alTerminar: vi.fn() })
    expect(screen.getByTestId('recordatorio-terminar')).toHaveTextContent('Al terminar tu jornada, termina tu turno')
    expect(screen.getByRole('button', { name: /Terminar mi turno/ })).toBeInTheDocument()
  })

  it('confirma, llama a terminar-turno y avisa a la vista', async () => {
    const user = userEvent.setup()
    const alTerminar = vi.fn()
    terminarTurno.mockResolvedValue({ ...TURNO, turno_terminado_at: '2026-10-04T20:00:00Z', turno_terminado_forzado: false })
    montar({ turno: TURNO, alCerrar: vi.fn(), alTerminar })

    await user.click(screen.getByRole('button', { name: /Terminar mi turno/ }))
    const dialogo = screen.getByRole('dialog', { name: '¿Terminar tu turno?' })
    expect(dialogo).toHaveTextContent(/la cuenta y la cierra el administrador/)
    await user.click(within(dialogo).getByRole('button', { name: 'Terminar turno' }))

    expect(terminarTurno).toHaveBeenCalledWith('turno-1')
    await waitFor(() => expect(alTerminar).toHaveBeenCalledWith(expect.objectContaining({ turno_terminado_at: '2026-10-04T20:00:00Z' })))
    expect(toast.success).toHaveBeenCalledWith('Terminaste tu turno')
  })

  it('con mesas abiertas (409) muestra el detail y no termina', async () => {
    const user = userEvent.setup()
    const alTerminar = vi.fn()
    terminarTurno.mockRejectedValue(Object.assign(new Error('409: x'), {
      status: 409, detail: 'Tienes 1 mesa(s) o pedido(s) abiertos: cóbralos o pídele al administrador que los reasigne antes de terminar el turno',
    }))
    montar({ turno: TURNO, alCerrar: vi.fn(), alTerminar })
    await user.click(screen.getByRole('button', { name: /Terminar mi turno/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Terminar turno' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cóbralos o pídele al administrador que los reasigne/)
    expect(alTerminar).not.toHaveBeenCalled()
  })

  it('si el administrador le terminó el turno, al revisarlo se avisa a la vista', async () => {
    const alTerminar = vi.fn()
    getCaja.mockResolvedValue({ ...TURNO, turno_terminado_at: '2026-10-04T18:00:00Z', turno_terminado_forzado: true, turno_terminado_motivo: 'Se retiró por una emergencia' })
    montar({ turno: TURNO, alCerrar: vi.fn(), alTerminar })
    await waitFor(() => expect(alTerminar).toHaveBeenCalledWith(expect.objectContaining({ turno_terminado_forzado: true })))
  })
})
