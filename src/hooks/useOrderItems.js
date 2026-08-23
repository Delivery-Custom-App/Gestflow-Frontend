import { useState, useCallback } from 'react'
import { addOrderItem } from '../lib/salesApi'

export function useOrderItems(orderId, createdAt) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const createItem = useCallback(
    async (productId, quantity, unitPrice) => {
      if (!orderId) {
        setError('No hay orden activa')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        return await addOrderItem(
          orderId,
          {
            product_id: productId,
            quantity: parseInt(quantity, 10),
            unit_price: parseFloat(unitPrice),
          },
          createdAt,
        )
      } catch (err) {
        setError(err.message || 'Error al agregar producto')
        return null
      } finally {
        setLoading(false)
      }
    },
    [orderId, createdAt],
  )

  const updateItem = useCallback(async () => {
    setError('Editar ítems de orden aún no está disponible en Backend V2')
    return null
  }, [])

  const deleteItem = useCallback(async () => {
    setError('Eliminar ítems de orden aún no está disponible en Backend V2')
    return false
  }, [])

  return { createItem, updateItem, deleteItem, loading, error }
}
