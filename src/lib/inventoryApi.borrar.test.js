/** Eliminar del stock y quitar del menú solo en el local (T-29, B-11). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { deleteInventoryItem, removeFromLocalMenu } from './inventoryApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn() }))

beforeEach(() => { vi.clearAllMocks() })

describe('deleteInventoryItem', () => {
  it('llama a DELETE /inventory/{id} y nunca a /products', async () => {
    apiRequest.mockResolvedValue(null)
    await deleteInventoryItem('loc-1', 'inv 1')
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest).toHaveBeenCalledWith('/inventory/inv%201', { method: 'DELETE' })
    expect(apiRequest.mock.calls.some(([p]) => p.startsWith('/products'))).toBe(false)
  })

  it('un 403 se traduce a un mensaje claro', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('403: No autorizado'), { status: 403 }))
    await expect(deleteInventoryItem('loc-1', 'inv-1')).rejects.toThrow('No tienes permiso para quitar productos del stock en este local.')
  })

  it('otros errores pasan tal cual', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('404: no existe'), { status: 404 }))
    await expect(deleteInventoryItem('loc-1', 'inv-1')).rejects.toThrow('404: no existe')
  })
})

describe('removeFromLocalMenu', () => {
  it('llama a DELETE /local-products/{id}', async () => {
    apiRequest.mockResolvedValue(null)
    await removeFromLocalMenu('lp-1')
    expect(apiRequest).toHaveBeenCalledWith('/local-products/lp-1', { method: 'DELETE' })
  })

  it('un 403 se traduce a un mensaje claro', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('403'), { status: 403 }))
    await expect(removeFromLocalMenu('lp-1')).rejects.toThrow(/permiso para quitar productos del menú/)
  })
})
