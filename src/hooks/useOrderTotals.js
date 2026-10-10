import { useMemo } from 'react'

/**
 * Totales derivados de `detail.active_orders`, memoizados para no recalcular
 * en cada render (carrito de alta frecuencia).
 */
export function useOrderTotals(detail) {
  return useMemo(() => {
    const allItems = (detail?.active_orders || []).flatMap(o => o.items || [])
    // Los precios ya incluyen IVA (backend: _split_iva_incluido): `total` es lo que
    // se cobra; `subtotal` es el neto y `iva` el resto, así subtotal + iva === total.
    const total = allItems.reduce((s, item) => s + (item.total_price || 0), 0)
    const subtotal = Math.round(total / 1.19)
    const iva = total - subtotal
    const firstOrder = detail?.active_orders?.[0]
    return { allItems, subtotal, iva, total, firstOrder }
  }, [detail])
}
