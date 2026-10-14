/** Sesiones del empleado en la pantalla del administrador (T-53). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SesionesEmpleadoDialog from './SesionesEmpleadoDialog'
import { cerrarSesionesDe, listarSesionesDe } from '../lib/sesiones'

vi.mock('../lib/sesiones', async (importOriginal) => ({
  ...(await importOriginal()),
  listarSesionesDe: vi.fn(),
  cerrarSesionesDe: vi.fn(),
}))

const ABIERTAS = [
  { id: 's1', device_name: 'Tablet barra', ip: '10.0.0.5', last_seen_at: '2026-10-14T15:00:00Z', expires_at: '2026-11-13T15:00:00Z', activa: true },
  { id: 's2', device_name: 'Celular de Luis', ip: '10.0.0.6', last_seen_at: '2026-10-14T14:00:00Z', expires_at: '2026-11-13T14:00:00Z', activa: true },
]
const CERRADA = { id: 's0', device_name: 'Celular viejo', activa: false, revoked_at: '2026-10-13T10:00:00Z', revoked_kind: 'admin', revoked_reason: 'Perdió el celular', revoked_by_user_id: 'enc-1' }
const LUIS = { id: 'u-luis', name: 'Luis Soto', email: 'luis@x.cl' }

beforeEach(() => {
  vi.clearAllMocks()
  listarSesionesDe.mockImplementation(async (_id, { incluirCerradas }) => (incluirCerradas ? [...ABIERTAS, CERRADA] : ABIERTAS))
  cerrarSesionesDe.mockResolvedValue({ cerradas: 1, sesiones: [] })
})

describe('SesionesEmpleadoDialog', () => {
  it('lista las sesiones abiertas con dispositivo, IP y última actividad, y aclara que no termina el turno', async () => {
    render(<SesionesEmpleadoDialog usuario={LUIS} onClose={() => {}} />)
    const lista = await screen.findByRole('list', { name: 'Sesiones abiertas' })
    expect(within(lista).getByText('Tablet barra')).toBeInTheDocument()
    expect(within(lista).getByText(/IP 10.0.0.5 · Última actividad/)).toBeInTheDocument()
    expect(screen.getByText(/no termina su turno/)).toBeInTheDocument()
    expect(listarSesionesDe).toHaveBeenCalledWith('u-luis', { incluirCerradas: false })
  })

  it('cerrar una sesión pide el motivo y manda el session_id', async () => {
    const user = userEvent.setup()
    render(<SesionesEmpleadoDialog usuario={LUIS} onClose={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Cerrar la sesión de Celular de Luis' }))

    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/al menos 3 caracteres/)
    expect(cerrarSesionesDe).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Motivo para cerrar la sesión de Celular de Luis/), 'Perdió el celular')
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
    expect(cerrarSesionesDe).toHaveBeenCalledWith('u-luis', { motivo: 'Perdió el celular', sessionId: 's2' })
    expect(await screen.findByRole('status')).toHaveTextContent('Se cerró 1 sesión.')
    await waitFor(() => expect(listarSesionesDe).toHaveBeenCalledTimes(2))
  })

  it('«Cerrar todas» manda sin session_id e informa cuántas se cerraron', async () => {
    const user = userEvent.setup()
    cerrarSesionesDe.mockResolvedValue({ cerradas: 2, sesiones: [] })
    render(<SesionesEmpleadoDialog usuario={LUIS} onClose={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Cerrar todas' }))
    await user.type(screen.getByLabelText('Motivo para cerrar todas sus sesiones'), 'Dejó de trabajar aquí')
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
    expect(cerrarSesionesDe).toHaveBeenCalledWith('u-luis', { motivo: 'Dejó de trabajar aquí', sessionId: null })
    expect(await screen.findByRole('status')).toHaveTextContent('Se cerraron 2 sesiones.')
  })

  it('«Ver cerradas» muestra el historial con el motivo y quién la cerró', async () => {
    const user = userEvent.setup()
    render(<SesionesEmpleadoDialog usuario={LUIS} onClose={() => {}} nombreDeUsuario={() => 'Elena Centro'} />)
    await screen.findByText('Tablet barra')
    await user.click(screen.getByLabelText('Ver cerradas'))
    const historial = await screen.findByRole('list', { name: 'Sesiones cerradas' })
    expect(historial).toHaveTextContent('Celular viejo')
    expect(historial).toHaveTextContent('La cerró el administrador')
    expect(historial).toHaveTextContent('Por Elena Centro')
    expect(historial).toHaveTextContent('Motivo: Perdió el celular')
  })

  it('un error del backend se muestra', async () => {
    const user = userEvent.setup()
    cerrarSesionesDe.mockRejectedValue(Object.assign(new Error('403: No autorizado'), { detail: 'No autorizado' }))
    render(<SesionesEmpleadoDialog usuario={LUIS} onClose={() => {}} />)
    await user.click(await screen.findByRole('button', { name: 'Cerrar la sesión de Tablet barra' }))
    await user.type(screen.getByLabelText(/Motivo/), 'Prueba')
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado')
  })
})
