/**
 * El vendedor en Configuración: la pantalla queda fuera de su local, pero no sin
 * salida. Con el AppShell de verdad, «Mi punto de venta» lo devuelve a la pantalla
 * de venta de su local (Gestión de Mesas con mesas, Venta directa al paso), sin
 * depender de la flecha del navegador.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { WorkerRoutes } from './AuthenticatedRoutes'

const LOCAL_MESAS = 'loc-mesas'
const LOCAL_PASO = 'loc-paso'

const state = vi.hoisted(() => ({
  localId: null,
  locales: [
    { id: 'loc-mesas', name: 'Sucursal Centro', sales_model: 'RESTAURANT' },
    { id: 'loc-paso', name: 'Mostrador Express', sales_model: 'AL_PASO' },
  ],
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'cajero@demo.gestflow.dev' }, userRole: 'Empleado', assignedLocalId: state.localId, logout: vi.fn(),
  }),
}))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => ({ locales: state.locales, loading: false }) }))
vi.mock('../hooks/useCurrentBusiness', () => ({ useCurrentBusiness: () => ({ business: { name: 'Café GestFlow Demo' } }) }))
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ darkMode: false, setDarkMode: vi.fn() }) }))
vi.mock('../components/onboarding/CoachMark', () => ({ default: () => null }))
vi.mock('../components/LoadingPage', () => ({ default: () => <p>cargando</p> }))

// Pantallas: solo importa cuál se monta, no lo que piden a la API.
vi.mock('../components/pos/POSModule', () => ({ default: () => <p>pantalla-mesas</p> }))
vi.mock('../components/pos/MesaDetail', () => ({ default: () => <p>pantalla-detalle-mesa</p> }))
vi.mock('../components/pos/VentaDirectaView', () => ({ default: () => <p>pantalla-venta-directa</p> }))
vi.mock('../components/ConfiguracionPage', () => ({ default: () => <p>pantalla-configuracion</p> }))
vi.mock('../components/turno/MisTurnos', () => ({ default: () => <p>pantalla-mis-turnos</p> }))

function abrir(localId, ruta) {
  state.localId = localId
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <WorkerRoutes assignedLocalId={localId} />
    </MemoryRouter>,
  )
}

const volverAlPos = () => within(screen.getByRole('navigation')).getByRole('button', { name: 'Mi punto de venta' })

describe.each([
  ['con mesas', LOCAL_MESAS, 'pantalla-mesas'],
  ['de comida al paso', LOCAL_PASO, 'pantalla-venta-directa'],
])('Vendedor en Configuración — local %s', (_tipo, local, pantallaDeVenta) => {
  it('desde Configuración vuelve a su pantalla de venta con «Mi punto de venta»', async () => {
    const user = userEvent.setup()
    abrir(local, '/configuracion')
    expect(await screen.findByText('pantalla-configuracion')).toBeInTheDocument()

    await user.click(volverAlPos())

    expect(await screen.findByText(pantallaDeVenta)).toBeInTheDocument()
    expect(screen.queryByText('pantalla-configuracion')).not.toBeInTheDocument()
  })

  it('ida y vuelta: vende, entra a Configuración desde la barra superior y regresa a vender', async () => {
    const user = userEvent.setup()
    abrir(local, `/local/${local}/pos${pantallaDeVenta === 'pantalla-venta-directa' ? '/venta-directa' : ''}`)
    expect(await screen.findByText(pantallaDeVenta)).toBeInTheDocument()
    // En su local el menú es el de siempre: el acceso de vuelta no se duplica.
    expect(within(screen.getByRole('navigation')).queryByRole('button', { name: 'Mi punto de venta' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Configuración' }))
    expect(await screen.findByText('pantalla-configuracion')).toBeInTheDocument()

    await user.click(volverAlPos())
    expect(await screen.findByText(pantallaDeVenta)).toBeInTheDocument()
  })
})

describe('Vendedor en Configuración — sin local asignado', () => {
  it('no se le ofrece un acceso que no lleva a ninguna parte', async () => {
    abrir(null, '/configuracion')

    expect(await screen.findByText('pantalla-configuracion')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mi punto de venta' })).not.toBeInTheDocument()
  })
})
