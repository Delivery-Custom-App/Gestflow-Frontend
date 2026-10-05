/**
 * Rutas del vendedor: lo que no está en su menú tampoco se alcanza escribiendo
 * la dirección a mano. Cada tipo de local tiene una sola pantalla de venta:
 * Gestión de Mesas (con mesas) o Venta directa (al paso).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { WorkerRoutes } from './AuthenticatedRoutes'

const LOCAL_MESAS = 'loc-mesas'
const LOCAL_PASO = 'loc-paso'

const state = vi.hoisted(() => ({ email: 'cajero@demo.gestflow.dev', locales: [], loading: false }))

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { email: state.email } }) }))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: state.locales, loading: state.loading }) }))
vi.mock('../components/AppShell', async () => {
  const { Outlet } = await import('react-router')
  return { default: () => <Outlet /> }
})
vi.mock('../components/LoadingPage', () => ({ default: () => <p>cargando</p> }))

// Pantallas: solo importa cuál se monta, no lo que piden a la API.
vi.mock('../components/pos/POSModule', () => ({ default: () => <p>pantalla-mesas</p> }))
vi.mock('../components/pos/MesaDetail', () => ({ default: () => <p>pantalla-detalle-mesa</p> }))
vi.mock('../components/pos/VentaDirectaView', () => ({ default: () => <p>pantalla-venta-directa</p> }))
vi.mock('../components/AdministrativeModule', () => ({ default: () => <p>pantalla-finanzas</p> }))
vi.mock('../components/hr/HrModule', () => ({ default: () => <p>pantalla-rrhh</p> }))
vi.mock('../components/inventory/InventoryHub', () => ({ default: () => <p>pantalla-inventario</p> }))
vi.mock('../components/ConfiguracionPage', () => ({ default: () => <p>pantalla-configuracion</p> }))
vi.mock('../components/turno/MisTurnos', () => ({ default: () => <p>pantalla-mis-turnos</p> }))

const LOCALES = [
  { id: LOCAL_MESAS, name: 'Sucursal Centro', sales_model: 'RESTAURANT' },
  { id: LOCAL_PASO, name: 'Mostrador Express', sales_model: 'AL_PASO' },
]

function abrir(localId, ruta) {
  state.locales = LOCALES
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <WorkerRoutes assignedLocalId={localId} />
    </MemoryRouter>,
  )
}

afterEach(() => Object.assign(state, { email: 'cajero@demo.gestflow.dev', locales: [], loading: false }))

const PANTALLAS_AJENAS = [
  'pantalla-finanzas', 'pantalla-rrhh', 'pantalla-inventario',
]

describe('WorkerRoutes — local con mesas', () => {
  it.each([
    ['/', 'Gestión de Mesas'],
    ['/pos', 'Gestión de Mesas'],
    [`/local/${LOCAL_MESAS}/pos`, 'Gestión de Mesas'],
  ])('%s muestra %s', async (ruta) => {
    abrir(LOCAL_MESAS, ruta)
    expect(await screen.findByText('pantalla-mesas')).toBeInTheDocument()
  })

  it('conserva el detalle de una mesa', async () => {
    abrir(LOCAL_MESAS, `/local/${LOCAL_MESAS}/pos/mesa/m-1`)
    expect(await screen.findByText('pantalla-detalle-mesa')).toBeInTheDocument()
  })

  it.each([
    `/local/${LOCAL_MESAS}/administrativo/ventas`,
    `/local/${LOCAL_MESAS}/administrativo`,
    `/local/${LOCAL_MESAS}/rrhh`,
    `/local/${LOCAL_MESAS}/inventario`,
    `/local/${LOCAL_MESAS}/inventario/stock`,
    `/local/${LOCAL_MESAS}/inventario/recipes`,
    `/local/${LOCAL_MESAS}/administrativo/flujo-caja`,
    `/local/${LOCAL_MESAS}/administrativo/fondo-emergencia`,
    `/local/${LOCAL_MESAS}/dashboard`,
    `/local/${LOCAL_MESAS}/pos/reportes`,
    `/local/${LOCAL_MESAS}/pos/cocina`,
    `/local/${LOCAL_MESAS}/pos/venta-directa`,
  ])('%s vuelve a Gestión de Mesas', async (ruta) => {
    abrir(LOCAL_MESAS, ruta)
    expect(await screen.findByText('pantalla-mesas')).toBeInTheDocument()
    for (const ajena of [...PANTALLAS_AJENAS, 'pantalla-venta-directa']) {
      expect(screen.queryByText(ajena)).not.toBeInTheDocument()
    }
  })
})

describe('WorkerRoutes — local de comida al paso', () => {
  it.each(['/', `/local/${LOCAL_PASO}/pos`, `/local/${LOCAL_PASO}/pos/venta-directa`])(
    '%s muestra Venta directa',
    async (ruta) => {
      abrir(LOCAL_PASO, ruta)
      expect(await screen.findByText('pantalla-venta-directa')).toBeInTheDocument()
    },
  )

  it.each([
    `/local/${LOCAL_PASO}/administrativo/ventas`,
    `/local/${LOCAL_PASO}/administrativo`,
    `/local/${LOCAL_PASO}/rrhh`,
    `/local/${LOCAL_PASO}/inventario`,
    `/local/${LOCAL_PASO}/inventario/stock`,
    `/local/${LOCAL_PASO}/inventario/recipes`,
    `/local/${LOCAL_PASO}/administrativo/flujo-caja`,
    `/local/${LOCAL_PASO}/dashboard`,
    `/local/${LOCAL_PASO}/pos/reportes`,
    `/local/${LOCAL_PASO}/pos/cocina`,
    `/local/${LOCAL_PASO}/pos/mesa/m-1`,
  ])('%s vuelve a Venta directa', async (ruta) => {
    abrir(LOCAL_PASO, ruta)
    expect(await screen.findByText('pantalla-venta-directa')).toBeInTheDocument()
    for (const ajena of [...PANTALLAS_AJENAS, 'pantalla-mesas', 'pantalla-detalle-mesa']) {
      expect(screen.queryByText(ajena)).not.toBeInTheDocument()
    }
  })

  it('el usuario demo de venta directa también cae en Venta directa', async () => {
    state.email = 'rustik.demo@gestflow.dev'
    abrir(LOCAL_MESAS, `/local/${LOCAL_MESAS}/administrativo/ventas`)
    expect(await screen.findByText('pantalla-venta-directa')).toBeInTheDocument()
  })
})

describe('WorkerRoutes — Mis turnos', () => {
  it.each([[LOCAL_MESAS], [LOCAL_PASO]])('en su local (%s) llega a sus turnos', async (local) => {
    abrir(local, `/local/${local}/pos/mis-turnos`)
    expect(await screen.findByText('pantalla-mis-turnos')).toBeInTheDocument()
  })

  it('los de otro local no se alcanzan', async () => {
    abrir(LOCAL_MESAS, `/local/${LOCAL_PASO}/pos/mis-turnos`)
    expect(await screen.findByText('pantalla-mesas')).toBeInTheDocument()
    expect(screen.queryByText('pantalla-mis-turnos')).not.toBeInTheDocument()
  })
})

describe('WorkerRoutes — tipo de local aún desconocido', () => {
  it('no decide ni muestra una pantalla de venta hasta saber el tipo de local', async () => {
    state.loading = true
    render(
      <MemoryRouter initialEntries={[`/local/${LOCAL_PASO}/pos/venta-directa`]}>
        <WorkerRoutes assignedLocalId={LOCAL_PASO} />
      </MemoryRouter>,
    )
    expect(await screen.findByText('cargando')).toBeInTheDocument()
    expect(screen.queryByText('pantalla-venta-directa')).not.toBeInTheDocument()
    expect(screen.queryByText('pantalla-mesas')).not.toBeInTheDocument()
  })
})

describe('WorkerRoutes — local ajeno', () => {
  it('un local distinto del asignado no se alcanza', async () => {
    abrir(LOCAL_MESAS, `/local/${LOCAL_PASO}/pos/venta-directa`)
    expect(await screen.findByText('pantalla-mesas')).toBeInTheDocument()
    expect(screen.queryByText('pantalla-venta-directa')).not.toBeInTheDocument()
  })
})
