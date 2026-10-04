/**
 * /usuarios/crear sigue las mismas reglas que el cajón de /usuarios: envía el
 * nombre, ofrece solo roles que el backend guarda y solo la abre quien puede
 * crear usuarios.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import UserManagementPage from './UserManagementPage'
import { createUser } from '../lib/apiClient'

const session = vi.hoisted(() => ({ role: 'Admin Negocio' }))

vi.mock('../lib/apiClient', () => ({ createUser: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ userRole: session.role }) }))
vi.mock('../hooks/useLocals', () => ({
  useLocals: () => ({ locales: [{ id: 'loc-1', name: 'Sucursal Centro', business_id: 'b-1' }], loading: false }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  createUser.mockResolvedValue({ id: 'u-nuevo' })
})
afterEach(() => { session.role = 'Admin Negocio' })

const montar = () => render(<MemoryRouter><UserManagementPage /></MemoryRouter>)

describe('UserManagementPage', () => {
  it('crea un vendedor con su nombre y lo confirma con el nombre del rol', async () => {
    const user = userEvent.setup()
    montar()

    await user.type(screen.getByLabelText('Nombre'), 'Ana')
    await user.type(screen.getByLabelText('Apellido'), 'Rojas')
    await user.type(screen.getByLabelText('Correo'), 'ana@demo.cl')
    await user.type(screen.getByLabelText('Contraseña'), 'clave-segura')
    await user.selectOptions(screen.getByLabelText('Local asignado'), 'loc-1')
    expect(screen.getByText(/deberá cambiar la contraseña/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1))
    expect(createUser.mock.calls[0][0]).toMatchObject({ first_name: 'Ana', last_name: 'Rojas', role: 'EMPLEADO', local_id: 'loc-1' })
    expect(await screen.findByText(/creado como Vendedor en "Sucursal Centro"/)).toBeInTheDocument()
  })

  it('ofrece vendedor y encargado, sin "Cajero", y el mínimo real de contraseña', () => {
    montar()

    const opciones = within(screen.getByLabelText('Rol')).getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toEqual(['Vendedor — el punto de venta de su local', 'Encargado de local — su local (inventario, ventas, caja)'])
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('placeholder', 'Mínimo 8 caracteres')
  })

  it('el encargado no puede crear usuarios: el backend se lo rechaza', () => {
    session.role = 'Admin'
    montar()

    expect(screen.getByText('No autorizado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear usuario' })).not.toBeInTheDocument()
  })
})
