import { apiRequest } from './apiClient'

export function getInventoryKpisByLocal(localId, token) {
  return apiRequest(`/inventory/kpis/${localId}`, { token })
}

/** Ruta API relativa a `/api` (para tests y para armar el request). */
export function buildInventoryStockListPath(localId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', String(filters.category))
  if (filters.search && String(filters.search).trim()) params.set('search', String(filters.search).trim())
  const qs = params.toString()
  return `/inventory/locals/${localId}/stock${qs ? `?${qs}` : ''}`
}

/**
 * Listado de stock por local. Filtros opcionales (HU-47 / combinación con búsqueda):
 * - `category`: UUID de categoría del producto
 * - `search`: texto parcial sobre el nombre
 */
export function getInventoryStockList(localId, token, filters = {}) {
  return apiRequest(buildInventoryStockListPath(localId, filters), { token })
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
