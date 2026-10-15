import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import AuthenticatedApp, { LocalIdGuard } from './AuthenticatedRoutes'
import { AuthProvider } from '../context/AuthContext'

function Protected() {
  return <div>secret-local-content</div>
}

function Home() {
  return <div>home</div>
}

function renderAt(path, assignedLocalId) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/local/:localId"
          element={
            <LocalIdGuard assignedLocalId={assignedLocalId}>
              <Protected />
            </LocalIdGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('LocalIdGuard', () => {
  it('renders children when :localId matches assignedLocalId', () => {
    renderAt('/local/42', 42)
    expect(screen.getByText('secret-local-content')).toBeInTheDocument()
  })

  it('redirects home when :localId does not match assignedLocalId (URL editada a mano)', () => {
    renderAt('/local/99', 42)
    expect(screen.getByText('home')).toBeInTheDocument()
    expect(screen.queryByText('secret-local-content')).not.toBeInTheDocument()
  })

  it('redirects home when assignedLocalId is undefined (sin local asignado)', () => {
    renderAt('/local/42', undefined)
    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('matches regardless of string/number type differences', () => {
    renderAt('/local/42', '42')
    expect(screen.getByText('secret-local-content')).toBeInTheDocument()
  })
})

// Las rutas cargan pantallas que hablan con la API; a esta prueba solo le
// importa qué se renderiza, no qué se pide.
vi.mock('../lib/apiClient', () => ({
  changeMyPassword: vi.fn(),
  apiRequest: vi.fn(() => Promise.resolve([])),
  getOptionalAuthContext: vi.fn(() => Promise.resolve({ token: null })),
  getAuthContext: vi.fn(() => Promise.resolve({ token: 't', businessId: 'b' })),
}))

/**
 * Contraseña temporal (#29): el backend responde 403 en todas las rutas
 * mientras no se cambie, así que dejar entrar era mostrar una aplicación rota.
 */
describe('AuthenticatedApp — contraseña temporal', () => {
  const montar = (user) => render(
    <AuthProvider user={user} userRole="Empleado" logout={() => {}}>
      <AuthenticatedApp />
    </AuthProvider>,
  )

  it('con la contraseña sin cambiar, muestra el cambio en vez de la aplicación', () => {
    montar({ id: 'u-1', email: 'mostrador@demo.gestflow.dev', must_change_password: true, local_id: 'loc-1' })

    expect(screen.getByRole('heading', { name: /cambia tu contraseña/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument()
  })

  it('con la contraseña ya cambiada, la puerta no aparece', () => {
    montar({ id: 'u-1', email: 'mostrador@demo.gestflow.dev', must_change_password: false, local_id: 'loc-1' })

    expect(screen.queryByRole('heading', { name: /cambia tu contraseña/i })).not.toBeInTheDocument()
  })
})

/**
 * El vendedor entra a vender con su turno de hoy abierto. La API simulada no
 * devuelve turnos, así que al vendedor se le pregunta "¿Iniciar turno?".
 */
describe('AuthenticatedApp — turno del vendedor', () => {
  const montar = (user, userRole) => render(
    <AuthProvider user={user} userRole={userRole} logout={() => {}}>
      <AuthenticatedApp />
    </AuthProvider>,
  )

  it('al vendedor sin turno se le pregunta "¿Iniciar turno?" antes de vender', async () => {
    montar({ id: 'u-1', email: 'cajero@demo.gestflow.dev', local_id: 'loc-1' }, 'Empleado')

    expect(await screen.findByRole('heading', { name: '¿Iniciar turno?' })).toBeInTheDocument()
  })

  it('el cambio de contraseña va primero: sin él, ni siquiera se revisa el turno', () => {
    montar({ id: 'u-1', email: 'cajero@demo.gestflow.dev', local_id: 'loc-1', must_change_password: true }, 'Empleado')

    expect(screen.getByRole('heading', { name: /cambia tu contraseña/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '¿Iniciar turno?' })).not.toBeInTheDocument()
  })

  it('al encargado no se le pregunta: él abre y cierra turnos desde Caja y turnos', async () => {
    montar({ id: 'u-2', email: 'centro.admin@demo.gestflow.dev', local_id: 'loc-1' }, 'Admin')

    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('heading', { name: '¿Iniciar turno?' })).not.toBeInTheDocument()
  })
})
