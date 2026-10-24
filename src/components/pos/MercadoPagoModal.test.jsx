/** Cobro con tarjeta desde el modal: el aviso cuando la máquina es Haulmer (T-76). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MercadoPagoModal from './MercadoPagoModal'
import { cancelarCobroEnTerminal, createPointCharge, getPointOrderStatus, MENSAJE_HAULMER } from '../../lib/cobroTarjeta'
import { completeOrderCash, updateOrderFields } from '../../lib/salesApi'

vi.mock('../../lib/cobroTarjeta', async (importOriginal) => ({
  ...(await importOriginal()),
  createPointCharge: vi.fn(),
  getPointOrderStatus: vi.fn(() => Promise.resolve({ order_status: 'OPEN' })),
  cancelPointCharge: vi.fn(),
  cancelarCobroEnTerminal: vi.fn(),
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

  describe('#131 · cancelar un cobro que ya está en la terminal', () => {
    const AVISO = 'El cobro ya está en la terminal y Mercado Pago no deja cancelarlo desde aquí. Cancélalo en el lector (o espera a que venza): si el cliente paga, la venta se registra.'

    beforeEach(() => { getPointOrderStatus.mockResolvedValue({ order_status: 'OPEN' }) })

    async function enviarYCancelar(user) {
      createPointCharge.mockResolvedValue({ charge_id: 'c-1', message: 'Esperando que el cliente pase la tarjeta...' })
      montar()
      await user.click(screen.getByRole('button', { name: /MercadoPago Point/ }))
      const boton = await screen.findByRole('button', { name: 'Cancelar pago en terminal' })
      const consultasAntes = getPointOrderStatus.mock.calls.length
      await user.click(boton)
      return consultasAntes
    }

    it('con el 409 muestra el aviso, se queda en la pantalla de cobro y sigue consultando', async () => {
      cancelarCobroEnTerminal.mockResolvedValue({ cancelado: false, mensaje: AVISO })
      const user = userEvent.setup()
      const consultasAntes = await enviarYCancelar(user)

      expect(cancelarCobroEnTerminal).toHaveBeenCalledWith('o-1')
      expect(await screen.findByRole('alert')).toHaveTextContent(AVISO)
      // Sigue en la espera: no vuelve a «elegir pago» (no se ofrece cobrar de nuevo).
      expect(screen.getByText('Terminal activa')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Efectivo/ })).not.toBeInTheDocument()
      // Vuelve a consultar el estado del cobro después de intentar cancelar.
      await vi.waitFor(() => expect(getPointOrderStatus.mock.calls.length).toBeGreaterThan(consultasAntes))
    })

    it('si después el cliente paga, la venta se registra como aprobada', async () => {
      cancelarCobroEnTerminal.mockResolvedValue({ cancelado: false, mensaje: AVISO })
      const user = userEvent.setup()
      await enviarYCancelar(user)
      getPointOrderStatus.mockResolvedValue({ order_status: 'COMPLETED' })
      expect(await screen.findByText('Pago detectado', {}, { timeout: 5000 })).toBeInTheDocument()
    })

    it('si se canceló (200), vuelve a elegir el método como siempre', async () => {
      cancelarCobroEnTerminal.mockResolvedValue({ cancelado: true })
      const user = userEvent.setup()
      await enviarYCancelar(user)
      expect(await screen.findByRole('button', { name: /Efectivo/ })).toBeInTheDocument()
      expect(screen.queryByText('Terminal activa')).not.toBeInTheDocument()
    })
  })
})
