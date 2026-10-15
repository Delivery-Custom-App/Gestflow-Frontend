/** Orden y color de las categorías (A-08). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { cambiarColorCategoria, esColorValido, guardarOrden, moverCategoria, ordenarCategorias } from './categoriasOrden'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

const CATS = [
  { id: 'a', name: 'Postres', sort_order: 30 },
  { id: 'b', name: 'Bebidas', sort_order: 10 },
  { id: 'c', name: 'Fondos', sort_order: 10 },
]

beforeEach(() => { vi.clearAllMocks() })

describe('categoriasOrden', () => {
  it('ordena por sort_order y, a igual orden, por nombre', () => {
    expect(ordenarCategorias(CATS).map((c) => c.id)).toEqual(['b', 'c', 'a'])
  })
  it('subir y bajar renumera de a 10 y solo devuelve lo que cambió', () => {
    expect(moverCategoria(CATS, 'a', 'arriba')).toEqual([{ id: 'a', sort_order: 20 }, { id: 'c', sort_order: 30 }])
    expect(moverCategoria(CATS, 'b', 'arriba')).toEqual([])
  })
  it('guarda cada cambio con PATCH sort_order', async () => {
    apiRequest.mockResolvedValue({})
    await guardarOrden([{ id: 'a', sort_order: 20 }])
    expect(apiRequest).toHaveBeenCalledWith('/categories/a', { method: 'PATCH', body: { sort_order: 20 } })
  })
  it('el color es #RRGGBB en mayúsculas; null lo quita', async () => {
    expect(esColorValido('#ff8800')).toBe(true)
    expect(esColorValido('#fff')).toBe(false)
    expect(esColorValido('rojo')).toBe(false)
    apiRequest.mockResolvedValue({})
    await cambiarColorCategoria('a', '#ff8800')
    await cambiarColorCategoria('a', null)
    expect(apiRequest.mock.calls.map(([, o]) => o.body)).toEqual([{ color: '#FF8800' }, { color: null }])
  })
})
