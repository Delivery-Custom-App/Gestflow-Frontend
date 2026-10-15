/** Mesas no cobradas (T-46): consulta paginada, total y rango. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { listarNoCobradas, totalNoCobrado, validarRango } from './noCobradas'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

beforeEach(() => { vi.clearAllMocks() })

describe('listarNoCobradas', () => {
  it('pide GET /cajas/no-cobradas con local, desde, hasta y el total', async () => {
    apiRequest.mockResolvedValue({ data: [{ evento_id: 'e1', total: '4400.00' }], total: 1 })
    const filas = await listarNoCobradas('loc-1', { desde: '2026-10-10', hasta: '2026-10-14' })
    expect(apiRequest).toHaveBeenCalledWith('/cajas/no-cobradas?local_id=loc-1&limit=500&offset=0&desde=2026-10-10&hasta=2026-10-14', { withTotal: true })
    expect(filas).toHaveLength(1)
  })

  it('si hay más de 500, sigue pidiendo hasta completar', async () => {
    const lote = (n, desde) => Array.from({ length: n }, (_, i) => ({ evento_id: `e${desde + i}`, total: '1' }))
    apiRequest
      .mockResolvedValueOnce({ data: lote(500, 0), total: 620 })
      .mockResolvedValueOnce({ data: lote(120, 500), total: 620 })
    const filas = await listarNoCobradas('loc-1', {})
    expect(filas).toHaveLength(620)
    expect(apiRequest.mock.calls[1][0]).toContain('offset=500')
  })
})

describe('cálculos', () => {
  it('suma lo no cobrado', () => {
    expect(totalNoCobrado([{ total: '4400.00' }, { total: '1600.50' }])).toBe(6000.5)
  })
  it('«desde» no puede ser posterior a «hasta»', () => {
    expect(validarRango({ desde: '2026-10-15', hasta: '2026-10-14' })).toMatch(/posterior/)
    expect(validarRango({ desde: '2026-10-14', hasta: '2026-10-14' })).toBeNull()
  })
})
