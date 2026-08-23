import { useState, useCallback } from 'react'
import { createOrder as createOrderV2, updateOrderStatus as updateOrderStatusV2 } from '../lib/salesApi'

/**
 * Hook para crear órdenes y actualizar su estado (Backend V2).
 */
export function useOrderManagement() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const createOrder = useCallback(async (orderData) => {
    try {
      setLoading(true)
      setError(null)
      return await createOrderV2(orderData)
    } catch (err) {
      const message = err.message || 'Error creando orden'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateOrderStatus = useCallback(async (orderId, status, createdAt) => {
    try {
      setLoading(true)
      setError(null)
      return await updateOrderStatusV2(orderId, status, createdAt)
    } catch (err) {
      const message = err.message || 'Error actualizando orden'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { createOrder, updateOrderStatus, loading, error }
}
