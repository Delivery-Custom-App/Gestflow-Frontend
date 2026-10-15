/**
 * Usuarios por rol: el dueño los ve en /usuarios (todo el negocio) y en
 * /local/:localId/usuarios (una franquicia); el encargado, solo los de su
 * local, y nunca la pantalla de alta.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation, useParams } from 'react-router'
import { OwnerRoutes, AdminRoutes } from './AuthenticatedRoutes'

const LOCAL = 'loc-mesas'
const OTRO_LOCAL = 'loc-paso'

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'gerente@demo.gestflow.dev' } }) }))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: [], loading: false }) }))
vi.mock('../components/AppShell', async () => {
  const { Outlet } = await import('react-router')
  return { default: () => <Outlet /> }
})
vi.mock('../components/LoadingPage', () => ({ default: () => <p>cargando</p> }))

// Pantallas: solo importa cuál se monta y con qué local.
vi.mock('../components/AdminDashboard', () => ({ default: () => <p>pantalla-inicio</p> }))
vi.mock('../components/LocalDashboard', () => ({ default: () => <p>pantalla-dashboard-local</p> }))
vi.mock('../components/UserManagementPage', () => ({ default: () => <p>pantalla-alta</p> }))
vi.mock('../components/UsersListPage', () => ({
  default: function UsuariosFalsos() {
    const { localId } = useParams()
    const { pathname } = useLocation()
    return <p>{`usuarios ${localId ? `de ${localId}` : 'del negocio'} en ${pathname}`}</p>
  },
}))

function abrir(ruta, { encargado = false } = {}) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      {encargado ? <AdminRoutes assignedLocalId={LOCAL} /> : <OwnerRoutes />}
    </MemoryRouter>,
  )
}

describe('Usuarios — dueño', () => {
  it('/usuarios muestra los de todo el negocio', async () => {
    abrir('/usuarios')
    expect(await screen.findByText('usuarios del negocio en /usuarios')).toBeInTheDocument()
  })

  it('dentro de una franquicia, los de ese local sin salir de ella', async () => {
    abrir(`/local/${OTRO_LOCAL}/usuarios`)
    expect(await screen.findByText(`usuarios de ${OTRO_LOCAL} en /local/${OTRO_LOCAL}/usuarios`)).toBeInTheDocument()
  })

  it('conserva la pantalla de alta', async () => {
    abrir('/usuarios/crear')
    expect(await screen.findByText('pantalla-alta')).toBeInTheDocument()
  })
})

describe('Usuarios — encargado', () => {
  it('/usuarios lo lleva a los de su local', async () => {
    abrir('/usuarios', { encargado: true })
    expect(await screen.findByText(`usuarios de ${LOCAL} en /local/${LOCAL}/usuarios`)).toBeInTheDocument()
  })

  it('los de su local se abren directo', async () => {
    abrir(`/local/${LOCAL}/usuarios`, { encargado: true })
    expect(await screen.findByText(`usuarios de ${LOCAL} en /local/${LOCAL}/usuarios`)).toBeInTheDocument()
  })

  it('los de un local ajeno no: vuelve a su inicio', async () => {
    abrir(`/local/${OTRO_LOCAL}/usuarios`, { encargado: true })
    expect(await screen.findByText('pantalla-dashboard-local')).toBeInTheDocument()
    expect(screen.queryByText(/usuarios de/)).not.toBeInTheDocument()
  })

  it('la pantalla de alta sigue cerrada: el backend no le deja crear usuarios', async () => {
    abrir('/usuarios/crear', { encargado: true })
    expect(await screen.findByText('pantalla-dashboard-local')).toBeInTheDocument()
    expect(screen.queryByText('pantalla-alta')).not.toBeInTheDocument()
  })
})
