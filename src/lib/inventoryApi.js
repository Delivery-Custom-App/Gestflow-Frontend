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
