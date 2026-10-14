/** Cobro con tarjeta desde el modal: el aviso cuando la máquina es Haulmer (T-76). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MercadoPagoModal from './MercadoPagoModal'
import { createPointCharge, MENSAJE_HAULMER } from '../../lib/cobroTarjeta'

vi.mock('../../lib/cobroTarjeta', async (importOriginal) => ({
  ...(await importOriginal()),
  createPointCharge: vi.fn(),
  getPointOrderStatus: vi.fn(() => Promise.resolve({ order_status: 'OPEN' })),
  cancelPointCharge: vi.fn(),
}))

const montar = () => render(
  <MercadoPagoModal open orderId="o-1" total={4400} description="Mesa 1" onSuccess={vi.fn()} onClose={vi.fn()} />,
)

beforeEach(() => { vi.clearAllMocks() })

describe('MercadoPagoModal · cobro con tarjeta', () => {
  it('envía el cobro a la terminal y queda esperando la tarjeta', async () => {
    createPointCharge.mockResolvedValue({ charge_id: 'c-1', message: 'Esperando que el cliente pase la tarjeta...' })
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /MercadoPago Point/ }))
    expect(createPointCharge).toHaveBeenCalledWith('o-1', expect.objectContaining({ description: 'Mesa 1' }))
    expect(await screen.findByText(/Esperando que el cliente pase la tarjeta/)).toBeInTheDocument()
  })

  it('si la máquina del turno es Haulmer, lo dice y vuelve a elegir método', async () => {
    createPointCharge.mockRejectedValue(Object.assign(new Error(MENSAJE_HAULMER), { proveedor: 'haulmer' }))
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /MercadoPago Point/ }))
    expect(await screen.findByText(MENSAJE_HAULMER)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Efectivo/ })).toBeInTheDocument()
  })
})
