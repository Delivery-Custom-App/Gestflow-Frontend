import { apiRequest } from './apiClient'

const ADMIN_ROLES = new Set(['ADMIN_NEGOCIO', 'ADMIN'])
const ORDER_STATUSES = ['open', 'preparing', 'ready', 'completed', 'cancelled']
const NON_CANCELLED_STATUSES = ORDER_STATUSES.filter((status) => status !== 'cancelled')

export function displayNameFromEmail(email) {
  if (!email) return '—'
  const local = String(email).split('@')[0] || ''
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || email
}

function todayInChileIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function chileMidnightIso(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const wallClockUtc = Date.UTC(year, month - 1, day)
  const localParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(wallClockUtc))
  const values = Object.fromEntries(localParts.map(({ type, value }) => [type, value]))
  const representedUtc = Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour), Number(values.minute), Number(values.second),
  )
  return new Date(wallClockUtc - (representedUtc - wallClockUtc)).toISOString()
}

function dateOnly(value, fallback) {
  const date = String(value || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback
}

function earliestBusinessDate(local, business) {
  const dates = [dateOnly(local?.created_at), dateOnly(business?.created_at)].filter(Boolean)
  return dates.sort()[0] || '2000-01-01'
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
  const [businesses, users, locals] = await Promise.all([
    apiRequest('/businesses', { token }),
    apiRequest('/users', { token }),
    apiRequest('/locals', { token }),
  ])

  return {
    businesses: Array.isArray(businesses) ? businesses : [],
    users: Array.isArray(users) ? users : [],
    locals: Array.isArray(locals) ? locals : [],
  }
}

async function countOrders(localId, statuses, token, dateFrom, dateTo) {
  const query = new URLSearchParams({ local_id: String(localId), limit: '1', offset: '0' })
  const list = Array.isArray(statuses) ? statuses : [statuses]
  list.forEach((status) => query.append('status', status))
  if (dateFrom) query.set('date_from', dateFrom)
  if (dateTo) query.set('date_to', dateTo)
  const response = await apiRequest(`/orders?${query.toString()}`, { token, withTotal: true })
  return Number.isFinite(response?.total) ? response.total : 0
}

async function salesForLocal(localId, startDate, endDate, token) {
  const query = new URLSearchParams({ local_id: String(localId), start_date: startDate, end_date: endDate })
  const report = await apiRequest(`/reports/sales?${query.toString()}`, { token }).catch(() => null)
  return Number(report?.total_sales) || 0
}

async function summarizeLocalOrders(local, business, token, today, monthStart, now) {
  const startDate = earliestBusinessDate(local, business)
  const monthStartInstant = chileMidnightIso(monthStart)
  const nowInstant = now.toISOString()
  const [statusCounts, monthlyOrders, revenue, monthlyRevenue] = await Promise.all([
    Promise.all(ORDER_STATUSES.map(async (status) => [
      status,
      await countOrders(local.id, status, token),
    ])),
    countOrders(local.id, NON_CANCELLED_STATUSES, token, monthStartInstant, nowInstant),
    salesForLocal(local.id, startDate, today, token),
    salesForLocal(local.id, monthStart, today, token),
  ])
  const ordersByStatus = Object.fromEntries(statusCounts)
  const orders = NON_CANCELLED_STATUSES.reduce((sum, status) => sum + ordersByStatus[status], 0)
  return { orders, monthlyOrders, revenue, monthlyRevenue, ordersByStatus }
}

function aggregateLocalSummaries(locals, summaries) {
  return locals.reduce((aggregate, local) => {
    const summary = summaries.get(String(local.id))
    if (!summary) return aggregate
    aggregate.orders += summary.orders
    aggregate.monthly_orders += summary.monthlyOrders
    aggregate.revenue += summary.revenue
    aggregate.monthly_revenue += summary.monthlyRevenue
    Object.entries(summary.ordersByStatus).forEach(([status, count]) => {
      aggregate.orders_by_status[status] = (aggregate.orders_by_status[status] || 0) + count
    })
    return aggregate
  }, {
    orders: 0,
    monthly_orders: 0,
    revenue: 0,
    monthly_revenue: 0,
    orders_by_status: {},
  })
}

function mapUserRow(user, businessNames) {
  const businessId = user.business_id ? String(user.business_id) : ''
  const fullName = [user.first_name, user.last_name].map((s) => String(s || '').trim()).filter(Boolean).join(' ')
  return {
    id: user.id,
    email: user.email,
    name: fullName || displayNameFromEmail(user.email),
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
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
  const { businesses, users, locals } = await fetchPlatformSnapshot(token)
  const now = new Date()
  const today = todayInChileIso(now)
  const monthStart = `${today.slice(0, 7)}-01`
  const businessById = new Map(businesses.map((business) => [String(business.id), business]))
  const summaryEntries = await Promise.all(locals.map(async (local) => [
    String(local.id),
    await summarizeLocalOrders(local, businessById.get(String(local.business_id)), token, today, monthStart, now),
  ]))
  const summaries = new Map(summaryEntries)
  const totals = aggregateLocalSummaries(locals, summaries)

  const tenants = businesses.map((business) => {
    const businessId = String(business.id)
    const businessLocals = locals.filter((local) => String(local.business_id) === businessId)
    const businessUsers = users.filter((user) => String(user.business_id) === businessId)
    const sales = aggregateLocalSummaries(businessLocals, summaries)
    return {
      id: business.id,
      name: business.name,
      plan: business.plan || 'starter',
      is_active: business.is_active !== false,
      locals: businessLocals.length,
      users: businessUsers.length,
      orders: sales.orders,
      revenue: sales.revenue,
      monthly_revenue: sales.monthly_revenue,
      created_at: business.created_at,
    }
  })

  return {
    generated_at: now.toISOString(),
    totals: {
      businesses: businesses.length,
      active_businesses: businesses.filter((business) => business.is_active !== false).length,
      users: users.length,
      locals: locals.length,
      orders: totals.orders,
      monthly_orders: totals.monthly_orders,
      revenue: totals.revenue,
      monthly_revenue: totals.monthly_revenue,
    },
    orders_by_status: totals.orders_by_status,
    users_by_role: countBy(users, (user) => String(user.role || 'EMPLEADO').toUpperCase()),
    businesses_by_plan: countBy(businesses, (business) => String(business.plan || 'starter')),
    tenants,
  }
}

export async function v2GetBusinessStats(businessId, token) {
  const [{ businesses, users, locals }, audit] = await Promise.all([
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

  const now = new Date()
  const today = todayInChileIso(now)
  const monthStart = `${today.slice(0, 7)}-01`
  const id = String(businessId)
  const businessLocals = locals.filter((local) => String(local.business_id) === id)
  const businessUsers = users.filter((user) => String(user.business_id) === id)
  const summaryEntries = await Promise.all(businessLocals.map(async (local) => [
    String(local.id),
    await summarizeLocalOrders(local, business, token, today, monthStart, now),
  ]))
  const stats = aggregateLocalSummaries(businessLocals, new Map(summaryEntries))
  const admins = businessUsers.filter((user) => ADMIN_ROLES.has(String(user.role || '').toUpperCase()))

  return {
    business: { ...business, is_active: business.is_active !== false },
    generated_at: now.toISOString(),
    stats: {
      locals: businessLocals.length,
      users: businessUsers.length,
      admins: admins.length,
      orders: stats.orders,
      monthly_orders: stats.monthly_orders,
      revenue: stats.revenue,
      monthly_revenue: stats.monthly_revenue,
    },
    orders_by_status: stats.orders_by_status,
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
