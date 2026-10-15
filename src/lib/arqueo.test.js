/** Arqueo de caja: diferencia y textos (T-55, T-57). */
import { describe, it, expect } from 'vitest'
import { diferenciaDe, monto, textoDiferencia, tieneArqueo } from './arqueo'

describe('arqueo', () => {
  it('monto convierte el texto del backend y deja null lo que no viene', () => {
    expect(monto('8600.00')).toBe(8600)
    expect(monto('0')).toBe(0)
    expect(monto(null)).toBeNull()
    expect(monto('')).toBeNull()
  })

  it('diferencia = contado − esperado (negativa si falta)', () => {
    expect(diferenciaDe('8600', '8900.00')).toBe(-300)
    expect(diferenciaDe(9100, 8900)).toBe(200)
    expect(diferenciaDe('', 8900)).toBeNull()
  })

  it('textoDiferencia: faltan, sobran o cuadra', () => {
    expect(textoDiferencia('-300.00')).toBe('Faltan $300')
    expect(textoDiferencia(200)).toBe('Sobran $200')
    expect(textoDiferencia('0.00')).toBe('Cuadra')
    expect(textoDiferencia(null)).toBeNull()
  })

  it('una caja cerrada sin monto contado no tiene arqueo', () => {
    expect(tieneArqueo({ monto_cierre_declarado: '8600.00' })).toBe(true)
    expect(tieneArqueo({ monto_cierre_declarado: null })).toBe(false)
  })
})
