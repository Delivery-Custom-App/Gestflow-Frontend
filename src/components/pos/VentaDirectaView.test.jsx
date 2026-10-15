/** Venta directa (local Al Paso): quien administra puede vincular Mercado Pago; el vendedor no. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import VentaDirectaView from './VentaDirectaView'

const state = { isWorker: false }

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isWorker: state.isWorker }) }))
vi.mock('../../hooks/useCajaActiva', () => ({ useCajaActiva: () => ({ cajaId: null }) }))
vi.mock('../../lib/salesApi', () => ({
  cancelOrder: vi.fn(), createOrder: vi.fn(), fetchProductsCatalog: vi.fn(() => Promise.resolve([])),
}))
vi.mock('./MercadoPagoModal', () => ({ default: () => null }))
vi.mock('./TicketModal', () => ({ default: () => null }))
vi.mock('./MPConfigDrawer', () => ({
  default: ({ open, localId }) => (open ? <div role="dialog" aria-label="Configurar POS">drawer del local {localId}</div> : null),
}))

function montar() {
  return render(
    <MemoryRouter initialEntries={['/local/l7/pos/venta-directa']}>
      <Routes><Route path="/local/:localId/pos/venta-directa" element={<VentaDirectaView />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => { state.isWorker = false })

describe('VentaDirectaView · configurar POS', () => {
  it('quien administra el local ve «Configurar POS» y abre la vinculación de Mercado Pago de ese local', async () => {
    const user = userEvent.setup()
    montar()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Configurar POS/ }))
    expect(screen.getByRole('dialog', { name: 'Configurar POS' })).toHaveTextContent('drawer del local l7')
  })

  it('el vendedor no ve «Configurar POS»', async () => {
    state.isWorker = true
    montar()
    await screen.findByText('Venta directa')
    expect(screen.queryByRole('button', { name: /Configurar POS/ })).not.toBeInTheDocument()
  })
})
