/**
 * Configuración: nombre y apellido reales y editables, iniciales en lugar de
 * foto, e invitación a completar el nombre si falta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfiguracionPage from './ConfiguracionPage'
import { guardarMiNombre } from '../lib/perfil'

const sesion = vi.hoisted(() => ({ user: null, refreshUser: null }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: sesion.user, userRole: 'Admin Negocio', refreshUser: sesion.refreshUser }) }))
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ darkMode: false, setDarkMode: vi.fn() }) }))
vi.mock('../hooks/useCurrentBusiness', () => ({ useCurrentBusiness: () => ({ business: { plan: 'professional' } }) }))
vi.mock('../lib/apiClient', () => ({ changeMyPassword: vi.fn() }))
vi.mock('../lib/perfil', async (importOriginal) => ({ ...(await importOriginal()), guardarMiNombre: vi.fn(() => Promise.resolve({})) }))

beforeEach(() => {
  vi.clearAllMocks()
  sesion.refreshUser = vi.fn(() => Promise.resolve())
  sesion.user = { id: 'u1', email: 'admin@demo.gestflow.dev', first_name: 'Ana', last_name: 'Rojas', avatar_url: 'data:image/jpeg;base64,xxx' }
})

describe('ConfiguracionPage · perfil', () => {
  it('no hay foto de perfil ni forma de subirla: se ven las iniciales', () => {
    const { container } = render(<ConfiguracionPage />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(screen.queryByText(/clic en la foto/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('iniciales-perfil')).toHaveTextContent('AR')
  })

  it('muestra el nombre y el apellido reales, listos para editar', () => {
    render(<ConfiguracionPage />)
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana')
    expect(screen.getByLabelText('Apellido')).toHaveValue('Rojas')
    expect(screen.queryByText(/Todavía no cargaste tu nombre/)).not.toBeInTheDocument()
    // Sin cambios no hay nada que guardar.
    expect(screen.getByRole('button', { name: 'Guardar nombre' })).toBeDisabled()
  })

  it('guarda el nombre editado y refresca la sesión', async () => {
    const user = userEvent.setup()
    render(<ConfiguracionPage />)

    await user.clear(screen.getByLabelText('Apellido'))
    await user.type(screen.getByLabelText('Apellido'), 'Soto')
    await user.click(screen.getByRole('button', { name: 'Guardar nombre' }))

    await waitFor(() => expect(guardarMiNombre).toHaveBeenCalledWith({ nombre: 'Ana', apellido: 'Soto' }))
    expect(sesion.refreshUser).toHaveBeenCalled()
    expect(await screen.findByText('Nombre guardado')).toBeInTheDocument()
  })

  it('sin nombre cargado, invita a completarlo (y no inventa uno con el correo)', () => {
    sesion.user = { id: 'u2', email: 'cajero@demo.gestflow.dev', first_name: null, last_name: null }
    render(<ConfiguracionPage />)

    expect(screen.getByText(/Todavía no cargaste tu nombre/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('')
    expect(screen.queryByText('Cajero')).not.toBeInTheDocument()
    expect(screen.getByTestId('iniciales-perfil')).toHaveTextContent('C')
  })

  it('el nombre es obligatorio', async () => {
    const user = userEvent.setup()
    render(<ConfiguracionPage />)

    await user.clear(screen.getByLabelText('Nombre'))
    await user.click(screen.getByRole('button', { name: 'Guardar nombre' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa tu nombre.')
    expect(guardarMiNombre).not.toHaveBeenCalled()
  })

  it('si el backend falla, lo dice', async () => {
    guardarMiNombre.mockRejectedValueOnce(new Error('No autorizado'))
    const user = userEvent.setup()
    render(<ConfiguracionPage />)

    await user.type(screen.getByLabelText('Nombre'), 'ita')
    await user.click(screen.getByRole('button', { name: 'Guardar nombre' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No autorizado')
  })
})
