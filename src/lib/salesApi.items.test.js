/** Ítems del pedido: editar la cantidad y quitar sin mandar el precio (T-30). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiRequest, getOptionalAuthContext } from './apiClient'
import { addOrderItem, createOrder, listOrderItems, listPedidosSinCobrarDelTurno, removeOrderItem, updateOrderItem } from './salesApi'
import { traducirErrorIdempotencia } from './idempotency'

vi.mock('./apiClient', () => ({ apiRequest: vi.fn(), getOptionalAuthContext: vi.fn() }))
vi.mock('./v2CatalogApi', () => ({ fetchProductsMap: vi.fn(() => Promise.resolve(new Map([['p-viejo', { name: 'Nombre del catálogo' }]]))) }))

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

describe('A-06 · notas y datos de la respuesta', () => {
  it('agregar un ítem manda la nota (vacía no se manda)', async () => {
    apiRequest.mockResolvedValue({})
    await addOrderItem('ord-1', { product_id: 'p1', quantity: 1, notes: '  sin cebolla ' }, CREADO)
    expect(apiRequest.mock.calls[0][1].body).toEqual({ product_id: 'p1', quantity: 1, notes: 'sin cebolla' })
    await addOrderItem('ord-1', { product_id: 'p1', quantity: 1, notes: '  ' }, CREADO)
    expect(apiRequest.mock.calls[1][1].body).toEqual({ product_id: 'p1', quantity: 1 })
  })

  it('editar la nota vacía la borra con null', async () => {
    apiRequest.mockResolvedValue({})
    await updateOrderItem('ord-1', 'it-1', { notes: null }, CREADO)
    expect(apiRequest.mock.calls[0][1].body).toEqual({ notes: null })
  })

  it('el nombre sale de product_name del ítem (el de cuando se agregó), no del catálogo', async () => {
    apiRequest.mockResolvedValue([{ id: 'i1', product_id: 'p1', product_name: 'Nombre guardado', notes: 'sin sal', quantity: '1', unit_price: '1000', subtotal: '1000' }])
    const items = await listOrderItems('ord-1', CREADO)
    expect(items[0]).toMatchObject({ product_name: 'Nombre guardado', item_name: 'Nombre guardado', notes: 'sin sal' })
  })

  it('un ítem antiguo sin product_name usa el catálogo', async () => {
    apiRequest.mockResolvedValue([{ id: 'i1', product_id: 'p-viejo', quantity: '1', unit_price: '1000' }])
    const items = await listOrderItems('ord-1', CREADO)
    expect(items[0].product_name).toBe('Nombre del catálogo')
  })

  it('crear un pedido toma el total de order_total del último ítem', async () => {
    getOptionalAuthContext.mockResolvedValue({ user: { id: 'u1' } })
    apiRequest
      .mockResolvedValueOnce({ id: 'ord-9', created_at: CREADO, total: '0' })
      .mockResolvedValueOnce({ id: 'i1', subtotal: '1000', order_total: '1000.00' })
      .mockResolvedValueOnce({ id: 'i2', subtotal: '2500', order_total: '3500.00' })
    const orden = await createOrder({ local_id: 'loc-1', caja_id: 'c1', items: [{ product_id: 'p1', quantity: 1, notes: 'sin hielo' }, { product_id: 'p2', quantity: 1 }] })
    expect(orden.total).toBe(3500)
    expect(apiRequest.mock.calls[1][1].body).toMatchObject({ notes: 'sin hielo' })
  })
})

describe('una venta que falla a medias (#159)', () => {
  const falla = Object.assign(new Error('400: El producto no está activo en este local'), { status: 400 })

  it('si un producto falla, el pedido recién creado se cancela y el error lo dice', async () => {
    apiRequest
      .mockResolvedValueOnce({ id: 'ord-9', created_at: CREADO, total: '0' })
      .mockResolvedValueOnce({ id: 'i1', order_total: '1800.00' })
      .mockRejectedValueOnce(falla)
      .mockResolvedValueOnce({ id: 'ord-9', status: 'cancelled' })
    const error = await createOrder({ local_id: 'loc-1', caja_id: 'c1', items: [{ product_id: 'p1', quantity: 1 }, { product_id: 'p2', quantity: 1 }] }).catch((e) => e)
    expect(error.message).toBe('400: El producto no está activo en este local')
    expect(error.pedidoCancelado).toBe(true)
    expect(apiRequest).toHaveBeenLastCalledWith(`/orders/ord-9${qs}`, { method: 'PATCH', body: { status: 'cancelled' } })
  })

  it('si tampoco se puede cancelar, el error lo avisa con pedidoCancelado en false', async () => {
    apiRequest
      .mockResolvedValueOnce({ id: 'ord-9', created_at: CREADO, total: '0' })
      .mockRejectedValueOnce(falla)
      .mockRejectedValueOnce(new Error('sin conexión'))
    const error = await createOrder({ local_id: 'loc-1', caja_id: 'c1', items: [{ product_id: 'p1', quantity: 1 }] }).catch((e) => e)
    expect(error.pedidoCancelado).toBe(false)
  })

  it('el 409 de la clave de idempotencia se explica y pide una clave nueva', () => {
    const e = traducirErrorIdempotencia(Object.assign(new Error('409: Esa Idempotency-Key ya se usó con otra operación u otros datos'), { status: 409 }))
    expect(e.message).toBe('Esta venta ya se había enviado con otros productos. Vuelve a intentarlo: se enviará como una nueva.')
    expect(e.claveUsada).toBe(true)
    const otro = Object.assign(new Error('409: La mesa tiene un pedido en curso'), { status: 409 })
    expect(traducirErrorIdempotencia(otro)).toBe(otro)
  })

  it('los pedidos sin cobrar del turno son los abiertos sin mesa', async () => {
    apiRequest.mockResolvedValueOnce({ data: [{ id: 'o1', status: 'open', mesa_id: null }, { id: 'o2', status: 'open', mesa_id: 'm1' }], total: 2 })
    const pedidos = await listPedidosSinCobrarDelTurno('caja-1')
    expect(pedidos.map((p) => p.id)).toEqual(['o1'])
    expect(apiRequest.mock.calls[0][0]).toContain('caja_id=caja-1')
    expect(apiRequest.mock.calls[0][0]).toContain('status=open&status=preparing&status=ready')
  })
})
