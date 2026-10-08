/**
 * Inicio: el flujo de cada franquicia cuenta las ventas del período del umbral
 * (en horas) y se actualiza solo, sin recargar la página.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import AdminDashboard from './AdminDashboard'
import { apiRequest } from '../lib/apiClient'

vi.mock('react-router', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ pathname: '/admin', state: null }) }))
const sesion = vi.hoisted(() => ({ userRole: 'Admin Negocio' }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => sesion }))
// El mismo arreglo en cada render, como el hook real (si cambiara, el conteo se repetiría sin fin).
const datosLocales = vi.hoisted(() => ({ locales: [{ id: 'loc-1', name: 'Sucursal Centro' }], loading: false, error: null, refetch: () => {} }))
vi.mock('../hooks/useLocals', () => ({ useLocals: () => datosLocales }))
vi.mock('../lib/apiClient', () => ({
  apiRequest: vi.fn(),
  getOptionalAuthContext: vi.fn(() => Promise.resolve({ token: 't' })),
}))
vi.mock('./CreateLocalDrawer', () => ({ default: () => null }))
// Lo que importa es qué recibe la grilla.
vi.mock('./LocalsGrid', () => ({
  default: ({ salesCounts, umbral, canDeleteLocals }) => (
    <>
      <p>ventas {salesCounts['loc-1'] ?? '-'} · período {umbral.horas} h</p>
      <p>{canDeleteLocals ? 'puede eliminar franquicias' : 'no puede eliminar franquicias'}</p>
    </>
  ),
}))

const AHORA = new Date('2026-10-05T15:00:00Z')
const rutasDeConteo = () => apiRequest.mock.calls.map(([r]) => r)

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(AHORA)
  localStorage.clear()
  sesion.userRole = 'Admin Negocio'
  apiRequest.mockResolvedValue([
    { id: 'o1', status: 'completed', created_at: '2026-10-05T14:30:00Z' },
    { id: 'o2', status: 'open', created_at: '2026-10-05T14:50:00Z' },
    { id: 'o3', status: 'cancelled', created_at: '2026-10-05T14:40:00Z' },
  ])
})
afterEach(() => vi.useRealTimers())

describe('AdminDashboard · flujo', () => {
  it('cuenta las ventas (sin canceladas) de la última hora por defecto', async () => {
    render(<AdminDashboard />)
    expect(await screen.findByText('ventas 2 · período 1 h')).toBeInTheDocument()
    expect(rutasDeConteo()).toContain(
      `/orders?local_id=loc-1&date_from=${encodeURIComponent('2026-10-05T14:00:00.000Z')}&date_to=${encodeURIComponent(AHORA.toISOString())}`,
    )
  })

  it('usa de verdad el período guardado en horas', async () => {
    localStorage.setItem('gestflow_flow_thresholds', JSON.stringify({ horas: 3, medium: 5, high: 15 }))
    render(<AdminDashboard />)
    expect(await screen.findByText('ventas 2 · período 3 h')).toBeInTheDocument()
    expect(rutasDeConteo().some((r) => r.includes(encodeURIComponent('2026-10-05T12:00:00.000Z')))).toBe(true)
  })

  it('se actualiza solo cada minuto, sin recargar la página', async () => {
    render(<AdminDashboard />)
    await screen.findByText('ventas 2 · período 1 h')

    apiRequest.mockResolvedValue([{ id: 'o9', status: 'completed', created_at: '2026-10-05T15:00:30Z' }])
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    await waitFor(() => expect(screen.getByText('ventas 1 · período 1 h')).toBeInTheDocument())
  })

  it('y al volver a la pestaña', async () => {
    render(<AdminDashboard />)
    await screen.findByText('ventas 2 · período 1 h')
    const antes = apiRequest.mock.calls.length

    await act(async () => { window.dispatchEvent(new Event('focus')) })
    await waitFor(() => expect(apiRequest.mock.calls.length).toBeGreaterThan(antes))
  })
})

describe('AdminDashboard · eliminar franquicias', () => {
  it('el dueño ya no puede eliminar franquicias desde Inicio', async () => {
    render(<AdminDashboard />)
    expect(await screen.findByText('no puede eliminar franquicias')).toBeInTheDocument()
  })

  it('el superadmin conserva la opción', async () => {
    sesion.userRole = 'Superadmin'
    render(<AdminDashboard />)
    expect(await screen.findByText('puede eliminar franquicias')).toBeInTheDocument()
  })
})
