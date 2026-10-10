import { describe, it, expect } from 'vitest'
import { formatCLP, formatCLPDisplay } from './formatCLP'

describe('formatCLP', () => {
  it('el Decimal en string del backend se formatea sin decimales', () => {
    expect(formatCLP('2500.00')).toBe('2.500')
    expect(formatCLPDisplay('2500.00')).toBe('$2.500')
  })

  it('números y cero', () => {
    expect(formatCLPDisplay(1990)).toBe('$1.990')
    expect(formatCLPDisplay('0')).toBe('$0')
  })

  it('redondea a entero y tolera nulos', () => {
    expect(formatCLP(2100.84)).toBe('2.101')
    expect(formatCLP(null)).toBe('0')
  })
})
