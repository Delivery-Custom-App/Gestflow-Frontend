import { useState, useCallback } from 'react'
import { addOrderItem, removeOrderItem, updateOrderItem } from '../lib/salesApi'

/**
 * Agregar, editar y quitar ítems de un pedido. Editar cambia solo la cantidad
 * (el precio lo pone el backend) y quitar usa DELETE (T-30).
 */
export function useOrderItems(orderId, createdAt) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (accion, fallo, siFalla) => {
    if (!orderId) {
      setError('No hay orden activa')
      return siFalla
    }
    setLoading(true)
    setError(null)
    try {
      return await accion()
    } catch (err) {
      setError(err?.message || fallo)
      return siFalla
    } finally {
      setLoading(false)
    }
  }, [orderId])

  const createItem = useCallback(
    (productId, quantity, key) => run(
      () => addOrderItem(orderId, { product_id: productId, quantity: parseInt(quantity, 10) }, createdAt, key),
      'Error al agregar producto',
      null,
    ),
    [run, orderId, createdAt],
  )

  const updateItem = useCallback(
    (itemId, quantity) => run(
      () => updateOrderItem(orderId, itemId, { quantity }, createdAt),
      'No se pudo cambiar la cantidad',
      null,
    ),
    [run, orderId, createdAt],
  )

  const deleteItem = useCallback(
    (itemId) => run(
      () => removeOrderItem(orderId, itemId, createdAt),
      'No se pudo quitar el producto',
      false,
    ),
    [run, orderId, createdAt],
  )

  return { createItem, updateItem, deleteItem, loading, error }
}
