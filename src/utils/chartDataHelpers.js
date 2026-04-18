/**
 * Datos de prueba para gráficos en módulo administrativo
 * Se usa cuando no hay datos reales disponibles
 */

export const MOCK_INCOME_TREND = [
  { date: 'Lun', ingresos: 320000, promedio: 280000 },
  { date: 'Mar', ingresos: 420000, promedio: 280000 },
  { date: 'Mié', ingresos: 198000, promedio: 280000 },
  { date: 'Jue', ingresos: 480000, promedio: 280000 },
  { date: 'Vie', ingresos: 650000, promedio: 280000 },
  { date: 'Sáb', ingresos: 890000, promedio: 280000 },
  { date: 'Dom', ingresos: 720000, promedio: 280000 },
]

export const MOCK_EXPENSES_BREAKDOWN = [
  { category: 'Suministros', amount: 150000 },
  { category: 'Personal', amount: 400000 },
  { category: 'Arriendos', amount: 250000 },
  { category: 'Servicios', amount: 100000 },
  { category: 'Mantenimiento', amount: 75000 },
]

/**
 * Genera datos de prueba transformados para gráficos
 * @param {Object} dashboard - Datos del dashboard del backend
 * @returns {Object} Dashboard enriquecido con datos de gráficos
 */
export function enrichDashboardWithChartData(dashboard) {
  if (!dashboard) {
    return {
      daily_income_trend: MOCK_INCOME_TREND,
      expenses_breakdown: MOCK_EXPENSES_BREAKDOWN,
    }
  }

  return {
    ...dashboard,
    daily_income_trend: dashboard.daily_income_trend || MOCK_INCOME_TREND,
    expenses_breakdown: dashboard.expenses_breakdown || MOCK_EXPENSES_BREAKDOWN,
  }
}

/**
 * Genera datos reales a partir de órdenes (si existen)
 * @param {Array} orders - Lista de órdenes
 * @returns {Array} Datos de tendencia de ingresos
 */
export function generateIncomeTrendFromOrders(orders = []) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return MOCK_INCOME_TREND
  }

  const dailyMap = {}

  // Agrupar órdenes por día
  orders.forEach((order) => {
    const date = new Date(order.created_at || Date.now())
    const dayName = date.toLocaleDateString('es-CL', { weekday: 'short' })
    const key = dayName.charAt(0).toUpperCase() + dayName.slice(1)

    const amount = Number(order.total) || Number(order.subtotal) || 0

    if (!dailyMap[key]) {
      dailyMap[key] = 0
    }
    dailyMap[key] += amount
  })

  // Convertir a array para gráfico
  const trend = Object.entries(dailyMap).map(([date, ingresos]) => ({
    date,
    ingresos,
    promedio: orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) / Object.keys(dailyMap).length,
  }))

  return trend.length > 0 ? trend : MOCK_INCOME_TREND
}

/**
 * Genera desglose de gastos a partir de datos de gastos
 * @param {Array} expenses - Lista de gastos
 * @returns {Array} Datos desglosados por categoría
 */
export function generateExpenseBreakdownFromData(expenses = []) {
  if (!Array.isArray(expenses) || expenses.length === 0) {
    return MOCK_EXPENSES_BREAKDOWN
  }

  const categoryMap = {}

  // Agrupar gastos por categoría
  expenses.forEach((expense) => {
    const category = expense.category || expense.type || 'Otro'
    const amount = Number(expense.amount) || Number(expense.total) || 0

    if (!categoryMap[category]) {
      categoryMap[category] = 0
    }
    categoryMap[category] += amount
  })

  // Convertir a array para gráfico
  const breakdown = Object.entries(categoryMap)
    .map(([category, amount]) => ({
      category,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)

  return breakdown.length > 0 ? breakdown : MOCK_EXPENSES_BREAKDOWN
}
