/**
 * La pantalla de dispositivos lista los lectores reales del local, que salen
 * de `/pos-machines`. La ruta que se pedía antes, `/payments/point/devices`,
 * no existe en Backend V2.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MPConfigDrawer from './MPConfigDrawer'
import { AuthProvider } from '../../context/AuthContext'
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

const montar = (userRole = 'Admin Negocio') => render(
  <AuthProvider user={{ id: 'u1' }} userRole={userRole} logout={() => {}}>
    <MPConfigDrawer localId="loc-1" onClose={() => {}} />
  </AuthProvider>,
)

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
    montar()

    expect(await screen.findByText('Lector barra')).toBeInTheDocument()
    expect(screen.getByText('Lector terraza')).toBeInTheDocument()
    expect(screen.getByText(/Cobro automático/)).toBeInTheDocument()
    expect(screen.getByText(/En espera/)).toBeInTheDocument()
    expect(listarLectores).toHaveBeenCalledWith('loc-1')
  })

  it('distingue el lector activo del que no lo está', async () => {
    montar()

    expect(await screen.findByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('no pide la ruta de dispositivos que no existe', async () => {
    montar()

    await screen.findByText('Lector barra')
    const rutas = apiRequest.mock.calls.map((c) => String(c[0]))
    expect(rutas.some((r) => r.includes('/payments/point/devices'))).toBe(false)
  })

  it('un local sin lectores no muestra la sección vacía', async () => {
    listarLectores.mockResolvedValue([])
    montar()

    await vi.waitFor(() => expect(listarLectores).toHaveBeenCalled())
    expect(screen.queryByText('Lectores del local')).not.toBeInTheDocument()
  })
})

describe('MPConfigDrawer — quién conecta la cuenta (#151)', () => {
  const conCuenta = (configured) => apiRequest.mockImplementation((ruta) => {
    if (String(ruta).includes('mp-settings')) return Promise.resolve({ configured, oauth_available: true })
    return Promise.resolve([])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    listarLectores.mockResolvedValue([])
  })

  it('el dueño ve «Conectar con MercadoPago» y, en avanzadas, «Conectar con un token»', async () => {
    conCuenta(false)
    const user = userEvent.setup()
    montar('Admin Negocio')
    expect(await screen.findByRole('button', { name: /Conectar con MercadoPago/ })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /Opciones avanzadas/ }))
    expect(screen.getByText('Conectar con un token')).toBeInTheDocument()
  })

  it('el encargado no ve cómo conectar la cuenta: ve que la conecta el dueño', async () => {
    conCuenta(false)
    const user = userEvent.setup()
    montar('Admin')
    expect(await screen.findByText(/la conecta el dueño del negocio/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Conectar con MercadoPago/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Opciones avanzadas/ }))
    expect(screen.queryByText('Conectar con un token')).not.toBeInTheDocument()
  })

  it('con la cuenta conectada, el encargado no puede desconectarla pero sí ve los lectores', async () => {
    conCuenta(true)
    montar('Admin')
    expect(await screen.findByText('Cuenta conectada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desconectar/ })).not.toBeInTheDocument()
    expect(screen.getByText('Lectores de tarjeta')).toBeInTheDocument()
  })

  it('con la cuenta conectada, el dueño puede desconectarla', async () => {
    conCuenta(true)
    montar('Admin Negocio')
    expect(await screen.findByRole('button', { name: /Desconectar/ })).toBeInTheDocument()
  })
})
