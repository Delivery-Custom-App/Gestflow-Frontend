import { describe, it, expect } from 'vitest'
import { validateChilePhoneMessage, validateChileRutMessage } from './chileRut'

describe('validateChileRutMessage', () => {
  it('acepta RUT válido con formato', () => {
    expect(validateChileRutMessage('12.345.678-5')).toBeNull()
  })

  it('acepta RUT sin puntos', () => {
    expect(validateChileRutMessage('123456785')).toBeNull()
  })

  it('rechaza DV incorrecto', () => {
    expect(validateChileRutMessage('12.345.678-0')).toMatch(/verificador/i)
  })
})

describe('validateChilePhoneMessage', () => {
  it('acepta teléfono con dígitos suficientes', () => {
    expect(validateChilePhoneMessage('+56 9 1234 5678')).toBeNull()
  })

  it('rechaza corto', () => {
    expect(validateChilePhoneMessage('123')).toMatch(/8 y 15/)
  })
})
