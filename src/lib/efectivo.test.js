import { describe, it, expect } from 'vitest'
import {
  DENOMINACIONES, cantidadDesdeTexto, etiquetaDenominacion, filasDelDesglose, totalesDelConteo,
} from './efectivo'

describe('efectivo', () => {
  it('billetes de $20.000 a $1.000 y monedas de $500 a $10, de mayor a menor', () => {
    expect(DENOMINACIONES.filter((d) => d.tipo === 'billete').map((d) => d.valor)).toEqual([20000, 10000, 5000, 2000, 1000])
    expect(DENOMINACIONES.filter((d) => d.tipo === 'moneda').map((d) => d.valor)).toEqual([500, 100, 50, 10])
  })

  it('etiqueta con signo y puntos de miles', () => {
    expect(etiquetaDenominacion(20000)).toBe('$20.000')
    expect(etiquetaDenominacion(50)).toBe('$50')
  })

  it('la cantidad escrita solo acepta enteros desde 0; vacío es 0', () => {
    expect(cantidadDesdeTexto('')).toBe(0)
    expect(cantidadDesdeTexto('12')).toBe(12)
    expect(cantidadDesdeTexto('-3')).toBe(3)
    expect(cantidadDesdeTexto('2,5')).toBe(25)
    expect(cantidadDesdeTexto('abc')).toBe(0)
  })

  it('subtotal por fila y totales de billetes, monedas y general', () => {
    const t = totalesDelConteo({ 20000: 2, 1000: 3, 500: 4, 10: 5 })
    expect(t.filas.find((f) => f.valor === 20000).subtotal).toBe(40000)
    expect(t.filas.find((f) => f.valor === 5000).subtotal).toBe(0)
    expect(t.totalBilletes).toBe(43000)
    expect(t.totalMonedas).toBe(2050)
    expect(t.total).toBe(45050)
  })

  it('sin nada contado el total es 0; cantidades inválidas cuentan como 0', () => {
    expect(totalesDelConteo({}).total).toBe(0)
    expect(totalesDelConteo({ 1000: -2, 500: 1.5, 100: 'x' }).total).toBe(0)
  })

  it('el desglose que devuelve el backend se ordena de mayor a menor con su subtotal', () => {
    expect(filasDelDesglose([
      { denominacion: 100, tipo: 'moneda', cantidad: 7 },
      { denominacion: '10000', tipo: 'billete', cantidad: '1' },
      { denominacion: 50, tipo: 'moneda', cantidad: 0 },
    ])).toEqual([
      { valor: 10000, tipo: 'billete', cantidad: 1, subtotal: 10000 },
      { valor: 100, tipo: 'moneda', cantidad: 7, subtotal: 700 },
    ])
    expect(filasDelDesglose(null)).toEqual([])
  })
})
