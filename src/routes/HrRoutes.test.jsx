/**
 * Recursos Humanos está apagado (bandera `hrModule`): la ruta /local/:localId/rrhh
 * no existe para el gerente ni para el encargado, y quien llega por una dirección
 * guardada vuelve a su inicio. El trabajador ya no la tiene (ver WorkerRoutes.test).
 * Con la bandera encendida la ruta vuelve: el módulo se conservó, solo está apagado.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { OwnerRoutes, AdminRoutes } from './AuthenticatedRoutes'
import { V2_FEATURES } from '../lib/v2Features'

const LOCAL = 'loc-mesas'
const OTRO_LOCAL = 'loc-paso'

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'gerente@demo.gestflow.dev' } }) }))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: [], loading: false }) }))
vi.mock('../components/AppShell', async () => {
  const { Outlet } = await import('react-router')
  return { default: () => <Outlet /> }
})
vi.mock('../components/LoadingPage', () => ({ default: () => <p>cargando</p> }))

// Pantallas: solo importa cuál se monta, no lo que piden a la API.
vi.mock('../components/AdminDashboard', () => ({ default: () => <p>pantalla-franquicias</p> }))
vi.mock('../components/LocalDashboard', () => ({ default: () => <p>pantalla-dashboard-local</p> }))
vi.mock('../components/hr/HrModule', () => ({ default: () => <p>pantalla-rrhh</p> }))
vi.mock('../components/inventory/InventoryHub', () => ({ default: () => <p>pantalla-inventario</p> }))

const original = { ...V2_FEATURES }
afterEach(() => Object.assign(V2_FEATURES, original))

function abrirGerente(ruta) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <OwnerRoutes />
    </MemoryRouter>,
  )
}

function abrirEncargado(ruta) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <AdminRoutes assignedLocalId={LOCAL} />
    </MemoryRouter>,
  )
}

describe('Recursos Humanos apagado — gerente', () => {
  it('la bandera hrModule está apagada', () => {
    expect(V2_FEATURES.hrModule).toBe(false)
  })

  it.each([`/local/${LOCAL}/rrhh`, `/local/${OTRO_LOCAL}/rrhh`])(
    '%s vuelve a sus franquicias',
    async (ruta) => {
      abrirGerente(ruta)
      expect(await screen.findByText('pantalla-franquicias')).toBeInTheDocument()
      expect(screen.queryByText('pantalla-rrhh')).not.toBeInTheDocument()
    },
  )

  it('el resto de las rutas del local se conservan', async () => {
    abrirGerente(`/local/${LOCAL}/inventario`)
    expect(await screen.findByText('pantalla-inventario')).toBeInTheDocument()
  })
})

describe('Recursos Humanos apagado — encargado', () => {
  it.each([`/local/${LOCAL}/rrhh`, `/local/${OTRO_LOCAL}/rrhh`])(
    '%s vuelve al dashboard de su local',
    async (ruta) => {
      abrirEncargado(ruta)
      expect(await screen.findByText('pantalla-dashboard-local')).toBeInTheDocument()
      expect(screen.queryByText('pantalla-rrhh')).not.toBeInTheDocument()
    },
  )

  it('el resto de las rutas de su local se conservan', async () => {
    abrirEncargado(`/local/${LOCAL}/inventario`)
    expect(await screen.findByText('pantalla-inventario')).toBeInTheDocument()
  })
})

describe('Recursos Humanos encendido de nuevo', () => {
  it('el gerente vuelve a abrir la pantalla de RRHH', async () => {
    V2_FEATURES.hrModule = true
    abrirGerente(`/local/${LOCAL}/rrhh`)
    expect(await screen.findByText('pantalla-rrhh')).toBeInTheDocument()
  })

  it('el encargado la abre en su local', async () => {
    V2_FEATURES.hrModule = true
    abrirEncargado(`/local/${LOCAL}/rrhh`)
    expect(await screen.findByText('pantalla-rrhh')).toBeInTheDocument()
  })

  it('el encargado no la alcanza en un local ajeno', async () => {
    V2_FEATURES.hrModule = true
    abrirEncargado(`/local/${OTRO_LOCAL}/rrhh`)
    expect(await screen.findByText('pantalla-dashboard-local')).toBeInTheDocument()
    expect(screen.queryByText('pantalla-rrhh')).not.toBeInTheDocument()
  })
})
