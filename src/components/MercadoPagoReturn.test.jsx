import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MercadoPagoReturn from './MercadoPagoReturn'
import { completeOrderMercadoPago, getBoleta } from '../lib/salesApi'

vi.mock('../lib/salesApi', () => ({
  completeOrderMercadoPago: vi.fn(),
  getBoleta: vi.fn(),
}))

const ORDER_ID = '2c220c29-94d1-4a17-8ada-f93a39c3e368'

const BOLETA = {
  order_id: ORDER_ID,
  total: 4700,
  items: [
    { product_name: 'Café Americano', quantity: 1, unit_price: 2500, subtotal: 2500 },
    { product_name: 'Brownie', quantity: 1, unit_price: 2200, subtotal: 2200 },
  ],
}

function volverDeMercadoPago(mpStatus, orderId = ORDER_ID) {
  window.history.replaceState({}, '', `/?mp_status=${mpStatus}&mp_order_id=${orderId}`)
  return render(<MercadoPagoReturn />)
}

describe('MercadoPagoReturn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    completeOrderMercadoPago.mockResolvedValue({ id: ORDER_ID, status: 'completed', payment_method: 'mercadopago' })
    getBoleta.mockResolvedValue(BOLETA)
    window.history.replaceState({}, '', '/')
  })

  it('no muestra nada si la URL no viene de MercadoPago', () => {
    const { container } = render(<MercadoPagoReturn />)
    expect(container).toBeEmptyDOMElement()
    expect(completeOrderMercadoPago).not.toHaveBeenCalled()
  })

  it('con pago aprobado cierra la orden en el backend antes de anunciar el éxito', async () => {
    volverDeMercadoPago('approved')

    await waitFor(() => expect(completeOrderMercadoPago).toHaveBeenCalledWith(ORDER_ID))
    expect(await screen.findByText('¡Pago aprobado!')).toBeInTheDocument()
  })

  it('imprime el comprobante con los datos de la boleta', async () => {
    volverDeMercadoPago('approved')

    await waitFor(() => expect(getBoleta).toHaveBeenCalledWith(ORDER_ID))
    expect(await screen.findByText('¡Pago aprobado!')).toBeInTheDocument()
  })

  it('si el cierre de la orden falla NO dice que el pago quedó registrado', async () => {
    completeOrderMercadoPago.mockRejectedValue(new Error('404: Not Found'))

    volverDeMercadoPago('approved')

    expect(await screen.findByText('Pago cobrado, orden sin cerrar')).toBeInTheDocument()
    expect(screen.queryByText('¡Pago aprobado!')).not.toBeInTheDocument()
    expect(screen.getByText('404: Not Found')).toBeInTheDocument()
    // No tiene sentido imprimir un comprobante de una venta que no se registró.
    expect(getBoleta).not.toHaveBeenCalled()
  })

  it('permite reintentar el cierre y pasa a éxito cuando funciona', async () => {
    completeOrderMercadoPago.mockRejectedValueOnce(new Error('503: Service Unavailable'))
    const user = userEvent.setup()

    volverDeMercadoPago('approved')
    expect(await screen.findByText('Pago cobrado, orden sin cerrar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reintentar cierre' }))

    expect(await screen.findByText('¡Pago aprobado!')).toBeInTheDocument()
    expect(completeOrderMercadoPago).toHaveBeenCalledTimes(2)
  })

  it('si falla la boleta la venta igual queda registrada y se muestra el éxito', async () => {
    getBoleta.mockRejectedValue(new Error('500'))

    volverDeMercadoPago('approved')

    expect(await screen.findByText('¡Pago aprobado!')).toBeInTheDocument()
    expect(completeOrderMercadoPago).toHaveBeenCalledWith(ORDER_ID)
  })

  it('con pago rechazado no toca la orden', async () => {
    volverDeMercadoPago('failure')

    expect(await screen.findByText('Pago rechazado')).toBeInTheDocument()
    expect(completeOrderMercadoPago).not.toHaveBeenCalled()
  })

  it('con pago pendiente no toca la orden', async () => {
    volverDeMercadoPago('pending')

    expect(await screen.findByText('Pago pendiente')).toBeInTheDocument()
    expect(completeOrderMercadoPago).not.toHaveBeenCalled()
  })

  it('limpia los parámetros de MercadoPago de la URL', async () => {
    volverDeMercadoPago('approved')

    await waitFor(() => expect(window.location.search).toBe(''))
  })
})
