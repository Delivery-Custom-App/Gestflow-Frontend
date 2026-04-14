import { apiRequest } from './apiClient'

export async function getInventoryKpisByLocal(localId, token) {
  if (!localId) {
    throw new Error('localId es requerido para consultar KPIs de inventario')
  }

  return apiRequest(`/inventory/kpis/${localId}`, { token })
}
