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
  getOptionalAuthContext: vi.fn(() => Promise.resolve({ token: 't', businessId: 'b1' })),
}))
vi.mock('./CreateLocalDrawer', () => ({ default: () => null }))
// Lo que importa es qué recibe la grilla.
vi.mock('./LocalsGrid', () => ({
  default: ({ salesCounts, umbral, canDeleteLocals, onGuardarUmbral }) => (
    <>
      <p>ventas {salesCounts['loc-1'] ?? '-'} · período {umbral.horas} h</p>
      <p>{canDeleteLocals ? 'puede eliminar franquicias' : 'no puede eliminar franquicias'}</p>
      {onGuardarUmbral && <button type="button" onClick={() => onGuardarUmbral({ horas: 2, medium: 8, high: 25 })}>guardar umbral</button>}
    </>
  ),
}))

// T-59: el umbral sale de /businesses/{id}/settings.
let SETTINGS
function responder() {
  apiRequest.mockImplementation(async (path, opciones = {}) => {
    if (String(path).startsWith('/businesses/b1/settings')) {
      if (opciones.method === 'PATCH') {
        SETTINGS = { ...SETTINGS, flow_threshold_medium: opciones.body.flow_threshold_medium, flow_threshold_high: opciones.body.flow_threshold_high, flow_period_hours: opciones.body.flow_period_hours, updated_at: 'ahora' }
      }
      return SETTINGS
    }
    return { data: [], total: 2 }
  })
}

const AHORA = new Date('2026-10-05T15:00:00Z')
const rutasDeConteo = () => apiRequest.mock.calls.map(([r]) => r)
const paramsDeRuta = (ruta) => new URLSearchParams(String(ruta).split('?')[1])

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(AHORA)
  localStorage.clear()
  sesion.userRole = 'Admin Negocio'
  SETTINGS = { business_id: 'b1', flow_threshold_medium: 5, flow_threshold_high: 15, flow_period_hours: 1, updated_at: null }
  responder()
})
afterEach(() => vi.useRealTimers())

describe('AdminDashboard · flujo', () => {
  it('cuenta las ventas (sin canceladas) de la última hora por defecto', async () => {
    render(<AdminDashboard />)
    expect(await screen.findByText('ventas 2 · período 1 h')).toBeInTheDocument()
    const request = apiRequest.mock.calls.find(([path]) => paramsDeRuta(path).get('date_from') === '2026-10-05T14:00:00.000Z')
    expect(request[0]).toContain('/orders?')
    expect(paramsDeRuta(request[0]).get('date_to')).toBe(AHORA.toISOString())
    expect(paramsDeRuta(request[0]).get('limit')).toBe('1')
    expect(paramsDeRuta(request[0]).getAll('status')).toEqual(['open', 'preparing', 'ready', 'completed'])
    expect(request[1]).toMatchObject({ withTotal: true })
  })

  it('usa de verdad el período guardado en el negocio (en horas)', async () => {
    SETTINGS = { ...SETTINGS, flow_period_hours: 3, updated_at: '2026-10-01T00:00:00Z' }
    render(<AdminDashboard />)
    expect(await screen.findByText('ventas 2 · período 3 h')).toBeInTheDocument()
    expect(rutasDeConteo().some((r) => r.includes(encodeURIComponent('2026-10-05T12:00:00.000Z')))).toBe(true)
  })

  it('se actualiza solo cada minuto, sin recargar la página', async () => {
    render(<AdminDashboard />)
    await screen.findByText('ventas 2 · período 1 h')

    apiRequest.mockImplementation(async (path) => (String(path).startsWith('/businesses/') ? SETTINGS : { data: [], total: 1 }))
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

describe('AdminDashboard · umbral en el negocio (T-59)', () => {
  it('guardar el umbral usa PATCH /businesses/{id}/settings', async () => {
    render(<AdminDashboard />)
    await screen.findByText('ventas 2 · período 1 h')
    await act(async () => { screen.getByRole('button', { name: 'guardar umbral' }).click() })
    expect(apiRequest).toHaveBeenCalledWith('/businesses/b1/settings', {
      method: 'PATCH', body: { flow_threshold_medium: 8, flow_threshold_high: 25, flow_period_hours: 2 },
    })
    expect(await screen.findByText('ventas 2 · período 2 h')).toBeInTheDocument()
  })

  it('si el negocio nunca guardó y hay uno distinto en el navegador, ofrece subirlo una vez y borra la clave local', async () => {
    localStorage.setItem('gestflow_flow_thresholds', JSON.stringify({ horas: 3, medium: 7, high: 20 }))
    render(<AdminDashboard />)
    const aviso = await screen.findByRole('note', { name: 'Umbral de este navegador' })
    expect(aviso).toHaveTextContent('medio desde 7, alto desde 20, en 3 h')
    await act(async () => { screen.getByRole('button', { name: 'Guardar para el negocio' }).click() })
    expect(apiRequest).toHaveBeenCalledWith('/businesses/b1/settings', {
      method: 'PATCH', body: { flow_threshold_medium: 7, flow_threshold_high: 20, flow_period_hours: 3 },
    })
    expect(localStorage.getItem('gestflow_flow_thresholds')).toBeNull()
    await waitFor(() => expect(screen.queryByRole('note', { name: 'Umbral de este navegador' })).not.toBeInTheDocument())
  })

  it('si el negocio ya guardó, no ofrece subir el del navegador', async () => {
    SETTINGS = { ...SETTINGS, updated_at: '2026-10-01T00:00:00Z' }
    localStorage.setItem('gestflow_flow_thresholds', JSON.stringify({ horas: 3, medium: 7, high: 20 }))
    render(<AdminDashboard />)
    await screen.findByText('ventas 2 · período 1 h')
    expect(screen.queryByRole('note', { name: 'Umbral de este navegador' })).not.toBeInTheDocument()
  })
})
