/** Supervisión de un turno abierto (T-42): liberar máquina y terminar el turno. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SupervisionTurno from './SupervisionTurno'
import { forzarTermino, liberarMaquina } from '../../lib/supervision'
import { listCajas } from '../../lib/salesApi'
import { listarMaquinasDelLocal } from '../../lib/maquinasCobro'

vi.mock('../../lib/supervision', async (importOriginal) => ({ ...(await importOriginal()), forzarTermino: vi.fn(), liberarMaquina: vi.fn() }))
vi.mock('../../lib/salesApi', () => ({ listCajas: vi.fn() }))
vi.mock('../../lib/maquinasCobro', () => ({ listarMaquinasDelLocal: vi.fn() }))
vi.mock('../../lib/fondoEmergencia', () => ({ hoyEnChile: () => '2026-10-14' }))

const TURNO = { id: 'c1', local_id: 'loc-1', cashier_user_id: 'beto', pos_machine_id: 'pm1', pos_machine_released_at: null, turno_terminado_at: null }
const USUARIOS = [
  { id: 'ana', role: 'EMPLEADO', first_name: 'Ana', last_name: 'Rojas' },
  { id: 'beto', role: 'EMPLEADO', first_name: 'Beto', last_name: 'Soto' },
]

beforeEach(() => {
  vi.clearAllMocks()
  listarMaquinasDelLocal.mockResolvedValue([{ id: 'pm1', nombre: 'Point barra' }])
  listCajas.mockResolvedValue([
    { cashier_user_id: 'ana', status: 'open', business_date: '2026-10-14', local_id: 'loc-1' },
    { cashier_user_id: 'beto', status: 'open', business_date: '2026-10-14', local_id: 'loc-1' },
  ])
  liberarMaquina.mockResolvedValue({ turnos_liberados: ['c1', 'c2'] })
  forzarTermino.mockResolvedValue({})
})

describe('SupervisionTurno', () => {
  it('liberar la máquina pide motivo e informa cuántos turnos quedaron sin máquina', async () => {
    const user = userEvent.setup()
    const onHecho = vi.fn()
    render(<SupervisionTurno turno={TURNO} usuarios={USUARIOS} onHecho={onHecho} />)
    expect(await screen.findByText('Point barra')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Liberar máquina' }))
    await user.click(screen.getByRole('button', { name: 'Liberar' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/motivo/)
    expect(liberarMaquina).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Motivo'), 'Sin batería')
    await user.click(screen.getByRole('button', { name: 'Liberar' }))
    expect(liberarMaquina).toHaveBeenCalledWith('pm1', 'Sin batería')
    expect(await screen.findByRole('status')).toHaveTextContent('Quedaron 2 turnos sin máquina')
    expect(onHecho).toHaveBeenCalled()
  })

  it('terminar el turno ofrece solo empleados con turno hoy (no al mismo) y manda el destino', async () => {
    const user = userEvent.setup()
    render(<SupervisionTurno turno={TURNO} usuarios={USUARIOS} onHecho={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Terminar este turno' }))
    const destino = screen.getByLabelText(/pasarlas a/)
    await waitFor(() => expect(within(destino).getByRole('option', { name: 'Ana Rojas' })).toBeInTheDocument())
    expect(within(destino).queryByRole('option', { name: 'Beto Soto' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Motivo'), 'Se retiró por una emergencia')
    await user.selectOptions(destino, 'ana')
    await user.click(screen.getByRole('button', { name: 'Terminar turno' }))
    expect(forzarTermino).toHaveBeenCalledWith('c1', { motivo: 'Se retiró por una emergencia', reasignarAUserId: 'ana', cerrarSesion: false })
  })

  it('el 409 sin destino pide elegir a quién pasarle las mesas', async () => {
    const user = userEvent.setup()
    forzarTermino.mockRejectedValueOnce(Object.assign(new Error('409: x'), {
      status: 409, detail: 'El turno tiene 1 mesa(s) o pedido(s) abiertos: indica a qué empleado se reasignan (reasignar_a_user_id)',
    }))
    render(<SupervisionTurno turno={TURNO} usuarios={USUARIOS} onHecho={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Terminar este turno' }))
    await user.type(screen.getByLabelText('Motivo'), 'Emergencia')
    await user.click(screen.getByRole('button', { name: 'Terminar turno' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('indica a qué empleado se reasignan.')
    expect(screen.getByLabelText('Pasar sus mesas abiertas a (obligatorio)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Terminar turno' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Elige a quién se le pasan las mesas abiertas.')
  })

  it('un turno ya terminado no ofrece terminarlo; sin máquina no ofrece liberarla', async () => {
    render(<SupervisionTurno turno={{ ...TURNO, pos_machine_id: null, turno_terminado_at: '2026-10-14T18:00:00Z' }} usuarios={USUARIOS} />)
    expect(await screen.findByText(/ya terminó/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Terminar este turno' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Liberar máquina' })).not.toBeInTheDocument()
  })
})

describe('SupervisionTurno · cerrar también su sesión (T-54)', () => {
  it('la casilla viene desmarcada; marcada manda cerrar_sesion con el mismo motivo', async () => {
    const user = userEvent.setup()
    render(<SupervisionTurno turno={TURNO} usuarios={USUARIOS} onHecho={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Terminar este turno' }))
    const casilla = screen.getByRole('checkbox', { name: /Cerrar también su sesión/ })
    expect(casilla).not.toBeChecked()
    await user.click(casilla)
    await user.type(screen.getByLabelText('Motivo'), 'Perdió el celular')
    await user.click(screen.getByRole('button', { name: 'Terminar turno' }))
    expect(forzarTermino).toHaveBeenCalledWith('c1', { motivo: 'Perdió el celular', reasignarAUserId: null, cerrarSesion: true })
    expect(await screen.findByRole('status')).toHaveTextContent('se cerraron sus sesiones')
  })
})
