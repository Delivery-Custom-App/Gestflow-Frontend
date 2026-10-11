import { describe, it, expect } from 'vitest'
import { formatCantidad } from './utils'

describe('formatCantidad', () => {
  it('el decimal entero del backend se ve como entero', () => {
    expect(formatCantidad('1.000')).toBe('1')
    expect(formatCantidad('2.000')).toBe('2')
    expect(formatCantidad(1)).toBe('1')
  })

  it('la fracción usa coma y sin ceros sobrantes', () => {
    expect(formatCantidad('0.500')).toBe('0,5')
    expect(formatCantidad('1.250')).toBe('1,25')
    expect(formatCantidad('0.125')).toBe('0,125')
  })

  it('vacío o nulo da 0', () => {
    expect(formatCantidad(null)).toBe('0')
    expect(formatCantidad(undefined)).toBe('0')
  })
})
