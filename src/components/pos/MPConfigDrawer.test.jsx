/**
 * La pantalla de dispositivos lista los lectores reales del local, que salen
 * de `/pos-machines`. La ruta que se pedía antes, `/payments/point/devices`,
 * no existe en Backend V2.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import MPConfigDrawer from './MPConfigDrawer'
import { apiRequest } from '../../lib/apiClient'
import { listarLectores } from '../../lib/lectoresApi'

vi.mock('../../lib/apiClient', () => ({ apiRequest: vi.fn() }))

vi.mock('../../lib/lectoresApi', async (importOriginal) => ({
  ...(await importOriginal()),
  listarLectores: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const LECTORES = [
  { id: 'pm-1', display_name: 'Lector barra', operating_mode: 'remote_pdv', is_active: true, name: 'Lector barra', modo: 'Cobro automático', activo: true },
  { id: 'pm-2', display_name: 'Lector terraza', operating_mode: 'idle', is_active: false, name: 'Lector terraza', modo: 'En espera', activo: false },
]

describe('MPConfigDrawer — lectores del local', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiRequest.mockImplementation((ruta) => {
      if (String(ruta).includes('mp-settings')) return Promise.resolve({ connected: false })
      if (String(ruta).includes('mercadopago-pos')) return Promise.resolve([])
      return Promise.resolve([])
    })
    listarLectores.mockResolvedValue(LECTORES)
  })

  it('lista los lectores reales del local con su modo', async () => {
    render(<MPConfigDrawer localId="loc-1" onClose={() => {}} />)

    expect(await screen.findByText('Lector barra')).toBeInTheDocument()
    expect(screen.getByText('Lector terraza')).toBeInTheDocument()
    expect(screen.getByText(/Cobro automático/)).toBeInTheDocument()
    expect(screen.getByText(/En espera/)).toBeInTheDocument()
    expect(listarLectores).toHaveBeenCalledWith('loc-1')
  })

  it('distingue el lector activo del que no lo está', async () => {
    render(<MPConfigDrawer localId="loc-1" onClose={() => {}} />)

    expect(await screen.findByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('no pide la ruta de dispositivos que no existe', async () => {
    render(<MPConfigDrawer localId="loc-1" onClose={() => {}} />)

    await screen.findByText('Lector barra')
    const rutas = apiRequest.mock.calls.map((c) => String(c[0]))
    expect(rutas.some((r) => r.includes('/payments/point/devices'))).toBe(false)
  })

  it('un local sin lectores no muestra la sección vacía', async () => {
    listarLectores.mockResolvedValue([])
    render(<MPConfigDrawer localId="loc-1" onClose={() => {}} />)

    await vi.waitFor(() => expect(listarLectores).toHaveBeenCalled())
    expect(screen.queryByText('Lectores del local')).not.toBeInTheDocument()
  })
})
