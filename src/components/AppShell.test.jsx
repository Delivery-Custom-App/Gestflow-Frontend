/**
 * Menú de Inventario: solo se ofrece lo que el backend sabe responder.
 * Proveedores y Pedidos (compras semanales) no existen en Backend V2, así que
 * quedan fuera del menú mientras sus banderas de V2_FEATURES estén apagadas.
 *
 * Menú del vendedor: depende del tipo de local y es una sola entrada.
 *
 * Recursos Humanos está apagado (bandera `hrModule`): ningún rol lo ve, ni como
 * ítem deshabilitado ni como "pronto".
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import AppShell from './AppShell'
import { V2_FEATURES } from '../lib/v2Features'

const mockLocales = [
  { id: 'loc-mesas', name: 'Sucursal Centro', sales_model: 'RESTAURANT' },
  { id: 'loc-paso', name: 'Mostrador Express', sales_model: 'AL_PASO' },
]

const session = vi.hoisted(() => ({
  email: 'admin@demo.gestflow.dev',
  role: 'Admin Negocio',
  locales: null,
  loading: false,
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: session.email }, userRole: session.role, logout: vi.fn() }),
}))
vi.mock('../hooks/useLocals', () => ({
  useLocals: () => ({ locales: session.locales ?? mockLocales, loading: session.loading }),
}))
vi.mock('../hooks/useCurrentBusiness', () => ({ useCurrentBusiness: () => ({ business: { name: 'Café GestFlow Demo' } }) }))
vi.mock('./onboarding/CoachMark', () => ({ default: () => null }))
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ darkMode: false, setDarkMode: vi.fn() }) }))

function renderShell(localId, path = 'inventario') {
  return render(
    <MemoryRouter initialEntries={[`/local/${localId}/${path}`]}>
      <Routes>
        <Route path="/local/:localId/*" element={<AppShell />}>
          <Route path="*" element={<p>contenido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const original = { ...V2_FEATURES }
afterEach(() => {
  Object.assign(V2_FEATURES, original)
  Object.assign(session, {
    email: 'admin@demo.gestflow.dev', role: 'Admin Negocio', locales: null, loading: false,
  })
})

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

const FUERA_DEL_MENU_DEL_VENDEDOR = [
  /^RRHH$/, /Recursos Humanos/, /Finanzas/, /Administración/, /^Ventas$/, /Caja y turnos/,
  /Inventario/, /^Menú$/, /Control de stock/, /^Recetas$/, /Cocina/, /^Dashboard$/,
]

function noSeVe(patrones) {
  for (const name of patrones) {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
  }
}

describe('AppShell — menú del vendedor', () => {
  it('en un local con mesas ve solo Gestión de Mesas', () => {
    session.role = 'Empleado'
    renderShell('loc-mesas', 'pos')

    expect(screen.getByRole('button', { name: 'Gestión de Mesas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Venta directa' })).not.toBeInTheDocument()
    noSeVe(FUERA_DEL_MENU_DEL_VENDEDOR)
  })

  it('en un local de comida al paso ve solo Venta directa', () => {
    session.role = 'Empleado'
    renderShell('loc-paso', 'pos/venta-directa')

    expect(screen.getByRole('button', { name: 'Venta directa' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gestión de Mesas' })).not.toBeInTheDocument()
    noSeVe(FUERA_DEL_MENU_DEL_VENDEDOR)
  })

  it('el rol Cajero tiene el mismo menú que el Empleado', () => {
    session.role = 'Cajero'
    renderShell('loc-paso', 'pos/venta-directa')

    expect(screen.getByRole('button', { name: 'Venta directa' })).toBeInTheDocument()
    noSeVe(FUERA_DEL_MENU_DEL_VENDEDOR)
  })

  it('el usuario demo de venta directa también ve solo Venta directa', () => {
    session.role = 'Empleado'
    session.email = 'rustik.demo@gestflow.dev'
    renderShell('loc-mesas', 'pos/venta-directa')

    expect(screen.getByRole('button', { name: 'Venta directa' })).toBeInTheDocument()
    noSeVe(FUERA_DEL_MENU_DEL_VENDEDOR)
  })

  it('mientras no se conoce el tipo de local no ofrece ninguna entrada de venta', () => {
    session.role = 'Empleado'
    session.locales = []
    session.loading = true
    renderShell('loc-paso', 'pos')

    expect(screen.queryByRole('button', { name: 'Gestión de Mesas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Venta directa' })).not.toBeInTheDocument()
    noSeVe(FUERA_DEL_MENU_DEL_VENDEDOR)
  })

  it('el dueño del negocio conserva Cocina, Finanzas e Inventario', () => {
    renderShell('loc-mesas', 'pos')

    expect(screen.getByRole('button', { name: 'Cocina' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Administración' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inventario' })).toBeInTheDocument()
  })
})

function renderShellSinLocal() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AppShell />}>
          <Route index element={<p>contenido</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function noHayRrhh() {
  expect(screen.queryByRole('button', { name: /RRHH/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Recursos Humanos/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/pronto/i)).not.toBeInTheDocument()
}

describe('AppShell — Recursos Humanos apagado', () => {
  it('la bandera hrModule está apagada', () => {
    expect(V2_FEATURES.hrModule).toBe(false)
  })

  it('el gerente sin local elegido no ve el ítem deshabilitado ni "pronto"', () => {
    renderShellSinLocal()

    expect(screen.getByRole('button', { name: 'Tus franquicias' })).toBeInTheDocument()
    noHayRrhh()
  })

  it('el gerente no ve RRHH dentro de un local', () => {
    renderShell('loc-mesas', 'pos')
    noHayRrhh()
  })

  it('el encargado no ve RRHH dentro de su local', () => {
    session.role = 'Admin'
    renderShell('loc-mesas', 'pos')

    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
    noHayRrhh()
  })

  it('al encender la bandera RRHH reaparece para el gerente y el encargado', () => {
    V2_FEATURES.hrModule = true

    renderShell('loc-mesas', 'pos')
    expect(screen.getByRole('button', { name: 'RRHH' })).toBeInTheDocument()
    cleanup()

    session.role = 'Admin'
    renderShell('loc-mesas', 'pos')
    expect(screen.getByRole('button', { name: 'RRHH' })).toBeInTheDocument()
  })

  it('con la bandera encendida el vendedor sigue sin verlo y no hay ítem deshabilitado', () => {
    V2_FEATURES.hrModule = true

    session.role = 'Empleado'
    renderShell('loc-mesas', 'pos')
    noHayRrhh()
    cleanup()

    session.role = 'Admin Negocio'
    renderShellSinLocal()
    noHayRrhh()
  })
})
