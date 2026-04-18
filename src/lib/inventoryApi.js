import { apiRequest } from './apiClient'

export function getInventoryKpisByLocal(localId, token) {
  return apiRequest(`/inventory/kpis/${localId}`, { token })
}

/**
 * @param {object} [filters]
 * @param {string} [filters.category] - UUID categoría
 * @param {string} [filters.search] - texto parcial nombre
 * @param {string[]} [filters.status] - uno o más: CRITICO, BAJO, OPTIMO
 */
export function buildInventoryStockListPath(localId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', String(filters.category))
  if (filters.search && String(filters.search).trim()) params.set('search', String(filters.search).trim())
  if (Array.isArray(filters.status) && filters.status.length) {
    for (const s of filters.status) {
      if (s) params.append('status', String(s).toUpperCase())
    }
  }
  const qs = params.toString()
  return `/inventory/locals/${localId}/stock${qs ? `?${qs}` : ''}`
}
export function getInventoryStockList(localId, token, filters = {}) {
  return apiRequest(buildInventoryStockListPath(localId, filters), { token })
}

/** Proveedores activos del negocio asociado al local. */
export function getInventorySuppliersForLocal(localId, token) {
  return apiRequest(`/inventory/locals/${localId}/suppliers`, { token })
}

/**
 * Crea un proveedor en el negocio. `business_id` opcional: el backend usa el del usuario si es admin.
 * @param {object} body - { name: string, business_id?: string }
 */
export function postSupplier(token, body) {
  return apiRequest('/suppliers', { method: 'POST', token, body })
}

export function postInventoryNewProduct(localId, token, body) {
  return apiRequest(`/inventory/locals/${localId}/new-product`, {
    method: 'POST',
    token,
    body,
  })
}

/** Actualiza stock o mínimo; la API devuelve la fila con total_value recalculado (stock × costo). */
export function patchInventoryStock(localId, inventoryId, token, body) {
  return apiRequest(`/inventory/locals/${localId}/stock/${inventoryId}`, {
    method: 'PATCH',
    token,
    body,
  })
}
