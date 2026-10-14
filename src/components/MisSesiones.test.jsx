/** "Mis sesiones" en Configuración (T-74). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MisSesiones from './MisSesiones'
import { listarMisSesiones } from '../lib/sesiones'

const sesion = vi.hoisted(() => ({ user: { id: 'yo', role: 'EMPLEADO' }, logout: vi.fn() }))

vi.mock('../context/AuthContext', () => ({ useAuth: () => sesion }))
vi.mock('../lib/sesiones', async (importOriginal) => ({
  ...(await importOriginal()),
  listarMisSesiones: vi.fn(),
}))

const ACTUAL = {
  id: 's1', es_actual: true, activa: true, device_name: null, ip: '127.0.0.1',
  user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  last_seen_at: '2026-10-14T12:30:00', expires_at: '2026-11-13T12:30:00',
}
const TABLET = {
  id: 's2', es_actual: false, activa: true, device_name: 'Tablet barra', ip: '10.0.0.8',
  user_agent: 'Mozilla/5.0 (Linux; Android 14)', last_seen_at: '2026-10-13T20:00:00', expires_at: '2026-11-12T20:00:00',
}

beforeEach(() => {
  vi.clearAllMocks()
  sesion.user = { id: 'yo', role: 'EMPLEADO' }
  listarMisSesiones.mockResolvedValue([ACTUAL, TABLET])
})

describe('MisSesiones', () => {
  it('lista cada dispositivo con su IP, última actividad y vencimiento', async () => {
    render(<MisSesiones />)
    const lista = await screen.findByRole('list', { name: 'Mis sesiones' })
    const tablet = within(lista).getByText('Tablet barra').closest('li')
    expect(within(tablet).getByText(/IP 10\.0\.0\.8/)).toHaveTextContent('Última actividad: 13-10-2026 20:00 · Vence: 12-11-2026 20:00')
  })

  it('la actual aparece como "Este dispositivo", nombrada por su navegador si no tiene nombre', async () => {
    render(<MisSesiones />)
    const actual = (await screen.findByText('Este dispositivo')).closest('li')
    expect(within(actual).getByText(/Chrome en Windows/)).toBeInTheDocument()
    expect(within(actual).getByRole('button', { name: /Cerrar sesión en este dispositivo/ })).toBeInTheDocument()
  })

  it('"Cerrar sesión en este dispositivo" cierra la sesión actual', async () => {
    const user = userEvent.setup()
    render(<MisSesiones />)
    await user.click(await screen.findByRole('button', { name: /Cerrar sesión en este dispositivo/ }))
    expect(sesion.logout).toHaveBeenCalled()
  })

  it('las otras sesiones no tienen botón: al empleado se le dice a quién avisar', async () => {
    render(<MisSesiones />)
    const tablet = (await screen.findByText('Tablet barra')).closest('li')
    expect(within(tablet).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/avisa al encargado o al dueño: pueden cerrarla desde tu ficha/)).toBeInTheDocument()
  })

  it('al dueño se le dice que cambiar la contraseña cierra las demás', async () => {
    sesion.user = { id: 'd', role: 'ADMIN_NEGOCIO' }
    render(<MisSesiones />)
    expect(await screen.findByText(/cambia tu contraseña: eso cierra todas las demás sesiones/)).toBeInTheDocument()
  })

  it('si no se pueden cargar, lo dice', async () => {
    listarMisSesiones.mockRejectedValue(new Error('500: error del servidor'))
    render(<MisSesiones />)
    expect(await screen.findByRole('alert')).toHaveTextContent('error del servidor')
  })
})
