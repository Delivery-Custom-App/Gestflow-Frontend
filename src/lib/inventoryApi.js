import { apiRequest } from './apiClient'

export async function getInventoryKpisByLocal(localId, token) {
  if (!localId) {
    throw new Error('localId es requerido para consultar KPIs de inventario')
  }

  return apiRequest(`/inventory/kpis/${localId}`, { token })
}

/**
 * Crea categoría (si no existe), producto y fila en `inventory`.
 * Body camelCase alineado al modal (productName, category, unit, maxStock, currentStock, unitCost, supplier).
 */
export async function createInventoryNewProduct(localId, body, token) {
  if (!localId) {
    throw new Error('localId es requerido para crear el producto')
  }
  return apiRequest(`/inventory/locals/${localId}/new-product`, {
    method: 'POST',
    body,
    token,
  })
}

export async function getInventoryStockList(localId, token) {
  if (!localId) {
    throw new Error('localId es requerido para listar el inventario')
  }
  const query = new URLSearchParams({ local_id: String(localId) })
  return apiRequest(`/products?${query.toString()}`, { token })
}
