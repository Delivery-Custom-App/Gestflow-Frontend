import { apiRequest } from './apiClient'

/**
 * Reportes agregados del Backend V2 (`/reports/*`).
 *
 * Reemplazan el cálculo en el navegador: antes la app se bajaba todas las
 * órdenes del local y sumaba en JavaScript. Estos endpoints devuelven los
 * totales ya calculados y admiten rango de fechas.
 */

/** Primer día del mes en curso, en formato YYYY-MM-DD. */
export function inicioDeMes(hoy = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`
}

/** Hoy en formato YYYY-MM-DD. */
export function hoyIso(hoy = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
}

function rangoQuery(localId, { startDate, endDate }) {
  const params = new URLSearchParams({
    local_id: String(localId),
    start_date: startDate,
    end_date: endDate,
  })
  return params.toString()
}

/** Totales de venta del período: { total_sales, total_orders, by_local[] }. */
export function getSalesReport(localId, rango) {
  return apiRequest(`/reports/sales?${rangoQuery(localId, rango)}`)
}

/** Ranking de productos del período: { ranking[], monthly_series[] }. */
export function getProductsReport(localId, rango) {
  return apiRequest(`/reports/products?${rangoQuery(localId, rango)}`)
}
