/** Cobro con tarjeta desde el modal: el aviso cuando la máquina es Haulmer (T-76). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MercadoPagoModal from './MercadoPagoModal'
import { createPointCharge, MENSAJE_HAULMER } from '../../lib/cobroTarjeta'
import { completeOrderCash, updateOrderFields } from '../../lib/salesApi'

vi.mock('../../lib/cobroTarjeta', async (importOriginal) => ({
  ...(await importOriginal()),
  createPointCharge: vi.fn(),
  getPointOrderStatus: vi.fn(() => Promise.resolve({ order_status: 'OPEN' })),
  cancelPointCharge: vi.fn(),
}))
vi.mock('../../lib/salesApi', async (importOriginal) => ({
  ...(await importOriginal()),
  completeOrderCash: vi.fn(),
  updateOrderFields: vi.fn(),
}))

const montar = (props = {}) => render(
  <MercadoPagoModal open orderId="o-1" total={4400} description="Mesa 1" onSuccess={vi.fn()} onClose={vi.fn()} {...props} />,
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

  it('manda propina del 10% al pedido antes de cobrar con tarjeta; el monto lo pone el servidor (T-65)', async () => {
    createPointCharge.mockResolvedValue({ charge_id: 'c-1', message: 'Esperando que el cliente pase la tarjeta...' })
    const user = userEvent.setup()
    montar({ createdAt: '2026-10-14T12:00:00Z' })
    await user.click(screen.getByRole('button', { name: '10%' }))
    await user.click(screen.getByRole('button', { name: /MercadoPago Point/ }))

    expect(updateOrderFields).toHaveBeenCalledWith('o-1', { tip_amount: 440 }, '2026-10-14T12:00:00Z')
    expect(createPointCharge).toHaveBeenCalledWith('o-1', { description: 'Mesa 1' })
  })

  it('suma la propina al efectivo recibido y la registra al completar la orden', async () => {
    completeOrderCash.mockResolvedValue({ id: 'o-1' })
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    montar({ createdAt: '2026-10-14T12:00:00Z', onSuccess })
    await user.click(screen.getByRole('button', { name: '20%' }))
    await user.click(screen.getByRole('button', { name: /Efectivo/ }))
    await user.type(screen.getByLabelText('Monto recibido'), '5280')
    await user.click(screen.getByRole('button', { name: 'Confirmar pago en efectivo' }))

    expect(completeOrderCash).toHaveBeenCalledWith('o-1', 5280, '2026-10-14T12:00:00Z', 880)
    expect(onSuccess).toHaveBeenCalledWith('CASH', 880)
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

describe('MercadoPagoModal · seguir el charge_id (T-65)', () => {
  it('si el backend devuelve el cobro que ya estaba, lo dice', async () => {
    createPointCharge.mockResolvedValue({ charge_id: 'c-1', point_charge_active: true, message: 'x' })
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /MercadoPago Point/ }))
    expect(await screen.findByText(/El cobro ya está en la terminal/)).toBeInTheDocument()
  })

  it('el 409 «cobrando otra venta» ofrece reintentar', async () => {
    const err = Object.assign(new Error('La máquina está cobrando otra venta: espera unos segundos y vuelve a intentar.'), { status: 409, reintentable: true })
    createPointCharge.mockRejectedValueOnce(err).mockResolvedValueOnce({ charge_id: 'c-2', message: 'Esperando que el cliente pase la tarjeta...' })
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /MercadoPago Point/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/cobrando otra venta/)
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(createPointCharge).toHaveBeenCalledTimes(2)
    expect(await screen.findByText(/Esperando que el cliente pase la tarjeta/)).toBeInTheDocument()
  })
})
