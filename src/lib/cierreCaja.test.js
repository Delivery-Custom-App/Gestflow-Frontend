/** Cierre de caja con conteo (T-55): resumen, medios de pago, turnos sin terminar y cierre anterior. */
import { describe, it, expect } from 'vitest'
import {
  armarResumenCierre, esCajaDigital, medioDePago, turnosSinTerminar, ultimoCierreDeCaja, ventasPorMedio,
} from './cierreCaja'

const MOVIMIENTOS = [
  { tipo: 'ingreso', monto: '8200.00', payment_method: 'cash', order_id: 'o1' },
  { tipo: 'ingreso', monto: '5000.00', payment_method: 'debit', order_id: 'o2' },
  { tipo: 'ingreso', monto: '3000.00', payment_method: 'MERCADOPAGO_POINT_CREDIT', order_id: 'o3' },
  { tipo: 'ingreso', monto: '7000.00', payment_method: 'transfer', order_id: 'o4' },
  { tipo: 'ingreso', monto: '1500.00', payment_method: 'mercadopago', order_id: 'o5' },
  // Un ingreso de caja (sin orden) y un retiro no son ventas.
  { tipo: 'ingreso', monto: '2000.00', payment_method: 'cash', order_id: null },
  { tipo: 'egreso', monto: '10000.00', payment_method: 'cash', order_id: null },
]

describe('medioDePago', () => {
  it('agrupa lo que paga el cliente en efectivo, tarjeta y transferencia', () => {
    expect(medioDePago('cash')).toBe('efectivo')
    expect(medioDePago('Efectivo')).toBe('efectivo')
    expect(medioDePago('debit')).toBe('tarjeta')
    expect(medioDePago('credit')).toBe('tarjeta')
    expect(medioDePago('MERCADOPAGO_POINT')).toBe('tarjeta')
    expect(medioDePago('MERCADOPAGO_POINT_DEBIT')).toBe('tarjeta')
    expect(medioDePago('transfer')).toBe('transferencia')
  })

  it('lo que no calza en ninguno queda aparte, sin esconderlo en otro medio', () => {
    expect(medioDePago('mercadopago')).toBe('otros')
    expect(medioDePago(null)).toBe('otros')
  })
})

describe('ventasPorMedio', () => {
  it('suma solo las ventas (ingresos con orden), por medio', () => {
    expect(ventasPorMedio(MOVIMIENTOS)).toEqual({ efectivo: 8200, tarjeta: 8000, transferencia: 7000, otros: 1500 })
  })

  it('sin movimientos todo es cero', () => {
    expect(ventasPorMedio([])).toEqual({ efectivo: 0, tarjeta: 0, transferencia: 0, otros: 0 })
    expect(ventasPorMedio(undefined)).toEqual({ efectivo: 0, tarjeta: 0, transferencia: 0, otros: 0 })
  })
})

describe('armarResumenCierre', () => {
  const RESUMEN = {
    monto_apertura: '50000.00', ingresos_manuales: '2000.00', total_egresos: '10000.00', efectivo_esperado: '50200.00',
  }

  it('usa los montos del backend y compara lo contado con el efectivo esperado', () => {
    const r = armarResumenCierre({ resumen: RESUMEN, movimientos: MOVIMIENTOS, contado: 50000 })
    expect(r).toEqual({
      fondo: 50000,
      ventas: { efectivo: 8200, tarjeta: 8000, transferencia: 7000, otros: 1500 },
      ingresosCaja: 2000,
      retiros: 10000,
      esperado: 50200,
      contado: 50000,
      diferencia: -200,
    })
  })

  it('sin conteo no hay diferencia; sin movimientos las ventas quedan sin dato', () => {
    const r = armarResumenCierre({ resumen: RESUMEN })
    expect(r.contado).toBeNull()
    expect(r.diferencia).toBeNull()
    expect(r.ventas).toBeNull()
  })
})

describe('esCajaDigital', () => {
  it('solo la de tipo digital', () => {
    expect(esCajaDigital({ tipo: 'digital' })).toBe(true)
    expect(esCajaDigital({ tipo: 'fisica' })).toBe(false)
    expect(esCajaDigital(null)).toBe(false)
  })
})

describe('turnosSinTerminar', () => {
  const CAJAS = [
    { id: 'a', status: 'open', caja_fisica_id: 'cf1', local_id: 'l1', turno_terminado_at: null, opened_at: '2026-10-17T13:00:00Z' },
    { id: 'b', status: 'open', caja_fisica_id: 'cf1', local_id: 'l1', turno_terminado_at: '2026-10-17T20:00:00Z' },
    { id: 'c', status: 'closed', caja_fisica_id: 'cf1', local_id: 'l1', turno_terminado_at: null },
    { id: 'd', status: 'open', caja_fisica_id: 'cf2', local_id: 'l1', turno_terminado_at: null },
    { id: 'e', status: 'open', caja_fisica_id: 'cf1', local_id: 'l1', turno_terminado_at: null, opened_at: '2026-10-17T09:00:00Z' },
  ]

  it('son los abiertos de esa caja física que no terminaron, del más antiguo al más nuevo', () => {
    expect(turnosSinTerminar(CAJAS, { cajaFisicaId: 'cf1', localId: 'l1' }).map((c) => c.id)).toEqual(['e', 'a'])
  })

  it('sin caja física o sin lista no devuelve nada raro', () => {
    expect(turnosSinTerminar(null, { cajaFisicaId: 'cf1' })).toEqual([])
    expect(turnosSinTerminar(CAJAS, { cajaFisicaId: 'cf9' })).toEqual([])
  })
})

describe('ultimoCierreDeCaja', () => {
  const CAJAS = [
    { status: 'closed', caja_fisica_id: 'cf1', closed_at: '2026-10-15T23:00:00Z', business_date: '2026-10-15', monto_cierre_declarado: '30000.00' },
    { status: 'closed', caja_fisica_id: 'cf1', closed_at: '2026-10-16T23:00:00Z', business_date: '2026-10-16', monto_cierre_declarado: '48200.00' },
    { status: 'closed', caja_fisica_id: 'cf2', closed_at: '2026-10-17T23:00:00Z', business_date: '2026-10-17', monto_cierre_declarado: '1000.00' },
    { status: 'open', caja_fisica_id: 'cf1', closed_at: null },
  ]

  it('es lo contado al cerrar el último turno de esa caja física', () => {
    expect(ultimoCierreDeCaja(CAJAS, 'cf1')).toEqual({ contado: 48200, closedAt: '2026-10-16T23:00:00Z', businessDate: '2026-10-16' })
  })

  it('si el último turno se cerró sin contar, no se usa un conteo más viejo', () => {
    const sinContar = [...CAJAS, { status: 'closed', caja_fisica_id: 'cf1', closed_at: '2026-10-17T10:00:00Z', monto_cierre_declarado: null }]
    expect(ultimoCierreDeCaja(sinContar, 'cf1')).toBeNull()
  })

  it('una caja que nunca se cerró no tiene cierre anterior', () => {
    expect(ultimoCierreDeCaja(CAJAS, 'cf9')).toBeNull()
    expect(ultimoCierreDeCaja(undefined, 'cf1')).toBeNull()
  })
})
