import { apiRequest } from './apiClient'
import {
  v2GetAuditLog,
  v2GetBusinessStats,
  v2GetGlobalStats,
  v2GetObservability,
  v2ListAllUsers,
} from './v2SuperAdminAdapter'

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

export async function createBusiness(body, token) {
  return apiRequest('/businesses', { method: 'POST', body, token })
}

export async function updateBusiness(businessId, body, token) {
  return apiRequest(`/businesses/${businessId}`, { method: 'PATCH', body, token })
}

export async function deleteBusiness(businessId, token) {
  return apiRequest(`/businesses/${businessId}`, { method: 'DELETE', token })
}

export async function getAuditLog(opts = {}, token) {
  return v2GetAuditLog(opts, token)
}

export async function getGlobalStats(token) {
  return v2GetGlobalStats(token)
}

export async function getBusinessStats(businessId, token) {
  return v2GetBusinessStats(businessId, token)
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
