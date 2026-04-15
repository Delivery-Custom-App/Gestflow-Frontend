import { describe, it, expect } from 'vitest'
import { buildInventoryStockListPath } from './inventoryApi'

describe('buildInventoryStockListPath (HU-47 filtros)', () => {
  const local = '11111111-1111-1111-1111-111111111111'
  const cat = '22222222-2222-2222-2222-222222222222'

  it('sin filtros: solo path base', () => {
    expect(buildInventoryStockListPath(local)).toBe(`/inventory/locals/${local}/stock`)
  })

  it('incluye category', () => {
    expect(buildInventoryStockListPath(local, { category: cat })).toBe(
      `/inventory/locals/${local}/stock?category=${encodeURIComponent(cat)}`,
    )
  })

  it('incluye search recortado', () => {
    expect(buildInventoryStockListPath(local, { search: '  arroz  ' })).toBe(
      `/inventory/locals/${local}/stock?search=${encodeURIComponent('arroz')}`,
    )
  })

  it('combina category y search', () => {
    const path = buildInventoryStockListPath(local, { category: cat, search: 'leche' })
    expect(path).toContain(`category=${encodeURIComponent(cat)}`)
    expect(path).toContain(`search=${encodeURIComponent('leche')}`)
    expect(path.startsWith(`/inventory/locals/${local}/stock?`)).toBe(true)
  })

  it('omite search vacío', () => {
    expect(buildInventoryStockListPath(local, { search: '   ' })).toBe(`/inventory/locals/${local}/stock`)
  })
})
