/** Alineado con ProductsTable / KPIs backend: crítico vs bajo. */
export function getStockAlertLevel(row) {
  const stockCurrent = Number(row.stock_current ?? 0)
  if (row.stock_min != null && stockCurrent <= Number(row.stock_min)) {
    return 'critical'
  }
  if (row.stock_max != null && stockCurrent < Math.max(1, Math.floor(Number(row.stock_max) / 4))) {
    return 'low'
  }
  return null
}
