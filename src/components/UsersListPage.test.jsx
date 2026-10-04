/**
 * Alta de usuarios desde /usuarios: el nombre se envía (antes se descartaba),
 * solo se ofrecen roles que el backend guarda, y al crear un vendedor se avisa
 * lo que pasará en su primer ingreso.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import UsersListPage, { CreateUserDrawer } from './UsersListPage'
import { createUser, listUsers } from '../lib/apiClient'
import { V2_FEATURES } from '../lib/v2Features'

const session = vi.hoisted(() => ({ role: 'Admin Negocio' }))

vi.mock('../lib/apiClient', () => ({
  createUser: vi.fn(),
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
  getOptionalAuthContext: vi.fn(() => Promise.resolve({ businessId: 'b-1' })),
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ userRole: session.role, user: { id: 'yo' } }) }))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: LOCALES, loading: false }) }))

const LOCALES = [{ id: 'loc-1', name: 'Sucursal Centro', business_id: 'b-1' }]

const original = { ...V2_FEATURES }
beforeEach(() => {
  vi.clearAllMocks()
  createUser.mockResolvedValue({ id: 'u-nuevo' })
  listUsers.mockResolvedValue([
    { id: 'u-1', email: 'juan@demo.cl', name: 'Juan Pérez', role: 'EMPLEADO', local_id: 'loc-1' },
  ])
})
afterEach(() => {
  Object.assign(V2_FEATURES, original)
  session.role = 'Admin Negocio'
})

function abrirCajon(props = {}) {
  const onSuccess = vi.fn()
  render(
    <CreateUserDrawer isOpen onClose={() => {}} onSuccess={onSuccess} locales={LOCALES} localesLoading={false} userRole="Admin Negocio" {...props} />,
  )
  return { onSuccess }
}

async function completar(user, { rol } = {}) {
  await user.type(screen.getByLabelText(/^Nombre/), 'Juan')
  await user.type(screen.getByLabelText(/^Apellido/), 'Pérez')
  await user.type(screen.getByLabelText(/Correo electrónico/), 'juan@demo.cl')
  await user.type(screen.getByLabelText(/^Contraseña/), 'clave-segura')
  if (rol) await user.selectOptions(screen.getByLabelText(/^Rol/), rol)
  await user.selectOptions(screen.getByLabelText(/Local asignado/), 'loc-1')
}

describe('CreateUserDrawer', () => {
  it('envía el nombre y el apellido que antes se descartaban', async () => {
    const user = userEvent.setup()
    const { onSuccess } = abrirCajon()

    await completar(user)
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1))
    expect(createUser.mock.calls[0][0]).toMatchObject({
      first_name: 'Juan', last_name: 'Pérez', email: 'juan@demo.cl', role: 'EMPLEADO', local_id: 'loc-1', business_id: 'b-1',
    })
    expect(createUser.mock.calls[0][0]).not.toHaveProperty('rut')
    expect(onSuccess).toHaveBeenCalled()
  })

  it('el dueño elige entre encargado y vendedor, sin "Cajero"', () => {
    abrirCajon()

    const opciones = within(screen.getByLabelText(/^Rol/)).getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toEqual(['Encargado de local', 'Vendedor'])
  })

  it('la contraseña dice el mínimo real y lo exige', async () => {
    const user = userEvent.setup()
    abrirCajon()

    expect(screen.getByLabelText(/^Contraseña/)).toHaveAttribute('placeholder', 'Mínimo 8 caracteres')
    await completar(user)
    await user.clear(screen.getByLabelText(/^Contraseña/))
    await user.type(screen.getByLabelText(/^Contraseña/), '1234567')
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument()
    expect(createUser).not.toHaveBeenCalled()
  })

  it('al crear un vendedor avisa del cambio de contraseña y del correo; a un encargado no', async () => {
    const user = userEvent.setup()
    abrirCajon()

    expect(screen.getByText(/deberá cambiar la contraseña/i)).toBeInTheDocument()
    expect(screen.getByText(/le llegará un correo con sus datos de acceso/i)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^Rol/), 'ADMIN')
    expect(screen.queryByText(/deberá cambiar la contraseña/i)).not.toBeInTheDocument()
  })

  it('mientras el backend no guarde el RUT, no se pide', () => {
    abrirCajon()
    expect(screen.queryByLabelText(/^RUT/)).not.toBeInTheDocument()
  })

  it('con la bandera userRut el RUT se pide, se formatea y se valida antes de enviar', async () => {
    V2_FEATURES.userRut = true
    const user = userEvent.setup()
    abrirCajon()

    await completar(user)
    await user.type(screen.getByLabelText(/^RUT/), '123456789')
    expect(screen.getByLabelText(/^RUT/)).toHaveValue('12.345.678-9')
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    expect(screen.getByText('RUT inválido (dígito verificador incorrecto).')).toBeInTheDocument()
    expect(createUser).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText(/^RUT/))
    await user.type(screen.getByLabelText(/^RUT/), '123456785')
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1))
    expect(createUser.mock.calls[0][0].rut).toBe('123456785')
  })
})

describe('UsersListPage', () => {
  const montar = () => render(<MemoryRouter><UsersListPage /></MemoryRouter>)

  it('el dueño ve el botón de crear y la lista con nombres y roles legibles', async () => {
    montar()

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Vendedor')).toBeInTheDocument()
    // El botón del encabezado y el de confirmar dentro del cajón.
    expect(screen.getAllByRole('button', { name: /Crear usuario/ })).toHaveLength(2)
  })

  it('quien no puede crear usuarios no ve el botón', async () => {
    session.role = 'Admin'
    montar()

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Crear usuario/ })).not.toBeInTheDocument()
  })
})
