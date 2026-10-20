import { apiRequest } from './apiClient'
import {
  v2GetAuditLog,
  v2GetAuditPageCount,
  v2GetBusinessStats,
  v2GetGlobalStats,
  v2GetPlatformSummary,
  v2GetObservability,
  v2ListAllUsers,
} from './v2SuperAdminAdapter'
import { invalidarLocales, invalidarNegocios } from './cacheLocales'

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

export async function listBusinesses(token) {
  return apiRequest('/businesses', { token })
}

export async function getBusiness(businessId, token) {
  return apiRequest(`/businesses/${businessId}`, { token })
}

// T-35: crear, editar o eliminar un negocio invalida lo guardado en memoria.
export async function createBusiness(body, token) {
  const r = await apiRequest('/businesses', { method: 'POST', body, token })
  invalidarNegocios()
  return r
}

export async function updateBusiness(businessId, body, token) {
  const r = await apiRequest(`/businesses/${businessId}`, { method: 'PATCH', body, token })
  invalidarNegocios()
  return r
}

export async function deleteBusiness(businessId, token) {
  const r = await apiRequest(`/businesses/${businessId}`, { method: 'DELETE', token })
  invalidarNegocios()
  return r
}

export async function getAuditLog(opts = {}, token) {
  return v2GetAuditLog(opts, token)
}

export async function getAuditPageCount(opts = {}, token) {
  return v2GetAuditPageCount(opts, token)
}

export function getPlatformSummary(range, token) {
  return v2GetPlatformSummary(range, token)
}

export async function getGlobalStats(token) {
  return v2GetGlobalStats(token)
}

export function getGlobalSalesReport({ startDate, endDate }, token) {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
  return apiRequest(`/reports/sales?${params.toString()}`, { token })
}

export async function getBusinessStats(businessId, token) {
  return v2GetBusinessStats(businessId, token)
}

export async function listBusinessLocals(businessId, token) {
  return apiRequest(`/locals?business_id=${encodeURIComponent(String(businessId))}`, { token })
}

// #134: el superadmin abre locales de una franquicia (POST /locals con su business_id).
export async function createBusinessLocal(businessId, { name, salesModel }, token) {
  const r = await apiRequest('/locals', {
    method: 'POST',
    body: { business_id: businessId, name, ...(salesModel ? { sales_model: salesModel } : {}) },
    token,
  })
  invalidarLocales()
  return r
}

export async function updateLocalSalesModel(localId, salesModel, token) {
  const r = await apiRequest(`/locals/${encodeURIComponent(String(localId))}`, {
    method: 'PATCH',
    body: { sales_model: salesModel },
    token,
  })
  invalidarLocales()
  return r
}

export async function listAllUsers({ role, businessId } = {}, token) {
  return v2ListAllUsers({ role, businessId }, token)
}

export async function updateUser(userId, body, token) {
  return apiRequest(`/users/${userId}`, { method: 'PATCH', body, token })
}

export async function getObservability(token, opts = {}) {
  return v2GetObservability(token, opts)
}

// Legacy helper kept for callers that still build audit query strings.
export { withQuery }
