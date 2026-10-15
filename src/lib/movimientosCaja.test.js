/** Retiros, gastos e ingresos de caja (T-56). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { mensajeMovimientoCaja, registrarMovimientoCaja, validarMovimientoCaja } from './movimientosCaja'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

beforeEach(() => { vi.clearAllMocks() })

describe('validarMovimientoCaja', () => {
  it('un egreso necesita una nota de al menos 3 caracteres', () => {
    expect(validarMovimientoCaja({ tipo: 'egreso', monto: 1000, note: '' })).toMatch(/para qué salió la plata/)
    expect(validarMovimientoCaja({ tipo: 'egreso', monto: 1000, note: 'ab' })).toMatch(/nota/)
    expect(validarMovimientoCaja({ tipo: 'egreso', monto: 1000, note: 'Hielo' })).toBeNull()
  })
  it('en un ingreso la nota es opcional', () => {
    expect(validarMovimientoCaja({ tipo: 'ingreso', monto: 500, note: '' })).toBeNull()
  })
  it('el monto debe ser mayor que 0 y la nota de hasta 200', () => {
    expect(validarMovimientoCaja({ tipo: 'ingreso', monto: 0 })).toMatch(/mayor que 0/)
    expect(validarMovimientoCaja({ tipo: 'ingreso', monto: 10, note: 'x'.repeat(201) })).toMatch(/200/)
  })
})

describe('registrarMovimientoCaja', () => {
  it('POST /cajas/{id}/movimientos con tipo, monto, nota y método', async () => {
    apiRequest.mockResolvedValue({ id: 'm1' })
    await registrarMovimientoCaja('caja-1', { tipo: 'egreso', monto: 1000, note: ' Compra de hielo ', payment_method: 'cash' })
    expect(apiRequest).toHaveBeenCalledWith('/cajas/caja-1/movimientos', {
      method: 'POST', body: { tipo: 'egreso', monto: '1000.00', note: 'Compra de hielo', payment_method: 'cash' },
    })
  })
  it('un ingreso sin nota no manda note', async () => {
    apiRequest.mockResolvedValue({})
    await registrarMovimientoCaja('caja-1', { tipo: 'ingreso', monto: 500 })
    expect(apiRequest.mock.calls[0][1].body).toEqual({ tipo: 'ingreso', monto: '500.00', payment_method: 'cash' })
  })
})

describe('mensajeMovimientoCaja', () => {
  it('el 400 de caja cerrada se muestra sin el código', () => {
    expect(mensajeMovimientoCaja(Object.assign(new Error('400: La caja ya está cerrada'), { status: 400, detail: 'La caja ya está cerrada' })))
      .toBe('La caja ya está cerrada')
  })
  it('un 403 explica quién puede', () => {
    expect(mensajeMovimientoCaja({ status: 403 })).toMatch(/administrador del local o el dueño/)
  })
})
