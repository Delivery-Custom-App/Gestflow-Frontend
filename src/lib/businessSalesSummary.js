/**
 * Agregados de venta a nivel negocio (todas las franquicias) para los cards
 * de "venta semanal" y "comparativa mensual" del resumen del Inicio del dueño.
 * La semana y la comparativa mensual salen de /reports/sales, agregadas por
 * fecha contable en el servidor.
 */
import { apiRequest, getOptionalAuthContext } from './apiClient'

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const pad = (n) => String(n).padStart(2, '0')
const isoDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Rangos de los últimos `count` meses (el actual al final), con fechas
 * YYYY-MM-DD inclusivas: del primer al último día del mes, y el mes en curso
 * cortado en `hoy`.
 */
export function rangosMensuales(hoy = new Date(), count = 4) {
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i
    const start = new Date(hoy.getFullYear(), hoy.getMonth() - offset, 1)
    const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() - offset + 1, 0)
    const end = offset === 0 ? hoy : ultimo
    return { label: MONTH_LABELS[start.getMonth()], startDate: isoDia(start), endDate: isoDia(end) }
  })
}

/** `business_id` del local para /reports/sales (el backend lo exige a SUPERADMIN). */
const businessParam = (local) => (local?.business_id != null ? { business_id: String(local.business_id) } : {})

/** Variación porcentual redondeada; null si falta un dato o el anterior es 0. */
export function variacion(actual, anterior) {
  if (actual == null || anterior == null || !(anterior > 0)) return null
  return Math.round(((actual - anterior) / anterior) * 100)
}

/**
 * Venta completada de los locales en el rango, sumando `total_sales` de
 * /reports/sales. Si falla la llamada de algún local devuelve null (la
 * pantalla muestra «—» en vez de un 0 que parecería real).
 */
async function totalDelRango(locals, token, { startDate, endDate }) {
  try {
    const reportes = await Promise.all(
      locals.map((l) => apiRequest(
        `/reports/sales?${new URLSearchParams({ local_id: String(l.id), ...businessParam(l), start_date: startDate, end_date: endDate })}`,
        { token },
      )),
    )
    return reportes.reduce((sum, r) => sum + Number(r?.total_sales || 0), 0)
  } catch {
    return null
  }
}

function todayInChileIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function shiftIsoDate(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function mondayOfWeek(isoDate) {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
  return shiftIsoDate(isoDate, day === 0 ? -6 : 1 - day)
}

async function sumSalesReports(locals, token, startDate, endDate) {
  const responses = await Promise.all(
    locals.map((local) => apiRequest(
      `/reports/sales?${new URLSearchParams({
        local_id: String(local.id), ...businessParam(local), start_date: startDate, end_date: endDate,
      })}`,
      { token },
    )),
  )
  const totalsByDay = new Map()
  for (const report of responses) {
    for (const row of Array.isArray(report?.by_day) ? report.by_day : []) {
      const current = totalsByDay.get(row.date) || { total: 0, count: 0 }
      current.total += Number(row.total_sales) || 0
      current.count += Number(row.total_orders) || 0
      totalsByDay.set(row.date, current)
    }
  }
  return totalsByDay
}

/**
 * @param {Array} locales
 * @returns {Promise<{weekly: object, monthly: object}|null>}
 */
export async function fetchBusinessSalesSummary(locales) {
  if (!Array.isArray(locales) || locales.length === 0) return null
  const { token } = await getOptionalAuthContext()
  if (!token) return null

  const now = new Date()
  const today = todayInChileIso(now)
  const monday = mondayOfWeek(today)
  const sunday = shiftIsoDate(monday, 6)
  const weeklySalesByDay = await sumSalesReports(locales, token, monday, sunday).catch(() => null)

  const days = DAY_LABELS.map((label, i) => {
    const date = shiftIsoDate(monday, i)
    const dayStart = new Date(`${date}T00:00:00Z`)
    const reportDay = weeklySalesByDay?.get(date)
    return {
      label,
      date: dayStart,
      total: reportDay?.total ?? 0,
      count: reportDay?.count ?? 0,
      isToday: date === today,
      isFuture: date > today,
    }
  })

  const weekTotal = days.reduce((sum, d) => sum + d.total, 0)
  const todayIdx = days.findIndex((d) => d.isToday)
  let changeVsYesterday = null
  if (todayIdx > 0) {
    const today = days[todayIdx].total
    const yesterday = days[todayIdx - 1].total
    changeVsYesterday = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : null
  }

  // ── Mensual: mes actual + 3 anteriores (T-28) ────────────────────────
  // Cada mes sale de /reports/sales (una llamada por local y mes), que suma
  // las órdenes completadas por día contable. El mes en curso se corta hoy.
  const monthCount = 4
  const monthTotals = await Promise.all(
    rangosMensuales(now, monthCount).map(async (range) => ({
      label: range.label,
      start: range.startDate,
      end: range.endDate,
      total: await totalDelRango(locales, token, range),
    })),
  )

  const months = monthTotals.map((m, i) => {
    const prev = i > 0 ? monthTotals[i - 1].total : null
    return { ...m, momPercent: variacion(m.total, prev) }
  })

  const accumulatedPercent = variacion(monthTotals[monthTotals.length - 1].total, monthTotals[0].total)

  return {
    weekly: { days, total: weekTotal, changeVsYesterday },
    monthly: { months, accumulatedPercent, monthsSpan: monthCount },
  }
}
