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

export async function listBusinesses(token) {
  return apiRequest('/businesses', { token })
}

export async function getBusiness(businessId, token) {
  return apiRequest(`/businesses/${businessId}`, { token })
}

export async function createBusiness(body) {
  return apiRequest('/businesses', { method: 'POST', body })
}

export async function updateBusiness(businessId, body) {
  return apiRequest(`/businesses/${businessId}`, { method: 'PATCH', body })
}

export async function deleteBusiness(businessId) {
  return apiRequest(`/businesses/${businessId}`, { method: 'DELETE' })
}

export async function getAuditLog({ businessId, action, limit, offset } = {}, token) {
  const path = withQuery('/audit', { business_id: businessId, action, limit, offset })
  return apiRequest(path, { token })
}

export async function getGlobalStats(token) {
  return apiRequest('/tenant-manager/stats', { token })
}

export async function getBusinessStats(businessId, token) {
  return apiRequest(`/tenant-manager/businesses/${businessId}/stats`, { token })
}

export async function listAllUsers({ role, businessId } = {}, token) {
  const path = withQuery('/tenant-manager/users', { role, business_id: businessId })
  return apiRequest(path, { token })
}

export async function getObservability(token) {
  return apiRequest('/tenant-manager/observability', { token })
}
