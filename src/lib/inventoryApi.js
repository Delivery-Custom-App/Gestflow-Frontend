import { apiRequest } from './apiClient'

export function getInventoryKpisByLocal(localId, token) {
  return apiRequest(`/inventory/kpis/${localId}`, { token })
}

export function getInventoryStockList(localId, token) {
  return apiRequest(`/inventory/locals/${localId}/stock`, { token })
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
