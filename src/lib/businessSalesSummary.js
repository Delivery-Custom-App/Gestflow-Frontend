/**
 * Agregados de venta a nivel negocio (todas las franquicias) para los cards
 * de "venta semanal" y "comparativa mensual" del resumen de Tus Franquicias.
 * Reutiliza /orders por local (mismo endpoint que el indicador de Flujo),
 * sumando `total` de pedidos con status COMPLETED.
 */
import { apiRequest, getOptionalAuthContext } from './apiClient'

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

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

  // ── Mensual: mes actual + 3 anteriores ──────────────────────────────
  const monthCount = 4
  const monthRanges = Array.from({ length: monthCount }, (_, i) => {
    const offset = monthCount - 1 - i
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1)
    return { start, end, label: MONTH_LABELS[start.getMonth()] }
  })

  // Lecturas independientes por mes: en paralelo (Promise.all conserva el orden).
  const monthTotals = await Promise.all(monthRanges.map(async (range) => {
    const orders = await sumOrdersInRange(locales, token, range.start, range.end)
    const total = orders.filter(isCompleted).reduce((sum, o) => sum + Number(o.total || 0), 0)
    return { label: range.label, total }
  }))

  const months = monthTotals.map((m, i) => {
    if (i === 0) return { ...m, momPercent: null }
    const prev = monthTotals[i - 1].total
    const momPercent = prev > 0 ? Math.round(((m.total - prev) / prev) * 100) : null
    return { ...m, momPercent }
  })

  const first = monthTotals[0].total
  const last = monthTotals[monthTotals.length - 1].total
  const accumulatedPercent = first > 0 ? Math.round(((last - first) / first) * 100) : null

  return {
    weekly: { days, total: weekTotal, changeVsYesterday },
    monthly: { months, accumulatedPercent, monthsSpan: monthCount },
  }
}
