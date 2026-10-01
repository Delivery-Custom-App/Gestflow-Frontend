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
import { getProductsReport, getSalesReport } from './reportsApi'
import { isV2FeatureEnabled } from './v2Features'

const safeList = (v) => (Array.isArray(v) ? v : [])

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

export function getOrdersByLocal(localId, token, status) {
  void token
  return listOrders(localId, { status })
}

export async function getCajasByLocal(localId, token) {
  void token
  return listCajas(localId)
}

/** Últimos 7 días (hoy incluido) como fechas YYYY-MM-DD. */
function ultimos7Dias(hoy = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy)
    d.setDate(d.getDate() - (6 - i))
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  })
}

/** 'dd/mm' para el eje del gráfico. */
function etiquetaDia(iso) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const METODOS_TARJETA = new Set(['debit', 'credit', 'card', 'debito', 'credito', 'tarjeta'])

/**
 * Indicadores de la sección Ventas, calculados por el backend.
 *
 * Antes la pantalla se bajaba TODAS las órdenes del local y sumaba en el
 * navegador. Ahora usa los reportes agregados (`/reports/sales` por día y
 * `/reports/products`) más el arqueo del día (`/cajas/resumen-diario`), que ya
 * trae el desglose por método de pago.
 *
 * El detalle orden por orden sigue necesitando `/orders`, pero se carga solo si
 * el usuario lo pide: ya no se descarga para pintar indicadores.
 */
export async function getVentasIndicadores(localId) {
  const dias = ultimos7Dias()
  const [porDia, productos, resumen] = await Promise.all([
    Promise.all(dias.map((d) => getSalesReport(localId, { startDate: d, endDate: d }).catch(() => null))),
    getProductsReport(localId, { startDate: dias[0], endDate: dias[dias.length - 1] }).catch(() => null),
    getResumenDiario(localId).catch(() => null),
  ])

  const tendenciaBruta = dias.map((iso, i) => ({
    date: etiquetaDia(iso),
    ingresos: Number(porDia[i]?.total_sales) || 0,
  }))
  const promedio = Math.round(tendenciaBruta.reduce((s, p) => s + p.ingresos, 0) / dias.length)

  const porMetodo = { efectivo: 0, tarjetas: 0, otros: 0 }
  for (const fila of safeList(resumen?.por_metodo)) {
    const metodo = String(fila.payment_method || '').toLowerCase()
    const monto = Number(fila.total) || 0
    if (metodo === 'cash' || metodo === 'efectivo') porMetodo.efectivo += monto
    else if (METODOS_TARJETA.has(metodo)) porMetodo.tarjetas += monto
    else porMetodo.otros += monto
  }

  const hoy = porDia[porDia.length - 1]
  return {
    hoy: {
      total: Number(resumen?.total_ingresos) || Number(hoy?.total_sales) || 0,
      ordenes: Number(hoy?.total_orders) || 0,
    },
    porMetodo,
    tendencia: tendenciaBruta.map((p) => ({ ...p, promedio })),
    topProductos: safeList(productos?.ranking).map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      units_sold: Number(p.quantity_sold) || 0,
      revenue: Number(p.revenue) || 0,
    })),
  }
}

/**
 * Cajas físicas del local con su estado de vinculación a MercadoPago.
 *
 * El terminal Point se vincula a la **caja física** (el mueble donde está el
 * hardware), no al turno de caja: en V2 el device cuelga de
 * `pos_machines.caja_fisica_id` y los endpoints viven bajo `/cajas-fisicas/...`.
 * Un turno dura un día; la terminal sigue ahí mañana.
 *
 * V2 expone el nombre como `nombre`; se normaliza a `name` para el resto de la UI.
 */
export async function getCajasFisicasByLocal(localId) {
  const pedirEstadoMp = apiRequest(`/locals/${encodeURIComponent(localId)}/mp/cajas-fisicas-status`)
    // Se distingue "no hay vinculación" de "no se pudo consultar": tragarse el
    // error y devolver lista vacía hacía que la columna dijera "Sin vincular",
    // que es un estado falso.
    .then((filas) => ({ filas, disponible: true }))
    .catch(() => ({ filas: [], disponible: false }))

  const [cajasFisicas, estadoMp] = await Promise.all([
    apiRequest(`/cajas-fisicas?local_id=${encodeURIComponent(localId)}`),
    pedirEstadoMp,
  ])

  const statusByCajaFisica = new Map(safeList(estadoMp.filas).map((s) => [String(s.caja_fisica_id), s]))
  return safeList(cajasFisicas).map((c) => ({
    ...c,
    name: c.nombre ?? c.name ?? null,
    mp: statusByCajaFisica.get(String(c.id)) || null,
    mpDisponible: estadoMp.disponible,
  }))
}

export function createCaja(body) {
  return createCajaV2(body)
}

export { getCajaResumen, getMovimientosCaja, closeCaja, getResumenDiario }

/** Alta de caja física. El backend responde 409 si el nombre ya existe en el local. */
export async function crearCajaFisica(localId, nombre) {
  const row = await apiRequest('/cajas-fisicas', {
    method: 'POST',
    body: { local_id: localId, nombre: String(nombre || '').trim() },
  })
  return { ...row, name: row?.nombre ?? null }
}

/** Renombra una caja física. Misma regla de nombre único por local. */
export async function renombrarCajaFisica(cajaFisicaId, nombre) {
  const row = await apiRequest(`/cajas-fisicas/${encodeURIComponent(String(cajaFisicaId))}`, {
    method: 'PATCH',
    body: { nombre: String(nombre || '').trim() },
  })
  return { ...row, name: row?.nombre ?? null }
}

export function provisionCajaFisicaMp(cajaFisicaId) {
  return apiRequest(`/cajas-fisicas/${cajaFisicaId}/mp/provision`, { method: 'POST' })
}

export function verifyCajaFisicaMpPairing(cajaFisicaId) {
  return apiRequest(`/cajas-fisicas/${cajaFisicaId}/mp/verify-pairing`, { method: 'POST' })
}

export function putLocalMpLocation(localId, body) {
  return apiRequest(`/locals/${localId}/mp-location`, { method: 'PUT', body })
}

export function getAvailableMpPos(localId) {
  return apiRequest(`/locals/${localId}/mp/available-pos`)
}

export function assignExistingMpPos(cajaFisicaId, mercadopagoPosId) {
  return apiRequest(`/cajas-fisicas/${cajaFisicaId}/mp/assign-existing`, {
    method: 'POST',
    body: { mercadopago_pos_id: mercadopagoPosId },
  })
}

export async function getIncomeTrend(localId, token, days = 7) {
  void token
  void days
  if (!isV2FeatureEnabled('adminDashboard')) return []
  const path = withQuery(`/dashboard/local/${localId}/trend`, { days })
  return apiRequest(path, { token })
}
