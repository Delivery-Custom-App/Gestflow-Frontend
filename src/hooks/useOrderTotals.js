import { useMemo } from 'react'

/** Lo que se cobra de un pedido: su total fijado o la suma de sus ítems (IVA incluido). */
export function totalDeOrden(order) {
  if (!order) return 0
  if (order.total_override != null) return Number(order.total_override) || 0
  return (order.items || []).reduce((sum, item) => sum + (Number(item.total_price) || 0), 0)
}

/** Neto e IVA de un total que ya incluye IVA: subtotal + iva === total. */
export function desgloseIva(total) {
  const subtotal = Math.round(total / 1.19)
  return { subtotal, iva: total - subtotal, total }
}

/**
 * Totales derivados de `detail.active_orders`, memoizados para no recalcular
 * en cada render (carrito de alta frecuencia).
 */
export function useOrderTotals(detail) {
  return useMemo(() => {
    const orders = detail?.active_orders || []
    const allItems = orders.flatMap(o => o.items || [])
    // Los precios ya incluyen IVA (backend: _split_iva_incluido): `total` es lo que
    // se cobra; `subtotal` es el neto y `iva` el resto, así subtotal + iva === total.
    const total = orders.reduce((sum, order) => sum + totalDeOrden(order), 0)
    const { subtotal, iva } = desgloseIva(total)
    const firstOrder = detail?.active_orders?.[0]
    return { allItems, subtotal, iva, total, firstOrder }
  }, [detail])
}
