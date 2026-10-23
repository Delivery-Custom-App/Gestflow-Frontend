/** Vincular una caja física: sin cuenta de Mercado Pago en el local, se ofrece conectarla. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CajaMpPairingModal from './CajaMpPairingModal'
import { AuthProvider } from '../../context/AuthContext'
import { provisionCajaFisicaMp, getAvailableMpPos } from '../../lib/administrativeApi'

vi.mock('../../lib/administrativeApi', () => ({
  provisionCajaFisicaMp: vi.fn(),
  verifyCajaFisicaMpPairing: vi.fn(),
  putLocalMpLocation: vi.fn(),
  getAvailableMpPos: vi.fn(),
  assignExistingMpPos: vi.fn(),
}))
vi.mock('./MPConfigDrawer', () => ({
  default: ({ open, localId }) => (open ? <div role="dialog" aria-label="Configurar POS">drawer del local {localId}</div> : null),
}))

const SIN_CUENTA = new Error('400: Conectá la cuenta MercadoPago del local antes de provisionar una Caja')

const montar = (userRole = 'Admin Negocio') => render(
  <AuthProvider user={{ id: 'u1' }} userRole={userRole} logout={vi.fn()}>
    <CajaMpPairingModal caja={{ id: 'c1', name: 'Caja principal' }} localId="l1" onClose={vi.fn()} onUpdated={vi.fn()} />
  </AuthProvider>,
)

beforeEach(() => { vi.clearAllMocks() })

describe('CajaMpPairingModal · local sin cuenta de Mercado Pago', () => {
  it('al crear una caja nueva, explica que falta la cuenta y deja conectarla', async () => {
    const user = userEvent.setup()
    provisionCajaFisicaMp.mockRejectedValue(SIN_CUENTA)
    montar()
    await user.click(screen.getByRole('button', { name: /Crear una Caja nueva/ }))
    expect(await screen.findByText(/todavía no tiene una cuenta de MercadoPago conectada/)).toBeInTheDocument()
    expect(screen.queryByText(/^400:/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Conectar cuenta de MercadoPago' }))
    expect(screen.getByRole('dialog', { name: 'Configurar POS' })).toHaveTextContent('drawer del local l1')
  })

  it('lo mismo al buscar un POS que ya existe', async () => {
    const user = userEvent.setup()
    getAvailableMpPos.mockRejectedValue(SIN_CUENTA)
    montar()
    await user.click(screen.getByRole('button', { name: /Usar un POS que ya existe/ }))
    expect(await screen.findByRole('button', { name: 'Conectar cuenta de MercadoPago' })).toBeInTheDocument()
  })

  it('otro error sigue mostrándose tal cual, con «Reintentar»', async () => {
    const user = userEvent.setup()
    provisionCajaFisicaMp.mockRejectedValue(new Error('500: algo falló'))
    montar()
    await user.click(screen.getByRole('button', { name: /Crear una Caja nueva/ }))
    expect(await screen.findByText('500: algo falló')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conectar cuenta de MercadoPago' })).not.toBeInTheDocument()
  })

  it('si falta la dirección (con o sin tilde) abre el formulario de dirección', async () => {
    const user = userEvent.setup()
    provisionCajaFisicaMp.mockRejectedValue(new Error('400: Falta completar la dirección del local: street_name.'))
    montar()
    await user.click(screen.getByRole('button', { name: /Crear una Caja nueva/ }))
    expect(await screen.findByLabelText('Calle')).toBeInTheDocument()
  })
})

describe('CajaMpPairingModal · quién conecta la cuenta de Mercado Pago (#151)', () => {
  it('al encargado del local no le ofrece conectarla: le dice que la conecta el dueño', async () => {
    const user = userEvent.setup()
    provisionCajaFisicaMp.mockRejectedValue(SIN_CUENTA)
    montar('Admin')
    await user.click(screen.getByRole('button', { name: /Crear una Caja nueva/ }))
    expect(await screen.findByText(/la conecta el dueño del negocio/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Conectar cuenta de MercadoPago' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
  })

  it('al superadmin sí se la ofrece', async () => {
    const user = userEvent.setup()
    provisionCajaFisicaMp.mockRejectedValue(SIN_CUENTA)
    montar('Superadmin')
    await user.click(screen.getByRole('button', { name: /Crear una Caja nueva/ }))
    expect(await screen.findByRole('button', { name: 'Conectar cuenta de MercadoPago' })).toBeInTheDocument()
  })
})
