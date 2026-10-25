import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { deleteMesa, listMesasConTotales } from '../lib/salesApi'
import { MESAS_REFRESCO_MS, useMesasConEstado } from './useMesasConEstado'

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

describe('useMesasConEstado · se refresca sola (#157)', () => {
  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  async function montar(opciones) {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const hook = renderHook(() => useMesasConEstado('loc-1', opciones))
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    return hook
  }

  it('con poll, cada 30 segundos trae la mesa que abrió otro compañero, sin spinner', async () => {
    listMesasConTotales
      .mockResolvedValueOnce([{ id: 'm2', state: 'libre' }])
      .mockResolvedValueOnce([{ id: 'm2', state: 'ocupada' }])
    const { result } = await montar({ poll: true })
    const estados = []
    await act(async () => {
      vi.advanceTimersByTime(MESAS_REFRESCO_MS)
      estados.push(result.current.loading)
    })
    await waitFor(() => expect(result.current.mesas).toEqual([{ id: 'm2', state: 'ocupada' }]))
    expect(estados).toEqual([false])
  })

  it('sin poll no consulta de nuevo', async () => {
    listMesasConTotales.mockResolvedValue([{ id: 'm1' }])
    await montar()
    await act(async () => { vi.advanceTimersByTime(MESAS_REFRESCO_MS * 2) })
    expect(listMesasConTotales).toHaveBeenCalledTimes(1)
  })

  it('con la pestaña oculta no consulta, y al volver a ella refresca enseguida', async () => {
    listMesasConTotales.mockResolvedValue([{ id: 'm1' }])
    await montar({ poll: true })
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await act(async () => { vi.advanceTimersByTime(MESAS_REFRESCO_MS) })
    expect(listMesasConTotales).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(listMesasConTotales).toHaveBeenCalledTimes(2)
  })

  it('si un refresco de fondo falla, la grilla queda como estaba y sin error', async () => {
    listMesasConTotales
      .mockResolvedValueOnce([{ id: 'm1' }])
      .mockRejectedValueOnce(new Error('500: caído'))
    const { result } = await montar({ poll: true })
    await act(async () => { vi.advanceTimersByTime(MESAS_REFRESCO_MS) })
    await waitFor(() => expect(listMesasConTotales).toHaveBeenCalledTimes(2))
    expect(result.current.mesas).toEqual([{ id: 'm1' }])
    expect(result.current.error).toBeNull()
  })
})
