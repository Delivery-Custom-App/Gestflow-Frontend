import { apiRequest } from './apiClient'

const ADMIN_ROLES = new Set(['ADMIN_NEGOCIO', 'ADMIN'])

export function displayNameFromEmail(email) {
  if (!email) return '—'
  const local = String(email).split('@')[0] || ''
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || email
}

function monthStartUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function normalizeStatus(status) {
  return String(status || '').toLowerCase()
}

function isValidOrder(order) {
  return normalizeStatus(order?.status) !== 'cancelled'
}

function sumOrderTotal(orders) {
  return orders
    .filter(isValidOrder)
    .reduce((acc, order) => acc + Number(order.total || 0), 0)
}

function countBy(items, keyFn) {
  const out = {}
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    out[key] = (out[key] || 0) + 1
  }
  return out
}

async function fetchPlatformSnapshot(token) {
  const [businesses, users, locals, orders] = await Promise.all([
    apiRequest('/businesses', { token }),
    apiRequest('/users', { token }),
    apiRequest('/locals', { token }),
    apiRequest('/orders', { token }),
  ])

  return {
    businesses: Array.isArray(businesses) ? businesses : [],
    users: Array.isArray(users) ? users : [],
    locals: Array.isArray(locals) ? locals : [],
    orders: Array.isArray(orders) ? orders : [],
  }
}

function mapUserRow(user, businessNames) {
  const businessId = user.business_id ? String(user.business_id) : ''
  return {
    id: user.id,
    email: user.email,
    name: displayNameFromEmail(user.email),
    role: user.role,
    is_active: user.is_active !== false,
    business_id: user.business_id ?? null,
    business_name: businessId ? businessNames[businessId] ?? null : null,
    local_id: user.local_id ?? null,
    created_at: user.created_at,
  }
}

export async function v2ListAllUsers({ role, businessId } = {}, token) {
  const { businesses, users } = await fetchPlatformSnapshot(token)
  const businessNames = Object.fromEntries(
    businesses.map((b) => [String(b.id), b.name])
  )

  let rows = users.map((user) => mapUserRow(user, businessNames))

  if (role) {
    const wanted = String(role).toUpperCase()
    rows = rows.filter((user) => String(user.role || '').toUpperCase() === wanted)
  }

  if (businessId) {
    rows = rows.filter((user) => String(user.business_id) === String(businessId))
  }

  rows.sort((a, b) => (a.business_name || '').localeCompare(b.business_name || '', 'es'))
  return rows
}

export async function v2GetGlobalStats(token) {
  const { businesses, users, locals, orders } = await fetchPlatformSnapshot(token)
  const monthStart = monthStartUtc()

  const validOrders = orders.filter(isValidOrder)
  const monthOrders = validOrders.filter(
    (order) => new Date(order.created_at) >= monthStart
  )

  const tenants = businesses.map((business) => {
    const businessId = String(business.id)
    const businessLocals = locals.filter(
      (local) => String(local.business_id) === businessId
    )
    const localIds = new Set(businessLocals.map((local) => String(local.id)))
    const businessUsers = users.filter(
      (user) => String(user.business_id) === businessId
    )
    const businessOrders = validOrders.filter((order) =>
      localIds.has(String(order.local_id))
    )
    const businessMonthOrders = businessOrders.filter(
      (order) => new Date(order.created_at) >= monthStart
    )

    return {
      id: business.id,
      name: business.name,
      plan: business.plan || 'starter',
      is_active: business.is_active !== false,
      locals: businessLocals.length,
      users: businessUsers.length,
      orders: businessOrders.length,
      revenue: sumOrderTotal(businessOrders),
      monthly_revenue: sumOrderTotal(businessMonthOrders),
      created_at: business.created_at,
    }
  })

  return {
    generated_at: new Date().toISOString(),
    totals: {
      businesses: businesses.length,
      active_businesses: businesses.filter((b) => b.is_active !== false).length,
      users: users.length,
      locals: locals.length,
      orders: validOrders.length,
      monthly_orders: monthOrders.length,
      revenue: sumOrderTotal(validOrders),
      monthly_revenue: sumOrderTotal(monthOrders),
    },
    orders_by_status: countBy(orders, (order) => normalizeStatus(order.status) || 'unknown'),
    users_by_role: countBy(users, (user) => String(user.role || 'EMPLEADO').toUpperCase()),
    businesses_by_plan: countBy(businesses, (business) => String(business.plan || 'starter')),
    tenants,
  }
}

export async function v2GetBusinessStats(businessId, token) {
  const [{ businesses, users, locals, orders }, audit] = await Promise.all([
    fetchPlatformSnapshot(token),
    v2GetAuditLog({ businessId, limit: 20, offset: 0 }, token).catch(() => []),
  ])
  const business = businesses.find((row) => String(row.id) === String(businessId))

  if (!business) {
    const error = new Error('Negocio no encontrado')
    error.status = 404
    error.detail = 'Negocio no encontrado'
    throw error
  }

  const monthStart = monthStartUtc()
  const id = String(businessId)
  const businessLocals = locals.filter((local) => String(local.business_id) === id)
  const localIds = new Set(businessLocals.map((local) => String(local.id)))
  const businessUsers = users.filter((user) => String(user.business_id) === id)
  const businessOrders = orders.filter((order) => localIds.has(String(order.local_id)))
  const validOrders = businessOrders.filter(isValidOrder)
  const monthOrders = validOrders.filter(
    (order) => new Date(order.created_at) >= monthStart
  )
  const admins = businessUsers.filter((user) =>
    ADMIN_ROLES.has(String(user.role || '').toUpperCase())
  )

  return {
    business: { ...business, is_active: business.is_active !== false },
    generated_at: new Date().toISOString(),
    stats: {
      locals: businessLocals.length,
      users: businessUsers.length,
      admins: admins.length,
      orders: validOrders.length,
      monthly_orders: monthOrders.length,
      revenue: sumOrderTotal(validOrders),
      monthly_revenue: sumOrderTotal(monthOrders),
    },
    orders_by_status: countBy(
      businessOrders,
      (order) => normalizeStatus(order.status) || 'unknown'
    ),
    admins: admins.map((user) => ({
      id: user.id,
      email: user.email,
      name: displayNameFromEmail(user.email),
      role: user.role,
      is_active: user.is_active !== false,
      created_at: user.created_at,
    })),
    audit: Array.isArray(audit) ? audit : [],
  }
}

function withQuery(path, params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

export async function v2GetAuditLog({ businessId, action, limit = 50, offset = 0 } = {}, token) {
  const path = withQuery('/audit', {
    business_id: businessId,
    action,
    limit,
    offset,
  })
  const data = await apiRequest(path, { token })
  return Array.isArray(data) ? data : []
}

export async function v2GetObservability(token, { businessId } = {}) {
  const path = withQuery('/tenant-manager/observability', {
    business_id: businessId,
  })
  const data = await apiRequest(path, { token })
  return {
    generated_at: data?.generated_at || new Date().toISOString(),
    started_at: data?.started_at || null,
    unavailable: Boolean(data?.unavailable),
    business_id: data?.business_id || null,
    tenants: Array.isArray(data?.tenants) ? data.tenants : [],
    endpoints: Array.isArray(data?.endpoints) ? data.endpoints : [],
  }
}
