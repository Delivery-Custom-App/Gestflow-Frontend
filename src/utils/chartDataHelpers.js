export function enrichDashboardWithChartData(dashboard) {
  if (!dashboard) {
    return { daily_income_trend: [], expenses_breakdown: [] }
  }
  return {
    ...dashboard,
    daily_income_trend: dashboard.daily_income_trend || [],
    expenses_breakdown: dashboard.expenses_breakdown || [],
  }
}

const RANGE_CONFIG = {
  '1h':  { windowMin: 60,    bucketMin: 5   },
  '4h':  { windowMin: 240,   bucketMin: 20  },
  '12h': { windowMin: 720,   bucketMin: 60  },
  '1d':  { windowMin: 1440,  bucketMin: 120 },
  '7d':  null,
}

export function generateIncomeTrendFromOrders(orders = [], range = '7d') {
  if (!Array.isArray(orders)) return []

  if (range === '7d') {
    const scaffold = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      scaffold.push(d)
    }
    const dailyMap = {}
    scaffold.forEach((d) => {
      dailyMap[d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })] = 0
    })
    orders.forEach((order) => {
      const key = new Date(order.created_at || Date.now())
        .toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })
      if (key in dailyMap) dailyMap[key] += Number(order.total) || Number(order.subtotal) || 0
    })
    const total = Object.values(dailyMap).reduce((s, v) => s + v, 0)
    const avg = Math.round(total / 7)
    return Object.entries(dailyMap).map(([date, ingresos]) => ({ date, ingresos, promedio: avg }))
  }

  const { windowMin, bucketMin } = RANGE_CONFIG[range] || RANGE_CONFIG['1d']
  const now = Date.now()
  const windowStart = now - windowMin * 60 * 1000
  const bucketCount = Math.ceil(windowMin / bucketMin)

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const start = windowStart + i * bucketMin * 60 * 1000
    const d = new Date(start)
    return {
      label: d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      start,
      end: start + bucketMin * 60 * 1000,
      ingresos: 0,
    }
  })

  orders.forEach((order) => {
    const t = new Date(order.created_at || now).getTime()
    if (t < windowStart || t > now) return
    const bucket = buckets.find((b) => t >= b.start && t < b.end)
    if (bucket) bucket.ingresos += Number(order.total) || Number(order.subtotal) || 0
  })

  const total = buckets.reduce((s, b) => s + b.ingresos, 0)
  const avg = Math.round(total / bucketCount)

  return buckets.map((b) => ({ date: b.label, ingresos: b.ingresos, promedio: avg }))
}

export function generateExpenseBreakdownFromData(expenses = []) {
  if (!Array.isArray(expenses) || expenses.length === 0) return []

  const categoryMap = {}
  expenses.forEach((expense) => {
    const category = expense.category || expense.type || 'Otro'
    const amount = Number(expense.amount) || Number(expense.total) || 0
    categoryMap[category] = (categoryMap[category] || 0) + amount
  })

  return Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}
