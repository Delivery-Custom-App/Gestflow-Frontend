import { apiRequest } from './apiClient'

/**
 * HU-34: órdenes de compra semanales a proveedores.
 * @param {{ week_start?: string, supplier_id?: string, status?: string }} [filters]
 */
export function getWeeklyPurchaseOrders(token, businessId, filters = {}) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  if (filters.week_start) params.set('week_start', String(filters.week_start))
  if (filters.supplier_id) params.set('supplier_id', String(filters.supplier_id))
  if (filters.status) params.set('status', String(filters.status))
  return apiRequest(`/weekly-purchase-orders?${params.toString()}`, { token })
}

export function getWeeklyPurchaseOrder(token, orderId, businessId) {
  const params = new URLSearchParams({ business_id: String(businessId) })
  return apiRequest(`/weekly-purchase-orders/${encodeURIComponent(orderId)}?${params}`, { token })
}

export function postWeeklyPurchaseOrder(token, body) {
  return apiRequest('/weekly-purchase-orders', { method: 'POST', token, body })
}

export function patchWeeklyPurchaseOrder(token, orderId, businessId, body) {
  const params = new URLSearchParams({ business_id: String(businessId) })
  return apiRequest(`/weekly-purchase-orders/${encodeURIComponent(orderId)}?${params}`, { method: 'PATCH', token, body })
}

export function putWeeklyPurchaseOrderItems(token, orderId, businessId, items) {
  const params = new URLSearchParams({ business_id: String(businessId) })
  return apiRequest(`/weekly-purchase-orders/${encodeURIComponent(orderId)}/items?${params}`, {
    method: 'PUT',
    token,
    body: { items },
  })
}

export function patchWeeklyPurchaseLineReception(token, orderId, itemId, businessId, quantity_received) {
  const params = new URLSearchParams({ business_id: String(businessId) })
  return apiRequest(
    `/weekly-purchase-orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/reception?${params}`,
    { method: 'PATCH', token, body: { quantity_received } },
  )
}

export function deleteWeeklyPurchaseOrder(token, orderId, businessId) {
  const params = new URLSearchParams({ business_id: String(businessId) })
  return apiRequest(`/weekly-purchase-orders/${encodeURIComponent(orderId)}?${params}`, { method: 'DELETE', token })
}

export function getWeeklyPurchaseComparisonReport(token, businessId, week_from, week_to) {
  const params = new URLSearchParams({
    business_id: String(businessId),
    week_from: String(week_from),
    week_to: String(week_to),
  })
  return apiRequest(`/weekly-purchase-orders/reports/comparison?${params.toString()}`, { token })
}
