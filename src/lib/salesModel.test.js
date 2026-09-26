import { describe, it, expect } from 'vitest'
import { normalizeSalesModel, isAlPasoLocal, SALES_MODEL } from './salesModel'

describe('normalizeSalesModel', () => {
  it('reconoce RESTAURANT y variantes', () => {
    expect(normalizeSalesModel('RESTAURANT')).toBe(SALES_MODEL.RESTAURANT)
    expect(normalizeSalesModel('restaurante')).toBe(SALES_MODEL.RESTAURANT)
    expect(normalizeSalesModel('  Restaurante  ')).toBe(SALES_MODEL.RESTAURANT)
  })

  it('reconoce AL_PASO y variantes', () => {
    expect(normalizeSalesModel('AL_PASO')).toBe(SALES_MODEL.AL_PASO)
    expect(normalizeSalesModel('al paso')).toBe(SALES_MODEL.AL_PASO)
    expect(normalizeSalesModel('takeaway')).toBe(SALES_MODEL.AL_PASO)
  })

  it('valor desconocido o vacío → null', () => {
    expect(normalizeSalesModel('otra-cosa')).toBeNull()
    expect(normalizeSalesModel('')).toBeNull()
    expect(normalizeSalesModel(null)).toBeNull()
    expect(normalizeSalesModel(undefined)).toBeNull()
  })
})

describe('isAlPasoLocal', () => {
  it('null/undefined → false', () => {
    expect(isAlPasoLocal(null)).toBe(false)
    expect(isAlPasoLocal(undefined)).toBe(false)
  })

  it('acepta un string de modelo directamente', () => {
    expect(isAlPasoLocal('AL_PASO')).toBe(true)
    expect(isAlPasoLocal('RESTAURANT')).toBe(false)
  })

  it('acepta un objeto local con sales_model', () => {
    expect(isAlPasoLocal({ sales_model: 'AL_PASO' })).toBe(true)
    expect(isAlPasoLocal({ sales_model: 'RESTAURANT' })).toBe(false)
    expect(isAlPasoLocal({ sales_model: null })).toBe(false)
  })
})
