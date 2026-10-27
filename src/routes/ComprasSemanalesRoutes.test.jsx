/**
 * #165: Compras semanales está apagada (`weeklyPurchases`) y sus rutas no
 * existen en Backend V2. Quien escribe la dirección vuelve a su inicio en vez
 * de abrir una pantalla que da «404: Not Found». Con la bandera encendida vuelve.
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
vi.mock('../components/AdminDashboard', () => ({ default: () => <p>pantalla-inicio</p> }))
vi.mock('../components/LocalDashboard', () => ({ default: () => <p>pantalla-dashboard-local</p> }))
vi.mock('../components/inventory/weeklyPurchases/WeeklyPurchasesPage', () => ({ default: () => <p>pantalla-compras</p> }))
vi.mock('../components/inventory/weeklyPurchases/WeeklyPurchaseDetailPage', () => ({ default: () => <p>pantalla-compra</p> }))

const original = { ...V2_FEATURES }
afterEach(() => Object.assign(V2_FEATURES, original))

function abrir(ruta, { encargado = false } = {}) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      {encargado ? <AdminRoutes assignedLocalId={LOCAL} /> : <OwnerRoutes />}
    </MemoryRouter>,
  )
}

const RUTAS = [
  `/local/${LOCAL}/inventario/compras-semanales`,
  `/local/${LOCAL}/inventario/compras-semanales/o-1`,
  `/local/${LOCAL}/inventario/proveedores/compras-semanales`,
]

describe('Compras semanales apagadas (#165)', () => {
  it('la bandera weeklyPurchases está apagada', () => {
    expect(V2_FEATURES.weeklyPurchases).toBe(false)
  })

  it.each(RUTAS)('el gerente que abre %s vuelve a su inicio', async (ruta) => {
    abrir(ruta)
    expect(await screen.findByText('pantalla-inicio')).toBeInTheDocument()
    expect(screen.queryByText(/pantalla-compra/)).not.toBeInTheDocument()
  })

  it.each(RUTAS)('el encargado que abre %s vuelve al dashboard de su local', async (ruta) => {
    abrir(ruta, { encargado: true })
    expect(await screen.findByText('pantalla-dashboard-local')).toBeInTheDocument()
    expect(screen.queryByText(/pantalla-compra/)).not.toBeInTheDocument()
  })

  it('con weeklyPurchases encendida vuelve la pantalla', async () => {
    V2_FEATURES.weeklyPurchases = true
    abrir(RUTAS[0])
    expect(await screen.findByText('pantalla-compras')).toBeInTheDocument()
  })
})
