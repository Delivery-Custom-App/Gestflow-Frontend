import { useState, useEffect, useCallback, useRef } from 'react'
import { listOrderItems, listOrders, updateOrderStatus as updateOrderStatusV2 } from '../lib/salesApi'

const POLL_INTERVAL_MS = 30_000
const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY']

/**
 * Órdenes activas de cocina (V2 statuses mapeados a PENDING/PREPARING/READY).
 */
export function useKitchenOrders(localId) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)
  const mounted = useRef(true)

  const fetchOrders = useCallback(async () => {
    if (!localId) return
    try {
      const raw = await listOrders(localId)
      if (!mounted.current) return

      const active = (raw || []).filter((o) => ACTIVE_STATUSES.includes(o.status))

      const withItems = await Promise.all(
        active.map(async (order) => {
          try {
            const items = await listOrderItems(order.id, order.created_at)
            return { ...order, items: Array.isArray(items) ? items : [] }
          } catch {
            return { ...order, items: [] }
          }
        }),
      )

      if (!mounted.current) return
      withItems.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      setOrders(withItems)
      setError(null)
    } catch (err) {
      if (mounted.current) {
        setError(err.message)
        setOrders([])
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [localId])

  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    const ts = new Date().toISOString()
    const current = orders.find((o) => o.id === orderId)
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: newStatus, updated_at: ts } : o,
      ),
    )
    try {
      await updateOrderStatusV2(orderId, newStatus, current?.created_at)
    } finally {
      await fetchOrders()
    }
  }, [fetchOrders, orders])

  useEffect(() => {
    mounted.current = true
    if (!localId) return

    setLoading(true)
    fetchOrders()
    pollRef.current = setInterval(fetchOrders, POLL_INTERVAL_MS)

    return () => {
      mounted.current = false
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [localId, fetchOrders])

  return { orders, loading, error, refresh: fetchOrders, updateOrderStatus }
}
