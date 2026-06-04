import { useState, useEffect, useCallback, useRef } from 'react'
import { apiRequest } from '../lib/apiClient'

const POLL_INTERVAL_MS = 30_000
const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY']

/**
 * Fetches all active orders (PENDING, PREPARING, READY) for a local,
 * including their items. Polls every 30s.
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
      const raw = await apiRequest(`/orders?local_id=${localId}`)
      if (!mounted.current) return

      const active = (raw || []).filter(o => ACTIVE_STATUSES.includes(o.status))

      // Fetch items for each active order in parallel
      const withItems = await Promise.all(
        active.map(async (order) => {
          try {
            const items = await apiRequest(`/orders/${order.id}/items`)
            return { ...order, items: Array.isArray(items) ? items : [] }
          } catch {
            return { ...order, items: [] }
          }
        })
      )

      if (!mounted.current) return
      // Sort: oldest first so kitchen processes in order
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
    await apiRequest(`/orders/${orderId}`, {
      method: 'PATCH',
      body: { status: newStatus },
    })
    await fetchOrders()
  }, [fetchOrders])

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
