/**
 * Detalle de una franquicia (#134): el superadmin ve y gestiona a sus usuarios
 * (alta, clave, estado) y abre locales nuevos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import TenantDetailPage from './TenantDetailPage'

const api = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  createUser: vi.fn(),
}))
vi.mock('../lib/apiClient', async (importOriginal) => ({
  ...(await importOriginal()),
  getAuthContext: api.getAuthContext,
  createUser: api.createUser,
}))

const superAdmin = vi.hoisted(() => ({
  getBusinessStats: vi.fn(),
  listBusinessLocals: vi.fn(),
  listAllUsers: vi.fn(),
  createBusinessLocal: vi.fn(),
  updateBusiness: vi.fn(),
  updateLocalSalesModel: vi.fn(),
}))
vi.mock('../lib/superAdminApi', () => superAdmin)

const gestion = vi.hoisted(() => ({ restablecerClave: vi.fn(), cambiarEstadoUsuario: vi.fn() }))
vi.mock('../lib/gestionUsuarios', async (importOriginal) => ({ ...(await importOriginal()), ...gestion }))

const DUENA = { id: 'u1', email: 'ana@sushi.cl', name: 'Ana Rojas', first_name: 'Ana', last_name: 'Rojas', role: 'ADMIN_NEGOCIO', is_active: true, business_id: 'b1', local_id: null }
const VENDEDOR = { id: 'u2', email: 'luis@sushi.cl', name: 'Luis Soto', role: 'EMPLEADO', is_active: true, business_id: 'b1', local_id: 'l1' }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/gestor/negocios/b1']}>
      <Routes>
        <Route path="/gestor/negocios/:businessId" element={<TenantDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  api.getAuthContext.mockResolvedValue({ token: 'tok' })
  superAdmin.getBusinessStats.mockResolvedValue({
    business: { id: 'b1', name: 'Sushi Sur', plan: 'starter', is_active: true },
    stats: { locals: 1, users: 2 },
    orders_by_status: {},
    audit: [],
  })
  superAdmin.listBusinessLocals.mockResolvedValue([{ id: 'l1', name: 'Casa matriz', sales_model: 'RESTAURANT' }])
  superAdmin.listAllUsers.mockResolvedValue([VENDEDOR, DUENA])
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('TenantDetailPage · usuarios de la franquicia (#134)', () => {
  it('lista a los usuarios del negocio, el dueño primero y con su local', async () => {
    renderPage()
    expect(await screen.findByText('Usuarios (2)')).toBeInTheDocument()
    expect(superAdmin.listAllUsers).toHaveBeenCalledWith({ businessId: 'b1' }, 'tok')
    const nombres = screen.getAllByText(/^(Ana Rojas|Luis Soto)$/).map((n) => n.textContent)
    expect(nombres).toEqual(['Ana Rojas', 'Luis Soto'])
    expect(screen.getByText('luis@sushi.cl · Casa matriz')).toBeInTheDocument()
  })

  it('crea al dueño atado al negocio aunque no lleve local', async () => {
    api.createUser.mockResolvedValue({ id: 'u3' })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Nuevo usuario/ }))

    const rol = screen.getByLabelText(/^Rol/)
    expect(within(rol).queryByRole('option', { name: 'Super Administrador' })).toBeNull()
    await user.selectOptions(rol, 'ADMIN_NEGOCIO')
    await user.type(screen.getByLabelText(/^Nombre/, { selector: '#u-name' }), 'Pedro')
    await user.type(screen.getByLabelText(/^Correo/), 'pedro@sushi.cl')
    await user.type(screen.getByLabelText(/^Contraseña/), 'clave-segura')
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))

    await waitFor(() => expect(api.createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'pedro@sushi.cl', role: 'ADMIN_NEGOCIO', business_id: 'b1', local_id: null,
    })))
  })

  it('restablece la clave y la muestra una sola vez', async () => {
    gestion.restablecerClave.mockResolvedValue({ temporary_password: 'Tmp-12345', email_sent: false })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Restablecer la clave de Luis Soto' }))
    expect(gestion.restablecerClave).toHaveBeenCalledWith('u2')
    expect(await screen.findByTestId('clave-temporal')).toHaveTextContent('Tmp-12345')
  })

  it('desactiva a un usuario', async () => {
    gestion.cambiarEstadoUsuario.mockResolvedValue({})
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Desactivar a Luis Soto' }))
    expect(gestion.cambiarEstadoUsuario).toHaveBeenCalledWith('u2', false)
  })

  it('un error de una acción se muestra sin perder la página', async () => {
    gestion.restablecerClave.mockRejectedValue({ detail: '403: No autorizado' })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Restablecer la clave de Luis Soto' }))
    expect(await screen.findByText('No autorizado')).toBeInTheDocument()
    expect(screen.getByText('Usuarios (2)')).toBeInTheDocument()
  })
})

describe('TenantDetailPage · nuevo local (#134)', () => {
  it('abre un local para la franquicia', async () => {
    superAdmin.createBusinessLocal.mockResolvedValue({ id: 'l2' })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: /Nuevo local/ }))
    await user.type(screen.getByLabelText(/^Nombre/, { selector: '#nl-name' }), 'Sucursal Norte')
    await user.selectOptions(screen.getByLabelText('Modo de venta'), 'AL_PASO')
    await user.click(screen.getByRole('button', { name: 'Crear local' }))
    await waitFor(() => expect(superAdmin.createBusinessLocal)
      .toHaveBeenCalledWith('b1', { name: 'Sucursal Norte', salesModel: 'AL_PASO' }, 'tok'))
  })
})
