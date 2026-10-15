/** "Cambiar de local" del encargado o el vendedor con más de un local (T-73). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CambiarLocal from './CambiarLocal'
import { TurnoVendedorContext } from '../context/turnoVendedor'
import { cambiarLocalActivo } from '../lib/authClient'
import { listarLocalesAsignados, recordarNombreDeLocal } from '../lib/localesAsignados'

const sesion = vi.hoisted(() => ({
  user: null,
  refreshUser: vi.fn(),
}))

vi.mock('../context/AuthContext', () => ({ useAuth: () => sesion }))
vi.mock('../lib/authClient', () => ({ cambiarLocalActivo: vi.fn() }))
vi.mock('../lib/localesAsignados', async (importOriginal) => ({
  ...(await importOriginal()),
  listarLocalesAsignados: vi.fn(),
}))

const ANA = { id: 'ana', role: 'EMPLEADO', local_id: 'loc-a', local_name: 'Sucursal Centro' }
const DOS_LOCALES = [
  { id: 'a1', local_id: 'loc-a', is_primary: true },
  { id: 'a2', local_id: 'loc-b', is_primary: false },
]

const alCambiar = vi.fn()

// Sin router a propósito: "¿Iniciar turno?" lo muestra fuera de él.
function montar({ turno = null } = {}) {
  return render(
    <TurnoVendedorContext.Provider value={turno ? { turno, alCerrar: vi.fn() } : null}>
      <CambiarLocal alCambiar={alCambiar} />
    </TurnoVendedorContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  sesion.user = ANA
  sesion.refreshUser.mockResolvedValue({ ...ANA, local_id: 'loc-b', local_name: 'Mostrador Express' })
  listarLocalesAsignados.mockResolvedValue(DOS_LOCALES)
  cambiarLocalActivo.mockResolvedValue({ access_token: 'nuevo' })
})

describe('CambiarLocal', () => {
  it('con más de un local muestra el actual y la opción de cambiar', async () => {
    montar()
    expect(await screen.findByRole('button', { name: 'Cambiar de local (ahora: Sucursal Centro)' })).toBeInTheDocument()
    expect(listarLocalesAsignados).toHaveBeenCalledWith('ana')
  })

  it('con un solo local no muestra nada', async () => {
    listarLocalesAsignados.mockResolvedValue([{ id: 'a1', local_id: 'loc-a' }])
    montar()
    await waitFor(() => expect(listarLocalesAsignados).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /Cambiar de local/ })).not.toBeInTheDocument()
  })

  it('al dueño no se le ofrece (ya ve todos los locales)', () => {
    sesion.user = { id: 'd', role: 'ADMIN_NEGOCIO', local_id: null }
    montar()
    expect(screen.queryByRole('button', { name: /Cambiar de local/ })).not.toBeInTheDocument()
    expect(listarLocalesAsignados).not.toHaveBeenCalled()
  })

  it('elegir otro local cambia la sesión, vuelve a leer el usuario y recarga en el inicio del local nuevo', async () => {
    recordarNombreDeLocal('loc-b', 'Mostrador Express')
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: /Cambiar de local/ }))
    await user.click(within(screen.getByRole('list', { name: 'Mis locales' })).getByRole('button', { name: /Mostrador Express/ }))

    expect(cambiarLocalActivo).toHaveBeenCalledWith('loc-b')
    await waitFor(() => expect(alCambiar).toHaveBeenCalledWith('loc-b'))
    // Primero deja guardado el usuario con el local nuevo, después recarga.
    expect(sesion.refreshUser.mock.invocationCallOrder[0]).toBeLessThan(alCambiar.mock.invocationCallOrder[0])
  })

  it('un local que nunca visitó se muestra como "Otro local asignado" (el backend no le da el nombre)', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: /Cambiar de local/ }))
    expect(screen.getByRole('button', { name: /Otro local asignado/ })).toBeInTheDocument()
  })

  it('recuerda el nombre del local activo para mostrarlo desde otro', async () => {
    montar()
    await screen.findByRole('button', { name: /Cambiar de local/ })
    expect(JSON.parse(window.localStorage.getItem('gestflow_nombres_locales'))).toEqual({ 'loc-a': 'Sucursal Centro' })
  })

  it('con un turno abierto avisa antes de cambiar', async () => {
    const user = userEvent.setup()
    montar({ turno: { id: 'turno-1' } })
    await user.click(await screen.findByRole('button', { name: /Cambiar de local/ }))
    await user.click(screen.getByRole('button', { name: /Otro local asignado/ }))

    expect(screen.getByText(/Tienes un turno abierto en Sucursal Centro/)).toBeInTheDocument()
    expect(cambiarLocalActivo).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Cambiarme a/ }))
    expect(cambiarLocalActivo).toHaveBeenCalledWith('loc-b')
  })

  it('si el backend lo rechaza, muestra el motivo y no se mueve', async () => {
    cambiarLocalActivo.mockRejectedValue(new Error('No estás asignado a ese local'))
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: /Cambiar de local/ }))
    await user.click(screen.getByRole('button', { name: /Otro local asignado/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No estás asignado a ese local')
    expect(sesion.refreshUser).not.toHaveBeenCalled()
    expect(alCambiar).not.toHaveBeenCalled()
  })
})
