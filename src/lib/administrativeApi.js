import { apiRequest } from './apiClient'

function withQuery(path, params) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })

  const queryString = query.toString()
  return queryString ? `${path}?${queryString}` : path
}

export function getLocalDashboard(localId, token) {
  return apiRequest(`/dashboard/local/${localId}`, { token })
}

export function getConsolidatedDashboard(businessId, token) {
  const path = withQuery('/dashboard/consolidated', { business_id: businessId })
  return apiRequest(path, { token })
}

export function getOrdersByLocal(localId, token, status) {
  const path = withQuery('/orders', { local_id: localId, status })
  return apiRequest(path, { token })
}

export function getRendicionesDashboard(localId, token, options = {}) {
  const { startDate, endDate, movementLimit = 100 } = options
  const path = withQuery('/dashboard/rendiciones', {
    local_id: localId,
    start_date: startDate,
    end_date: endDate,
    movement_limit: movementLimit,
  })

  return apiRequest(path, { token })
}

export function getExpensesByLocal(localId, token, status) {
  const path = withQuery('/expenses', { local_id: localId, status })
  return apiRequest(path, { token })
}

export function getTransfersByLocal(localId, token, status) {
  const path = withQuery('/transfers', { local_id: localId, status })
  return apiRequest(path, { token })
}

export function getCajasByLocal(localId, token) {
  const path = withQuery('/cajas', { local_id: localId })
  return apiRequest(path, { token })
}

export function postExpense(body) {
  return apiRequest('/expenses', { method: 'POST', body })
}

export function postTransfer(body) {
  return apiRequest('/transfers', { method: 'POST', body })
}

export function getIncomeTrend(localId, token, days = 7) {
  const path = withQuery(`/dashboard/local/${localId}/trend`, { days })
  return apiRequest(path, { token })
}
