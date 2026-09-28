/**
 * La comanda y la boleta se piden al backend y se ven en pantalla antes de
 * imprimir. Antes la web llamaba a `/comandas/{id}/print`, que no existe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TicketModal from './TicketModal'
import { getBoleta, getComanda } from '../../lib/salesApi'
import { imprimirEnNavegador } from '../../lib/ticketPrint'

vi.mock('../../lib/salesApi', () => ({
  getComanda: vi.fn(),
  getBoleta: vi.fn(),
}))

vi.mock('../../lib/ticketPrint', async (importOriginal) => ({
  ...(await importOriginal()),
  imprimirEnNavegador: vi.fn(() => true),
}))

const COMANDA = {
  order_id: 'abcdef12-3456',
  local_name: 'Sucursal Centro',
  mesa_nombre: 'Mesa 4',
  created_at: '2026-09-28T14:30:00Z',
  items: [{ product_name: 'Churrasco italiano', quantity: 2 }],
}

const BOLETA = {
  order_id: 'abcdef12-3456',
  business_name: 'Sabores del Valle',
  business_rut: '77.123.456-7',
  local_name: 'Sucursal Centro',
  created_at: '2026-09-28T14:30:00Z',
  items: [{ product_name: 'Churrasco italiano', quantity: 2, subtotal: 12000 }],
  total: 12000,
  net_amount: 10084,
  iva_amount: 1916,
  payment_method: 'efectivo',
}

describe('TicketModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getComanda.mockResolvedValue(COMANDA)
    getBoleta.mockResolvedValue(BOLETA)
  })

  it('muestra la comanda que entrega el backend', async () => {
    render(<TicketModal tipo="comanda" orderId="ord-1" createdAt="2026-09-28T14:30:00Z" onClose={() => {}} />)

    expect(await screen.findByText('Churrasco italiano')).toBeInTheDocument()
    expect(screen.getByText('Mesa 4')).toBeInTheDocument()
    expect(getComanda).toHaveBeenCalledWith('ord-1', '2026-09-28T14:30:00Z')
    expect(getBoleta).not.toHaveBeenCalled()
  })

  it('la comanda no muestra precios', async () => {
    render(<TicketModal tipo="comanda" orderId="ord-1" onClose={() => {}} />)

    await screen.findByText('Churrasco italiano')
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it('muestra la boleta con total e IVA incluido', async () => {
    render(<TicketModal tipo="boleta" orderId="ord-1" onClose={() => {}} />)

    expect(await screen.findByText('Sabores del Valle')).toBeInTheDocument()
    expect(screen.getByText('RUT 77.123.456-7')).toBeInTheDocument()
    expect(screen.getByText('TOTAL')).toBeInTheDocument()
    expect(screen.getByText('IVA incluido (19%)')).toBeInTheDocument()
    expect(screen.getByText(/Pagado con efectivo/)).toBeInTheDocument()
  })

  it('imprimir manda el papel al navegador, no a un servicio de impresoras', async () => {
    const user = userEvent.setup()
    render(<TicketModal tipo="comanda" orderId="ord-1" onClose={() => {}} />)

    await screen.findByText('Churrasco italiano')
    await user.click(screen.getByRole('button', { name: /imprimir/i }))

    expect(imprimirEnNavegador).toHaveBeenCalledTimes(1)
    expect(imprimirEnNavegador.mock.calls[0][0]).toContain('COMANDA')
  })

  it('si el backend falla lo dice en castellano y no deja imprimir', async () => {
    getComanda.mockRejectedValue(new Error('500: algo pasó'))
    render(<TicketModal tipo="comanda" orderId="ord-1" onClose={() => {}} />)

    expect(await screen.findByText(/500: algo pasó/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /imprimir/i })).toBeDisabled()
  })
})
