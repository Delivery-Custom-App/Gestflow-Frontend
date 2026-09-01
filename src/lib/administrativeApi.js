import {
  listCajas,
  listOrders,
  createCajaV2,
  getCajaResumen,
  getMovimientosCaja,
  closeCaja,
  getResumenDiario,
} from './salesApi'
import { apiRequest } from './apiClient'
import { isV2FeatureEnabled } from './v2Features'

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

const EMPTY_RENDICIONES = {
  approved_expenses_total: 0,
  pending_expenses_total: 0,
  completed_transfers_total: 0,
  pending_transfers_total: 0,
  net_flow: 0,
  movements: [],
}

function orderAmount(order) {
  const n = Number(order?.total_amount ?? order?.total ?? order?.amount ?? order?.subtotal ?? 0)
  return Number.isFinite(n) ? n : 0
}

function isCompletedOrder(order) {
  const s = String(order?.status || order?.status_v2 || '').toLowerCase()
  return s === 'completed' || s === 'ready'
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/** Construye un dashboard compatible con la UI admin a partir de órdenes V2. */
export function buildDashboardFromOrders(orders = [], { localCount = 1 } = {}) {
  const list = Array.isArray(orders) ? orders : []
  const sales = list.filter(isCompletedOrder)
  const todayStart = startOfToday().getTime()
  const monthStart = startOfMonth().getTime()

  let dailySales = 0
  let monthlySales = 0
  const hourBuckets = Array.from({ length: 24 }, () => 0)
  const productMap = new Map()

  for (const order of sales) {
    const amount = orderAmount(order)
    const created = new Date(order.created_at || order.createdAt || Date.now()).getTime()
    if (created >= monthStart) monthlySales += amount
    if (created >= todayStart) {
      dailySales += amount
      hourBuckets[new Date(created).getHours()] += amount
    }
    for (const item of Array.isArray(order.items) ? order.items : []) {
      const name = item.product_name || item.name || item.recipe_name || 'Producto'
      const qty = Number(item.quantity) || 1
      const line = qty * (Number(item.unit_price) || Number(item.price) || 0)
      const prev = productMap.get(name) || { product_name: name, units_sold: 0, revenue: 0 }
      prev.units_sold += qty
      prev.revenue += line || 0
      productMap.set(name, prev)
    }
  }

  let peakHour = null
  let peakVal = -1
  hourBuckets.forEach((v, h) => {
    if (v > peakVal) {
      peakVal = v
      peakHour = h
    }
  })

  const avgTicket = sales.length ? Math.round(monthlySales / sales.length) : 0
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return {
    daily_sales: dailySales,
    monthly_sales: monthlySales,
    monthly_cash_flow: monthlySales,
    monthly_expenses: 0,
    active_alerts: 0,
    avg_ticket: avgTicket,
    stock_critical_count: 0,
    stock_low_count: 0,
    stock_out_count: 0,
    inventory_total_value: 0,
    active_cajas_count: 0,
    cajas_count: 0,
    peak_hour: peakVal > 0 ? peakHour : null,
    local_count: localCount,
    top_products: topProducts,
    payment_breakdown: [],
    week_comparison: null,
    monthly_goal: { target_amount: 0, current_amount: monthlySales, progress_pct: 0 },
    petty_cash: { active_cajas: 0, total_cajas: 0, pending_expenses_amount: 0 },
    daily_income_trend: [],
    expenses_breakdown: [],
    _source: 'orders_v2',
  }
}

export async function getLocalDashboard(localId, token) {
  void token
  if (!isV2FeatureEnabled('adminDashboard')) {
    const orders = await listOrders(localId)
    return buildDashboardFromOrders(orders, { localCount: 1 })
  }
  return apiRequest(`/dashboard/local/${localId}`, { token })
}

export async function getConsolidatedDashboard(businessId, token, { localId } = {}) {
  void businessId
  void token
  if (!isV2FeatureEnabled('adminDashboard')) {
    if (!localId) return buildDashboardFromOrders([], { localCount: 0 })
    const orders = await listOrders(localId)
    return buildDashboardFromOrders(orders, { localCount: 1 })
  }
  const path = withQuery('/dashboard/consolidated', { business_id: businessId })
  return apiRequest(path, { token })
}

export function getOrdersByLocal(localId, token, status) {
  void token
  return listOrders(localId, { status })
}

export async function getCajasByLocal(localId, token) {
  void token
  const [cajas, mpStatuses] = await Promise.all([
    listCajas(localId),
    apiRequest(`/locals/${encodeURIComponent(localId)}/mp/cajas-status`).catch(() => []),
  ])
  const statusByCaja = new Map((mpStatuses || []).map((s) => [String(s.caja_id), s]))
  return cajas.map((c) => ({ ...c, mp: statusByCaja.get(String(c.id)) || null }))
}

export function createCaja(body) {
  return createCajaV2(body)
}

export { getCajaResumen, getMovimientosCaja, closeCaja, getResumenDiario }

export function provisionCajaMp(cajaId) {
  return apiRequest(`/cajas/${cajaId}/mp/provision`, { method: 'POST' })
}

export function verifyCajaMpPairing(cajaId) {
  return apiRequest(`/cajas/${cajaId}/mp/verify-pairing`, { method: 'POST' })
}

export function putLocalMpLocation(localId, body) {
  return apiRequest(`/locals/${localId}/mp-location`, { method: 'PUT', body })
}

export function getAvailableMpPos(localId) {
  return apiRequest(`/locals/${localId}/mp/available-pos`)
}

export function assignExistingMpPos(cajaId, mercadopagoPosId) {
  return apiRequest(`/cajas/${cajaId}/mp/assign-existing`, {
    method: 'POST',
    body: { mercadopago_pos_id: mercadopagoPosId },
  })
}

export async function getRendicionesDashboard(localId, token, options = {}) {
  void localId
  void token
  void options
  if (!isV2FeatureEnabled('rendiciones')) return { ...EMPTY_RENDICIONES }
  const { startDate, endDate, movementLimit = 100 } = options
  const path = withQuery('/dashboard/rendiciones', {
    local_id: localId,
    start_date: startDate,
    end_date: endDate,
    movement_limit: movementLimit,
  })
  return apiRequest(path, { token })
}

export async function getExpensesByLocal(localId, token, status) {
  void localId
  void token
  void status
  if (!isV2FeatureEnabled('rendiciones')) return []
  const path = withQuery('/expenses', { local_id: localId, status })
  return apiRequest(path, { token })
}

export async function getTransfersByLocal(localId, token, status) {
  void localId
  void token
  void status
  if (!isV2FeatureEnabled('rendiciones')) return []
  const path = withQuery('/transfers', { local_id: localId, status })
  return apiRequest(path, { token })
}

export function postExpense(body) {
  if (!isV2FeatureEnabled('rendiciones')) {
    throw new Error('Rendiciones aún no están disponibles en Backend V2')
  }
  return apiRequest('/expenses', { method: 'POST', body })
}

export function postTransfer(body) {
  if (!isV2FeatureEnabled('rendiciones')) {
    throw new Error('Rendiciones aún no están disponibles en Backend V2')
  }
  return apiRequest('/transfers', { method: 'POST', body })
}

export function patchExpense(expenseId, body) {
  if (!isV2FeatureEnabled('rendiciones')) {
    throw new Error('Rendiciones aún no están disponibles en Backend V2')
  }
  return apiRequest(`/expenses/${expenseId}`, { method: 'PATCH', body })
}

export function patchTransfer(transferId, body) {
  if (!isV2FeatureEnabled('rendiciones')) {
    throw new Error('Rendiciones aún no están disponibles en Backend V2')
  }
  return apiRequest(`/transfers/${transferId}`, { method: 'PATCH', body })
}

export async function getIncomeTrend(localId, token, days = 7) {
  void token
  void days
  if (!isV2FeatureEnabled('adminDashboard')) return []
  const path = withQuery(`/dashboard/local/${localId}/trend`, { days })
  return apiRequest(path, { token })
}
