/**
 * Agregados de venta a nivel negocio (todas las franquicias) para los cards
 * de "venta semanal" y "comparativa mensual" del resumen del Inicio del dueño.
 * La semana reutiliza /orders por local (mismo endpoint que el indicador de
 * Flujo); la comparativa mensual sale de /reports/sales (T-28).
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
        `/reports/sales?${new URLSearchParams({ local_id: String(l.id), start_date: startDate, end_date: endDate })}`,
        { token },
      )),
    )
    return reportes.reduce((sum, r) => sum + Number(r?.total_sales || 0), 0)
  } catch {
    return null
  }
}

function isCompleted(order) {
  return String(order?.status || '').toLowerCase() === 'completed'
}

function mondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=domingo..6=sábado
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

async function sumOrdersInRange(locals, token, dateFrom, dateTo) {
  const results = await Promise.all(
    locals.map((l) =>
      apiRequest(
        `/orders?local_id=${l.id}&date_from=${encodeURIComponent(dateFrom.toISOString())}&date_to=${encodeURIComponent(dateTo.toISOString())}`,
        { token },
      )
        .then((orders) => (Array.isArray(orders) ? orders : []))
        .catch(() => []),
    ),
  )
  return results.flat()
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
  const monday = mondayOfWeek(now)
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)

  const weekOrders = await sumOrdersInRange(locales, token, monday, nextMonday)
  const completedWeekOrders = weekOrders.filter(isCompleted)

  const days = DAY_LABELS.map((label, i) => {
    const dayStart = new Date(monday)
    dayStart.setDate(dayStart.getDate() + i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const dayOrders = completedWeekOrders.filter((o) => {
      const d = new Date(o.created_at)
      return d >= dayStart && d < dayEnd
    })
    const total = dayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    return {
      label,
      date: dayStart,
      total,
      count: dayOrders.length,
      isToday: dayStart.toDateString() === now.toDateString(),
      isFuture: dayStart > now,
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
