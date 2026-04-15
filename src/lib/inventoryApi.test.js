import { describe, it, expect } from 'vitest'
import { buildInventoryStockListPath } from './inventoryApi'

describe('buildInventoryStockListPath', () => {
  const local = '11111111-1111-1111-1111-111111111111'
  const cat = '22222222-2222-2222-2222-222222222222'

  it('sin filtros', () => {
    expect(buildInventoryStockListPath(local)).toBe(`/inventory/locals/${local}/stock`)
  })

  it('category y search', () => {
    const path = buildInventoryStockListPath(local, { category: cat, search: 'arroz' })
    expect(path).toContain('category=')
    expect(path).toContain('search=')
  })

  it('repite status en la query cuando hay varios', () => {
    const path = buildInventoryStockListPath(local, { status: ['CRITICO', 'BAJO'] })
    expect(path).toContain('status=CRITICO')
    expect(path).toContain('status=BAJO')
    expect(path.split('status=').length - 1).toBe(2)
  })

  it('combina status con category', () => {
    const path = buildInventoryStockListPath(local, {
      category: cat,
      status: ['OPTIMO'],
    })
    expect(path).toContain(`category=${encodeURIComponent(cat)}`)
    expect(path).toContain('status=OPTIMO')
  })
})
