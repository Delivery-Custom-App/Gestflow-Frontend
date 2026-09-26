import { describe, it, expect } from 'vitest'
import { formatShortAddress } from './formatAddress'

describe('formatShortAddress', () => {
  it('vacío/null/undefined → ""', () => {
    expect(formatShortAddress('')).toBe('')
    expect(formatShortAddress(null)).toBe('')
    expect(formatShortAddress(undefined)).toBe('')
  })

  it('descarta segmentos de población/región/país', () => {
    const addr = 'Av. Siempre Viva 742, Población Los Aromos, Región Metropolitana, Chile'
    expect(formatShortAddress(addr)).toBe('Av. Siempre Viva 742')
  })

  it('descarta códigos postales numéricos largos', () => {
    const addr = 'Calle 1, 8320000, Santiago'
    expect(formatShortAddress(addr)).toBe('Calle 1, Santiago')
  })

  it('toma máximo 3 partes', () => {
    const addr = 'A, B, C, D, E'
    expect(formatShortAddress(addr)).toBe('A, B, C')
  })

  it('recorta espacios y descarta vacíos', () => {
    const addr = 'A,  , B ,, C'
    expect(formatShortAddress(addr)).toBe('A, B, C')
  })
})
