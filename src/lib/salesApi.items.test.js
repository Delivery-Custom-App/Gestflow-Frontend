/** Ítems del pedido: editar la cantidad y quitar sin mandar el precio (T-30). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest } from './apiClient'
import { addOrderItem, removeOrderItem, updateOrderItem } from './salesApi'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn(), getOptionalAuthContext: vi.fn() }))

const CREADO = '2026-10-14T12:00:00Z'
const qs = `?created_at=${encodeURIComponent(CREADO)}`

beforeEach(() => { vi.clearAllMocks() })

describe('updateOrderItem', () => {
  it('PATCH /orders/{id}/items/{item_id} solo con la cantidad', async () => {
    apiRequest.mockResolvedValue({ id: 'it-1', quantity: '3.000' })
    await updateOrderItem('ord-1', 'it-1', { quantity: 3 }, CREADO)
    expect(apiRequest).toHaveBeenCalledWith(`/orders/ord-1/items/it-1${qs}`, { method: 'PATCH', body: { quantity: 3 } })
  })

  it('nunca manda unit_price aunque venga', async () => {
    apiRequest.mockResolvedValue({})
    await updateOrderItem('ord-1', 'it-1', { quantity: 2, unit_price: 999 }, CREADO)
    expect(apiRequest.mock.calls[0][1].body).not.toHaveProperty('unit_price')
  })

  it('manda la nota solo si viene (A-06)', async () => {
    apiRequest.mockResolvedValue({})
    await updateOrderItem('ord-1', 'it-1', { notes: 'sin cebolla' }, CREADO)
    expect(apiRequest.mock.calls[0][1].body).toEqual({ notes: 'sin cebolla' })
  })

  it('el 400 de orden cerrada se muestra como «El pedido ya está cerrado»', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('400: No se pueden editar ítems de una orden cerrada'), {
      status: 400, detail: 'No se pueden editar ítems de una orden cerrada',
    }))
    await expect(updateOrderItem('ord-1', 'it-1', { quantity: 2 }, CREADO)).rejects.toThrow('El pedido ya está cerrado')
  })

  it('otros errores pasan tal cual', async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error('409: otra cosa'), { status: 409, detail: 'otra cosa' }))
    await expect(updateOrderItem('ord-1', 'it-1', { quantity: 2 }, CREADO)).rejects.toThrow('409: otra cosa')
  })
})

describe('removeOrderItem', () => {
  it('DELETE /orders/{id}/items/{item_id} devuelve X-Order-Total si está presente', async () => {
    apiRequest.mockResolvedValue({ data: null, orderTotal: 750 })
    await expect(removeOrderItem('ord-1', 'it-1', CREADO)).resolves.toEqual({ orderTotal: 750 })
    expect(apiRequest).toHaveBeenCalledWith(`/orders/ord-1/items/it-1${qs}`, { method: 'DELETE', withOrderTotal: true })
  })

  it('devuelve null si falta X-Order-Total para que la pantalla pueda recargar', async () => {
    apiRequest.mockResolvedValue({ data: null, orderTotal: null })
    await expect(removeOrderItem('ord-1', 'it-1', CREADO)).resolves.toEqual({ orderTotal: null })
  })
})

describe('addOrderItem', () => {
  it('ya no manda unit_price: el precio lo pone el backend', async () => {
    apiRequest.mockResolvedValue({})
    await addOrderItem('ord-1', { product_id: 'p1', quantity: 2, unit_price: 1500 }, CREADO)
    expect(apiRequest).toHaveBeenCalledWith(`/orders/ord-1/items${qs}`, { method: 'POST', body: { product_id: 'p1', quantity: 2 } })
  })
})
