import { useMemo } from 'react'

/**
 * Totales derivados de `detail.active_orders`, memoizados para no recalcular
 * en cada render (carrito de alta frecuencia).
 */
export function useOrderTotals(detail) {
  return useMemo(() => {
    const allItems = (detail?.active_orders || []).flatMap(o => o.items || [])
    const subtotal = allItems.reduce((s, item) => s + (item.total_price || 0), 0)
    const iva = Math.round(subtotal * 0.19)
    const total = subtotal + iva
    const firstOrder = detail?.active_orders?.[0]
    return { allItems, subtotal, iva, total, firstOrder }
  }, [detail])
}
