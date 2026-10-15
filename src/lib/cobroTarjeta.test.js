/** Cobro con tarjeta: Mercado Pago Point o el punto único /payments/card (T-76). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiRequest } from './apiClient'
import { V2_FEATURES } from './v2Features'
import { errorDeCobroTarjeta,
  MENSAJE_HAULMER, cancelPointCharge, createPointCharge, getPointOrderStatus, rutaBaseCobroTarjeta,
} from './cobroTarjeta'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const original = { ...V2_FEATURES }
const rutas = () => apiRequest.mock.calls.map(([ruta, opciones]) => `${opciones?.method || 'GET'} ${ruta}`)

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { Object.assign(V2_FEATURES, original) })

describe('con la bandera apagada (por defecto): Mercado Pago Point como hasta hoy', () => {
  it('la bandera parte apagada', () => {
    expect(V2_FEATURES.cobroTarjetaUnificado).toBe(false)
    expect(rutaBaseCobroTarjeta()).toBe('/payments/point')
  })

  it('cobrar, consultar y cancelar van por /payments/point/orders/{id}', async () => {
    apiRequest.mockResolvedValue({ charge_id: 'c-1' })
    await createPointCharge('o-1', { description: 'Mesa 1' })
    await getPointOrderStatus('o-1')
    await cancelPointCharge('o-1')
    expect(rutas()).toEqual([
      'POST /payments/point/orders/o-1/charge',
      'GET /payments/point/orders/o-1/status',
      'DELETE /payments/point/orders/o-1/charge',
    ])
  })
})

describe('con la bandera encendida: el punto único /payments/card', () => {
  beforeEach(() => { V2_FEATURES.cobroTarjetaUnificado = true })

  it('cobrar, consultar y cancelar van por /payments/card/orders/{id}, sin llamadas a /payments/point', async () => {
    apiRequest.mockResolvedValue({ provider: 'mercadopago', charge_id: 'c-1', point_charge_active: true })
    const cobro = await createPointCharge('o-1', { description: 'Mesa 1' })
    await getPointOrderStatus('o-1')
    await cancelPointCharge('o-1')
    expect(rutas()).toEqual([
      'POST /payments/card/orders/o-1/charge',
      'GET /payments/card/orders/o-1/status',
      'DELETE /payments/card/orders/o-1/charge',
    ])
    expect(rutas().some((r) => r.includes('/payments/point/'))).toBe(false)
    // Se sigue el charge_id que devuelve el servidor (T-65).
    expect(cobro.charge_id).toBe('c-1')
  })

  it('si la máquina es Haulmer, cancela el cobro recién creado y avisa que la web no puede cobrar con ella', async () => {
    apiRequest.mockImplementation((ruta, opciones) => Promise.resolve(
      opciones?.method === 'POST' ? { provider: 'haulmer', charge_id: 'h-1' } : null,
    ))
    const error = await createPointCharge('o-1', {}).catch((e) => e)
    expect(error.message).toBe(MENSAJE_HAULMER)
    expect(error.proveedor).toBe('haulmer')
    expect(rutas()).toEqual(['POST /payments/card/orders/o-1/charge', 'DELETE /payments/card/orders/o-1/charge'])
  })

  it('un 409 del backend (la máquina está cobrando otra venta) sube tal cual', async () => {
    apiRequest.mockRejectedValue(new Error('409: La máquina está cobrando otra venta: espera unos segundos y vuelve a intentar'))
    await expect(createPointCharge('o-1', {})).rejects.toThrow('La máquina está cobrando otra venta')
  })
})

describe('T-65 · cobro con el Point', () => {
  it('nunca manda amount', async () => {
    apiRequest.mockResolvedValue({ charge_id: 'c-1' })
    await createPointCharge('o-1', { amount: 9999, description: 'Mesa 1' })
    expect(apiRequest.mock.lastCall[1].body).toEqual({ description: 'Mesa 1' })
  })
  it('el 409 de máquina ocupada es reintentable; el de cobro anterior pide cancelar en el lector', () => {
    const ocupada = errorDeCobroTarjeta({ status: 409, detail: 'La máquina está cobrando otra venta: espera unos segundos y vuelve a intentar' })
    expect(ocupada.reintentable).toBe(true)
    const anterior = errorDeCobroTarjeta({ status: 409, detail: 'Hay un cobro vigente en el lector que no se pudo cancelar' })
    expect(anterior.reintentable).toBeUndefined()
    expect(anterior.message).toMatch(/Cancélalo en el lector o espera/)
  })
})
