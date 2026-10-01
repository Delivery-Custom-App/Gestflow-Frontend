import { useState, useCallback } from 'react'
import { getProductsReport, getSalesReport, hoyIso, inicioDeMes } from '../lib/reportsApi'

/**
 * Reportes del POS del mes en curso.
 *
 * Antes pedía `/dashboard/pos-reportes`, que no existe en Backend V2: la
 * pantalla quedaba vacía con un 404 en crudo. Ahora se alimenta de los reportes
 * agregados (`/reports/sales` y `/reports/products`), que devuelven los totales
 * ya calculados por el backend.
 *
 * Lazy — solo carga cuando se llama a `fetch()`.
 */
export function useReportesPOS(localId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!localId) return
    const rango = { startDate: inicioDeMes(), endDate: hoyIso() }
    try {
      setLoading(true)
      setError(null)
      const [ventas, productos] = await Promise.all([
        getSalesReport(localId, rango),
        getProductsReport(localId, rango),
      ])

      const ranking = Array.isArray(productos?.ranking) ? productos.ranking : []
      const top5 = ranking.slice(0, 5).map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        units_sold: Number(p.quantity_sold) || 0,
        revenue: Number(p.revenue) || 0,
      }))

      setData({
        periodo: { desde: rango.startDate, hasta: rango.endDate },
        total_ventas: Number(ventas?.total_sales) || 0,
        total_ordenes: Number(ventas?.total_orders) || 0,
        top_producto: top5[0] || null,
        top_5: top5,
      })
    } catch (err) {
      // El detalle técnico queda en la consola; al usuario se le habla claro.
      console.error('Reportes POS:', err)
      setError('No pudimos cargar los reportes del período.')
    } finally {
      setLoading(false)
    }
  }, [localId])

  return { data, loading, error, fetch }
}
