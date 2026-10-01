/**
 * Cambio de contraseña obligatorio (#29).
 *
 * El backend bloquea toda la API mientras `must_change_password` sea true, y
 * la web no miraba ese campo: la sesión entraba y todas las pantallas
 * respondían 403 sin explicar por qué.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CambioContrasenaObligatorio from './CambioContrasenaObligatorio'
import { AuthProvider } from '../context/AuthContext'
import { changeMyPassword } from '../lib/apiClient'

vi.mock('../lib/apiClient', () => ({ changeMyPassword: vi.fn() }))

const USUARIO = { id: 'u-1', email: 'mostrador@demo.gestflow.dev', must_change_password: true }

describe('CambioContrasenaObligatorio', () => {
  let refreshUser
  let logout

  beforeEach(() => {
    vi.clearAllMocks()
    refreshUser = vi.fn(() => Promise.resolve(USUARIO))
    logout = vi.fn()
    changeMyPassword.mockResolvedValue(null)
  })

  const montar = () => render(
    <AuthProvider user={USUARIO} userRole="Empleado" logout={logout} refreshUser={refreshUser}>
      <CambioContrasenaObligatorio />
    </AuthProvider>,
  )

  it('explica por qué no se puede seguir y quién es', async () => {
    montar()

    expect(screen.getByRole('heading', { name: /cambia tu contraseña/i })).toBeInTheDocument()
    expect(screen.getByText(/contraseña temporal/i)).toBeInTheDocument()
    expect(screen.getByText(/mostrador@demo.gestflow.dev/)).toBeInTheDocument()
  })

  it('cambia la contraseña y desbloquea la sesión sin volver a entrar', async () => {
    const user = userEvent.setup()
    montar()

    await user.type(screen.getByLabelText('Contraseña actual'), 'demo123')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'miclave2026')
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'miclave2026')
    await user.click(screen.getByRole('button', { name: /guardar y continuar/i }))

    await waitFor(() => expect(changeMyPassword).toHaveBeenCalledWith({
      current_password: 'demo123',
      new_password: 'miclave2026',
    }))
    expect(refreshUser).toHaveBeenCalled()
  })

  it('no acepta una contraseña más corta que el mínimo', async () => {
    const user = userEvent.setup()
    montar()

    await user.type(screen.getByLabelText('Contraseña actual'), 'demo123')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'corta')
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'corta')
    await user.click(screen.getByRole('button', { name: /guardar y continuar/i }))

    expect(await screen.findByText(/necesita al menos 8 caracteres/i)).toBeInTheDocument()
    expect(changeMyPassword).not.toHaveBeenCalled()
  })

  it('avisa si las dos contraseñas nuevas no coinciden', async () => {
    const user = userEvent.setup()
    montar()

    await user.type(screen.getByLabelText('Contraseña actual'), 'demo123')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'miclave2026')
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'miclave2027')
    await user.click(screen.getByRole('button', { name: /guardar y continuar/i }))

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument()
    expect(changeMyPassword).not.toHaveBeenCalled()
  })

  it('no deja repetir la contraseña temporal', async () => {
    const user = userEvent.setup()
    montar()

    await user.type(screen.getByLabelText('Contraseña actual'), 'demo1234')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'demo1234')
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'demo1234')
    await user.click(screen.getByRole('button', { name: /guardar y continuar/i }))

    expect(await screen.findByText(/distinta de la actual/i)).toBeInTheDocument()
    expect(changeMyPassword).not.toHaveBeenCalled()
  })

  it('si la contraseña actual está mal lo dice en castellano', async () => {
    changeMyPassword.mockRejectedValue(new Error('400: Contraseña actual incorrecta'))
    const user = userEvent.setup()
    montar()

    await user.type(screen.getByLabelText('Contraseña actual'), 'equivocada')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'miclave2026')
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'miclave2026')
    await user.click(screen.getByRole('button', { name: /guardar y continuar/i }))

    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeInTheDocument()
    expect(refreshUser).not.toHaveBeenCalled()
  })

  it('deja cerrar sesión si no se quiere cambiar ahora', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(screen.getByRole('button', { name: /cerrar sesión/i }))

    expect(logout).toHaveBeenCalled()
  })
})
