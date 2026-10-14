import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { deleteMesa, listMesasConTotales } from '../lib/salesApi'
import { useMesasConEstado } from './useMesasConEstado'

vi.mock('../lib/salesApi', () => ({
  createMesa: vi.fn(),
  deleteMesa: vi.fn(),
  listMesasConTotales: vi.fn(),
  updateMesa: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useMesasConEstado · dar de baja (T-70)', () => {
  it('pasa el id de la mesa a la API y vuelve a cargar la lista sin ella', async () => {
    listMesasConTotales
      .mockResolvedValueOnce([{ id: 'm1' }, { id: 'm2' }])
      .mockResolvedValueOnce([{ id: 'm1' }])
    deleteMesa.mockResolvedValue(undefined)

    const { result } = renderHook(() => useMesasConEstado('loc-1'))
    await waitFor(() => expect(result.current.mesas).toHaveLength(2))

    await act(() => result.current.deleteMesa('m2'))

    expect(deleteMesa).toHaveBeenCalledWith('m2')
    expect(listMesasConTotales).toHaveBeenCalledTimes(2)
    expect(result.current.mesas).toEqual([{ id: 'm1' }])
  })

  it('si la baja falla, el error sube a quien la pidió y la lista no se recarga', async () => {
    listMesasConTotales.mockResolvedValue([{ id: 'm1' }])
    deleteMesa.mockRejectedValue(new Error('409: La mesa está en uso'))

    const { result } = renderHook(() => useMesasConEstado('loc-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(act(() => result.current.deleteMesa('m1'))).rejects.toThrow('409: La mesa está en uso')
    expect(listMesasConTotales).toHaveBeenCalledTimes(1)
  })
})
