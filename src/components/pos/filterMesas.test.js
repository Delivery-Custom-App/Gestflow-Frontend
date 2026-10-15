/** Filtro de mesas por zona (A-05). */
import { describe, it, expect } from 'vitest'
import { EMPTY_MESA_FILTERS, SIN_ZONA, applyFilters, zonasDe } from './filterMesas'

const MESAS = [
  { id: '1', name: 'Mesa 1', zona: 'Terraza', is_active: true, state: 'libre' },
  { id: '2', name: 'Mesa 2', zona: 'Salón', is_active: true, state: 'libre' },
  { id: '3', name: 'Mesa 3', zona: null, is_active: true, state: 'libre' },
]

describe('filtro por zona', () => {
  it('lista las zonas presentes', () => {
    expect(zonasDe(MESAS)).toEqual(['Salón', 'Terraza'])
  })
  it('filtra por una zona o por «Sin zona»', () => {
    expect(applyFilters(MESAS, { ...EMPTY_MESA_FILTERS, zona: 'Terraza' }).map((m) => m.id)).toEqual(['1'])
    expect(applyFilters(MESAS, { ...EMPTY_MESA_FILTERS, zona: SIN_ZONA }).map((m) => m.id)).toEqual(['3'])
    expect(applyFilters(MESAS, EMPTY_MESA_FILTERS)).toHaveLength(3)
  })
})
