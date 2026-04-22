import { useState, useCallback } from 'react'
import { getAuthContext } from '../lib/apiClient'

/**
 * Hook para manejar orden de productos
 * CRUD para order_items
 */
export function useOrderItems(orderId) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const token = getAuthContext()?.session?.access_token

  const createItem = useCallback(
    async (productId, quantity, unitPrice) => {
      if (!token || !orderId) {
        setError('No hay sesión o orden')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`http://localhost:8000/api/orders/${orderId}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            product_id: productId,
            quantity: parseInt(quantity),
            unit_price: parseFloat(unitPrice),
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || 'Error al agregar producto')
        }

        const newItem = await response.json()
        return newItem
      } catch (err) {
        const errorMsg = err.message || 'Error al agregar producto'
        setError(errorMsg)
        console.error('Error creating order item:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [token, orderId],
  )

  const updateItem = useCallback(
    async (itemId, quantity, unitPrice) => {
      if (!token || !orderId) {
        setError('No hay sesión o orden')
        return null
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`http://localhost:8000/api/orders/${orderId}/items/${itemId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            quantity: quantity !== undefined ? parseInt(quantity) : undefined,
            unit_price: unitPrice !== undefined ? parseFloat(unitPrice) : undefined,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || 'Error al actualizar producto')
        }

        const updatedItem = await response.json()
        return updatedItem
      } catch (err) {
        const errorMsg = err.message || 'Error al actualizar producto'
        setError(errorMsg)
        console.error('Error updating order item:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [token, orderId],
  )

  const deleteItem = useCallback(
    async (itemId) => {
      if (!token || !orderId) {
        setError('No hay sesión o orden')
        return false
      }

      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`http://localhost:8000/api/orders/${orderId}/items/${itemId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.detail || 'Error al eliminar producto')
        }

        return true
      } catch (err) {
        const errorMsg = err.message || 'Error al eliminar producto'
        setError(errorMsg)
        console.error('Error deleting order item:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [token, orderId],
  )

  return { createItem, updateItem, deleteItem, loading, error }
}
