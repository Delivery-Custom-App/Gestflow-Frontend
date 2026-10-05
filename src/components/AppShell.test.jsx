/**
 * Menú de Inventario: solo se ofrece lo que el backend sabe responder.
 * Proveedores y Pedidos (compras semanales) no existen en Backend V2, así que
 * quedan fuera del menú mientras sus banderas de V2_FEATURES estén apagadas.
 *
 * Menú del vendedor: depende del tipo de local y es una sola entrada.
 *
 * Recursos Humanos está apagado (bandera `hrModule`): ningún rol lo ve, ni como
 * ítem deshabilitado ni como "pronto".
 *
 * Cocina y Recetas están apagadas (banderas `kitchenView` y `recipes`): nadie
 * las ve en el menú mientras sigan apagadas.
 *
 * Inicio reemplaza a "Tus franquicias": es lo primero del menú del dueño y se
 * queda dentro de una franquicia para volver.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
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

  it('en un local con mesas ofrece tres entradas y no Proveedores, Pedidos ni Recetas', () => {
    renderShell('loc-mesas')

    for (const name of ['Estado Inventario', 'Menú', 'Control de stock']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Recetas' })).not.toBeInTheDocument()
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

  it.each([['con mesas', 'loc-mesas', 'pos'], ['de comida al paso', 'loc-paso', 'pos/venta-directa']])(
    'en un local %s también tiene "Mis turnos", y lo lleva a sus turnos',
    async (_tipo, local, ruta) => {
      session.role = 'Empleado'
      renderShell(local, ruta)

      await userEvent.setup().click(screen.getByRole('button', { name: 'Mis turnos' }))
      expect(screen.getByRole('button', { name: 'Mis turnos' })).toHaveClass('bg-[hsl(var(--accent))]')
    },
  )

  it('"Mis turnos" es del vendedor: el dueño y el encargado ven los turnos en Caja y turnos', () => {
    renderShell('loc-mesas', 'pos')
    expect(screen.queryByRole('button', { name: 'Mis turnos' })).not.toBeInTheDocument()
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

  it('el dueño del negocio conserva Finanzas e Inventario', () => {
    renderShell('loc-mesas', 'pos')

    expect(screen.getByRole('button', { name: 'Gestión de Mesas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Administración' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inventario' })).toBeInTheDocument()
  })
})

describe('AppShell — Cocina y Recetas apagadas', () => {
  it('las banderas kitchenView y recipes están apagadas', () => {
    expect(V2_FEATURES.kitchenView).toBe(false)
    expect(V2_FEATURES.recipes).toBe(false)
  })

  it.each([['el dueño', 'Admin Negocio'], ['el encargado', 'Admin']])(
    '%s no ve Cocina ni Recetas',
    (_quien, rol) => {
      session.role = rol
      // Cada acordeón se abre en su sección: Cocina bajo POS, Recetas bajo Inventario.
      renderShell('loc-mesas', 'pos')
      expect(screen.getByRole('button', { name: 'Gestión de Mesas' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cocina' })).not.toBeInTheDocument()
      cleanup()

      renderShell('loc-mesas', 'inventario')
      expect(screen.getByRole('button', { name: 'Control de stock' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Recetas' })).not.toBeInTheDocument()
    },
  )

  it('al encender las banderas reaparecen para el dueño', () => {
    V2_FEATURES.kitchenView = true
    V2_FEATURES.recipes = true

    renderShell('loc-mesas', 'pos')
    expect(screen.getByRole('button', { name: 'Cocina' })).toBeInTheDocument()
    cleanup()

    renderShell('loc-mesas', 'inventario')
    expect(screen.getByRole('button', { name: 'Recetas' })).toBeInTheDocument()
  })

  it('con las banderas encendidas el vendedor sigue sin verlas', () => {
    V2_FEATURES.kitchenView = true
    V2_FEATURES.recipes = true
    session.role = 'Empleado'
    renderShell('loc-mesas', 'pos')

    expect(screen.queryByRole('button', { name: 'Cocina' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recetas' })).not.toBeInTheDocument()
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

    expect(screen.getByRole('button', { name: 'Inicio' })).toBeInTheDocument()
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

function renderConInicio(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/admin" element={<p>pantalla de inicio</p>} />
          <Route path="/local/:localId/*" element={<p>contenido del local</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function botonesDelMenu() {
  return within(screen.getByRole('navigation')).getAllByRole('button')
}

describe('AppShell — Inicio del dueño', () => {
  it('Inicio es lo primero del menú y "Tus franquicias" ya no aparece', () => {
    renderConInicio('/admin')

    expect(botonesDelMenu()[0]).toHaveAccessibleName('Inicio')
    expect(screen.queryByRole('button', { name: 'Tus franquicias' })).not.toBeInTheDocument()
  })

  it('dentro de una franquicia Inicio sigue primero y lleva de vuelta', async () => {
    const user = userEvent.setup()
    renderConInicio('/local/loc-mesas/pos')

    expect(botonesDelMenu()[0]).toHaveAccessibleName('Inicio')
    await user.click(screen.getByRole('button', { name: 'Inicio' }))

    expect(screen.getByText('pantalla de inicio')).toBeInTheDocument()
  })

  it('el encargado y el vendedor no tienen Inicio', () => {
    session.role = 'Admin'
    renderConInicio('/local/loc-mesas/pos')
    expect(screen.queryByRole('button', { name: 'Inicio' })).not.toBeInTheDocument()
    cleanup()

    session.role = 'Empleado'
    renderConInicio('/local/loc-mesas/pos')
    expect(screen.queryByRole('button', { name: 'Inicio' })).not.toBeInTheDocument()
  })
})

function renderConConfiguracion(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/admin" element={<p>pantalla de inicio</p>} />
          <Route path="/configuracion" element={<p>pantalla de configuración</p>} />
          <Route path="/local/:localId/*" element={<p>contenido del local</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell — Configuración junto al cambio de tema', () => {
  afterEach(() => {
    try { window.localStorage.removeItem('appSidebarCollapsed') } catch { /* sin storage */ }
  })

  it('está en la barra superior, al lado del cambio de tema, y no en el menú lateral', () => {
    renderConConfiguracion('/admin')

    const configuracion = screen.getByRole('button', { name: 'Configuración' })
    const tema = screen.getByRole('button', { name: 'Cambiar a modo oscuro' })
    expect(configuracion.parentElement).toBe(tema.parentElement)
    expect(within(screen.getByRole('navigation')).queryByRole('button', { name: 'Configuración' })).not.toBeInTheDocument()
  })

  it('lleva a la misma pantalla y se marca como activa en ella', async () => {
    const user = userEvent.setup()
    renderConConfiguracion('/local/loc-mesas/pos')

    const boton = screen.getByRole('button', { name: 'Configuración' })
    expect(boton).not.toHaveAttribute('aria-current')
    await user.click(boton)

    expect(screen.getByText('pantalla de configuración')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configuración' })).toHaveAttribute('aria-current', 'page')
  })

  it('con el menú colapsado se sigue entendiendo qué es', () => {
    window.localStorage.setItem('appSidebarCollapsed', '1')
    renderConConfiguracion('/admin')

    const boton = screen.getByRole('button', { name: 'Configuración' })
    expect(boton).toHaveAttribute('title', 'Configuración')
  })

  it('el vendedor también la tiene, y su menú no queda con un recuadro vacío', () => {
    session.role = 'Empleado'
    renderConConfiguracion('/local/loc-mesas/pos')

    expect(screen.getByRole('button', { name: 'Configuración' })).toBeInTheDocument()
    expect(screen.queryByText('Descubrir')).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation')).getAllByRole('button')[0]).toHaveAccessibleName(/POS Restaurante/)
  })
})

