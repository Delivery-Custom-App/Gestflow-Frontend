/**
 * Cocina y Recetas están apagadas (banderas `kitchenView` y `recipes`): sus
 * rutas no existen para el gerente ni para el encargado, y quien llega por una
 * dirección guardada vuelve a su inicio. Con la bandera encendida la ruta
 * vuelve: el código se conservó, solo está apagado.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { OwnerRoutes, AdminRoutes } from './AuthenticatedRoutes'
import { V2_FEATURES } from '../lib/v2Features'

const LOCAL = 'loc-mesas'

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'gerente@demo.gestflow.dev' } }) }))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: [], loading: false }) }))
vi.mock('../components/AppShell', async () => {
  const { Outlet } = await import('react-router')
  return { default: () => <Outlet /> }
})
vi.mock('../components/LoadingPage', () => ({ default: () => <p>cargando</p> }))

// Pantallas: solo importa cuál se monta, no lo que piden a la API.
vi.mock('../components/AdminDashboard', () => ({ default: () => <p>pantalla-inicio</p> }))
vi.mock('../components/LocalDashboard', () => ({ default: () => <p>pantalla-dashboard-local</p> }))
vi.mock('../components/pos/POSModule', () => ({ default: () => <p>pantalla-cocina</p> }))
vi.mock('../components/inventory/recipes/RecipesPage', () => ({ default: () => <p>pantalla-recetas</p> }))
vi.mock('../components/inventory/InventoryHub', () => ({ default: () => <p>pantalla-inventario</p> }))

const original = { ...V2_FEATURES }
afterEach(() => Object.assign(V2_FEATURES, original))

const COCINA = `/local/${LOCAL}/pos/cocina`
const RECETAS = `/local/${LOCAL}/inventario/recipes`

function abrir(ruta, { encargado = false } = {}) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      {encargado ? <AdminRoutes assignedLocalId={LOCAL} /> : <OwnerRoutes />}
    </MemoryRouter>,
  )
}

describe('Cocina y Recetas apagadas', () => {
  it('las banderas kitchenView y recipes están apagadas', () => {
    expect(V2_FEATURES.kitchenView).toBe(false)
    expect(V2_FEATURES.recipes).toBe(false)
  })

  it.each([COCINA, RECETAS])('el gerente que abre %s vuelve a su inicio', async (ruta) => {
    abrir(ruta)
    expect(await screen.findByText('pantalla-inicio')).toBeInTheDocument()
    expect(screen.queryByText('pantalla-cocina')).not.toBeInTheDocument()
    expect(screen.queryByText('pantalla-recetas')).not.toBeInTheDocument()
  })

  it.each([COCINA, RECETAS])('el encargado que abre %s vuelve al dashboard de su local', async (ruta) => {
    abrir(ruta, { encargado: true })
    expect(await screen.findByText('pantalla-dashboard-local')).toBeInTheDocument()
    expect(screen.queryByText('pantalla-cocina')).not.toBeInTheDocument()
    expect(screen.queryByText('pantalla-recetas')).not.toBeInTheDocument()
  })

  it('el resto del inventario se conserva', async () => {
    abrir(`/local/${LOCAL}/inventario`)
    expect(await screen.findByText('pantalla-inventario')).toBeInTheDocument()
  })
})

describe('Cocina y Recetas encendidas de nuevo', () => {
  it('con kitchenView vuelve la pantalla de Cocina', async () => {
    V2_FEATURES.kitchenView = true
    abrir(COCINA)
    expect(await screen.findByText('pantalla-cocina')).toBeInTheDocument()
  })

  it('con recipes vuelve la pantalla de Recetas', async () => {
    V2_FEATURES.recipes = true
    abrir(RECETAS, { encargado: true })
    expect(await screen.findByText('pantalla-recetas')).toBeInTheDocument()
  })
})
