import { useState, useEffect, useCallback } from 'react'
import { getMesaDetail } from '../lib/salesApi'

/** Detalle de mesa y órdenes activas (compuesto en FE contra V2). */
export function useMesaDetail(mesaId) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMesaDetail = useCallback(async () => {
    if (!mesaId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setDetail(await getMesaDetail(mesaId))
    } catch (err) {
      setError(err.message || 'Error obteniendo detalle de mesa')
      console.error('Error fetching mesa detail:', err)
    } finally {
      setLoading(false)
    }
  }, [mesaId])

  const updateAfterItemRemoval = useCallback((orderId, itemId, orderTotal) => {
    const parsedTotal = Number(orderTotal)
    if (!Number.isFinite(parsedTotal)) return
    setDetail((current) => {
      if (!current) return current
      let removedItem = null
      const activeOrders = (current.active_orders || []).map((order) => {
        if (String(order.id) !== String(orderId)) return order
        removedItem = (order.items || []).find((item) => String(item.id) === String(itemId)) || null
        const subtotal = Math.round(parsedTotal / 1.19)
        return {
          ...order,
          items: (order.items || []).filter((item) => String(item.id) !== String(itemId)),
          total_override: parsedTotal,
          total: parsedTotal,
          subtotal,
          iva: parsedTotal - subtotal,
        }
      })
      if (!removedItem) return current
      const removedQuantity = Number(removedItem.quantity) || 0
      const removedValue = Number(removedItem.subtotal ?? (removedQuantity * Number(removedItem.unit_price))) || 0
      return {
        ...current,
        active_orders: activeOrders,
        total_products: Math.max(0, (Number(current.total_products) || 0) - removedQuantity),
        total_value: Math.max(0, (Number(current.total_value) || 0) - removedValue),
      }
    })
  }, [])

  useEffect(() => {
    fetchMesaDetail()
  }, [fetchMesaDetail])

  return { detail, loading, error, refresh: fetchMesaDetail, updateAfterItemRemoval }
}
