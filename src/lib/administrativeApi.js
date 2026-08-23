import { listCajas, listOrders, createCajaV2 } from './salesApi'
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
  void token
  return listOrders(localId, { status })
}

export function getCajasByLocal(localId, token) {
  void token
  return listCajas(localId)
}

export function createCaja(body) {
  return createCajaV2(body)
}

export async function provisionCajaMp() {
  throw new Error('Provision MP de caja aún no disponible en Backend V2')
}

export async function verifyCajaMpPairing() {
  throw new Error('Verificación MP de caja aún no disponible en Backend V2')
}

export async function putLocalMpLocation() {
  throw new Error('Ubicación MP aún no disponible en Backend V2')
}

export async function getAvailableMpPos() {
  return []
}

export async function assignExistingMpPos() {
  throw new Error('Asignación MP POS aún no disponible en Backend V2')
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

export function postExpense(body) {
  return apiRequest('/expenses', { method: 'POST', body })
}

export function postTransfer(body) {
  return apiRequest('/transfers', { method: 'POST', body })
}

export function patchExpense(expenseId, body) {
  return apiRequest(`/expenses/${expenseId}`, { method: 'PATCH', body })
}

export function patchTransfer(transferId, body) {
  return apiRequest(`/transfers/${transferId}`, { method: 'PATCH', body })
}

export function getIncomeTrend(localId, token, days = 7) {
  const path = withQuery(`/dashboard/local/${localId}/trend`, { days })
  return apiRequest(path, { token })
}
