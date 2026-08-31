import { describe, it, expect } from 'vitest'
import { calcItemPrice, isCompleto, norm, productKey, AGREGADOS, EMBUTIDO_SURCHARGE } from './menuPricing'

describe('calcItemPrice', () => {
  it('sin customización devuelve el precio base', () => {
    expect(calcItemPrice(5000, null)).toBe(5000)
  })

  it('sin embutido ni agregados devuelve el precio base', () => {
    expect(calcItemPrice(5000, { embutido: null, agregados: [] })).toBe(5000)
  })

  it('suma el recargo de embutido', () => {
    expect(calcItemPrice(5000, { embutido: 'Lomito', agregados: [] })).toBe(5000 + EMBUTIDO_SURCHARGE)
  })

  it('suma el precio de cada agregado seleccionado', () => {
    const [a1, a2] = AGREGADOS
    const price = calcItemPrice(5000, { embutido: null, agregados: [a1.label, a2.label] })
    expect(price).toBe(5000 + a1.price + a2.price)
  })

  it('suma embutido y agregados juntos', () => {
    const [a1] = AGREGADOS
    const price = calcItemPrice(5000, { embutido: 'Churrasco', agregados: [a1.label] })
    expect(price).toBe(5000 + EMBUTIDO_SURCHARGE + a1.price)
  })
})

describe('isCompleto', () => {
  it('true para receta en categoría "Completos"', () => {
    expect(isCompleto({ type: 'recipe', categoryName: 'Completos' })).toBe(true)
  })

  it('false para receta fuera de "Completos"', () => {
    expect(isCompleto({ type: 'recipe', categoryName: 'Sandwiches' })).toBe(false)
  })

  it('false para producto simple (no receta)', () => {
    expect(isCompleto({ type: 'product', categoryName: 'Completos' })).toBe(false)
  })
})

describe('norm / productKey', () => {
  it('norm quita tildes y normaliza mayúsculas', () => {
    expect(norm('Champiñón')).toBe('champinon')
  })

  it('productKey prefija el id', () => {
    expect(productKey('abc-123')).toBe('p:abc-123')
  })
})