// Muestra a qué local llevó el menú: así la prueba ve que es el mismo de la URL.
function UsuariosDelLocal() {
  const { localId } = useParams()
  return <p>{`usuarios de ${localId}`}</p>
}

function renderConUsuarios(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/admin" element={<p>pantalla de inicio</p>} />
          <Route path="/usuarios" element={<p>usuarios del negocio</p>} />
          <Route path="/local/:localId/usuarios" element={<UsuariosDelLocal />} />
          <Route path="/local/:localId/*" element={<p>contenido del local</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell — Usuarios por rol', () => {
  const menu = () => within(screen.getByRole('navigation'))

  it('fuera de una franquicia, el dueño va a los usuarios de todo el negocio', async () => {
    const user = userEvent.setup()
    renderConUsuarios('/admin')

    await user.click(menu().getByRole('button', { name: 'Usuarios' }))
    expect(screen.getByText('usuarios del negocio')).toBeInTheDocument()
  })

  it('dentro de una franquicia, el dueño va a los de ese local sin salir de ella', async () => {
    const user = userEvent.setup()
    // loc-paso no es el primero de la lista de locales: el menú usa el de la URL.
    renderConUsuarios('/local/loc-paso/pos/venta-directa')

    await user.click(menu().getByRole('button', { name: 'Usuarios' }))
    expect(screen.getByText('usuarios de loc-paso')).toBeInTheDocument()
    // Sigue dentro: el menú del local (POS, Inventario…) sigue a la vista.
    expect(menu().getByRole('button', { name: 'Inventario' })).toBeInTheDocument()
  })

  it('el encargado también tiene Usuarios, y lo lleva a los de su local', async () => {
    const user = userEvent.setup()
    session.role = 'Admin'
    renderConUsuarios('/local/loc-mesas/dashboard')

    await user.click(menu().getByRole('button', { name: 'Usuarios' }))
    expect(screen.getByText('usuarios de loc-mesas')).toBeInTheDocument()
  })

  it('un encargado sin local asignado no recibe un Usuarios que no lleva a ninguna parte', () => {
    session.role = 'Admin'
    renderConUsuarios('/admin')

    expect(menu().queryByRole('button', { name: 'Usuarios' })).not.toBeInTheDocument()
  })

  it('el vendedor no tiene Usuarios', () => {
    session.role = 'Empleado'
    renderConUsuarios('/local/loc-mesas/pos')

    expect(menu().queryByRole('button', { name: 'Usuarios' })).not.toBeInTheDocument()
  })
})
