import { apiRequest } from './apiClient'
import { obtenerLocal } from './cacheLocales'

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

function rangoQuery(localId, { startDate, endDate }, businessId) {
  const params = new URLSearchParams({
    local_id: String(localId),
    start_date: startDate,
    end_date: endDate,
  })
  if (businessId != null) params.set('business_id', String(businessId))
  return params.toString()
}

/**
 * El backend exige `business_id` junto a `local_id` cuando quien consulta es
 * SUPERADMIN (400 "business_id requerido para SUPERADMIN"). Se saca del local,
 * que ya viene en caché. Si no se puede resolver, se manda solo `local_id`.
 */
async function businessIdDeLocal(localId) {
  try {
    const local = await obtenerLocal(localId)
    return local?.business_id ?? null
  } catch {
    return null
  }
}

/** Totales de venta del período: { total_sales, total_orders, by_local[] }. */
export async function getSalesReport(localId, rango) {
  const businessId = await businessIdDeLocal(localId)
  return apiRequest(`/reports/sales?${rangoQuery(localId, rango, businessId)}`)
}

/** Ranking de productos del período: { ranking[], monthly_series[] }. */
export async function getProductsReport(localId, rango) {
  const businessId = await businessIdDeLocal(localId)
  return apiRequest(`/reports/products?${rangoQuery(localId, rango, businessId)}`)
}
