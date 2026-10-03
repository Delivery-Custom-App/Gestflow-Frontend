/**
 * Menú de Inventario: solo se ofrece lo que el backend sabe responder.
 * Proveedores y Pedidos (compras semanales) no existen en Backend V2, así que
 * quedan fuera del menú mientras sus banderas de V2_FEATURES estén apagadas.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import AppShell from './AppShell'
import { V2_FEATURES } from '../lib/v2Features'

const mockLocales = [
  { id: 'loc-mesas', name: 'Sucursal Centro', sales_model: 'RESTAURANT' },
  { id: 'loc-paso', name: 'Mostrador Express', sales_model: 'AL_PASO' },
]

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'admin@demo.gestflow.dev' }, userRole: 'Admin Negocio', logout: vi.fn() }),
}))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: mockLocales }) }))
vi.mock('../hooks/useCurrentBusiness', () => ({ useCurrentBusiness: () => ({ business: { name: 'Café GestFlow Demo' } }) }))
vi.mock('./onboarding/CoachMark', () => ({ default: () => null }))
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ darkMode: false, setDarkMode: vi.fn() }) }))

function renderShell(localId) {
  return render(
    <MemoryRouter initialEntries={[`/local/${localId}/inventario`]}>
      <Routes>
        <Route path="/local/:localId/*" element={<AppShell />}>
          <Route path="inventario" element={<p>contenido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const original = { ...V2_FEATURES }
afterEach(() => Object.assign(V2_FEATURES, original))

describe('AppShell — menú de Inventario', () => {
  it('las banderas de proveedores y compras semanales están apagadas', () => {
    expect(V2_FEATURES.suppliers).toBe(false)
    expect(V2_FEATURES.weeklyPurchases).toBe(false)
  })

  it('en un local con mesas ofrece cuatro entradas y no Proveedores ni Pedidos', () => {
    renderShell('loc-mesas')

    for (const name of ['Estado Inventario', 'Menú', 'Control de stock', 'Recetas']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Proveedores' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pedidos' })).not.toBeInTheDocument()
  })

  it('en un local al paso conserva su recorte de tres entradas', () => {
    renderShell('loc-paso')

    for (const name of ['Estado Inventario', 'Menú', 'Control de stock']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Recetas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Proveedores' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pedidos' })).not.toBeInTheDocument()
  })

  it('al encender las banderas las entradas reaparecen en un local con mesas', () => {
    V2_FEATURES.suppliers = true
    V2_FEATURES.weeklyPurchases = true
    renderShell('loc-mesas')

    expect(screen.getByRole('button', { name: 'Proveedores' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pedidos' })).toBeInTheDocument()
  })
})
