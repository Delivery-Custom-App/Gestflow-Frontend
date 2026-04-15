/**
 * HU-44: si el API envía `stock_status` (OPTIMO | BAJO | CRITICO), se usa tal cual.
 * Si no, regla previa por compatibilidad.
 */
export function getStockAlertLevel(row) {
  const api = row.stock_status
  if (api === 'CRITICO') return 'critical'
  if (api === 'BAJO') return 'low'
  if (api === 'OPTIMO') return null

  const stockCurrent = Number(row.stock_current ?? 0)
  if (row.stock_min != null && stockCurrent <= Number(row.stock_min)) {
    return 'critical'
  }
  if (row.stock_max != null && stockCurrent < Math.max(1, Math.floor(Number(row.stock_max) / 4))) {
    return 'low'
  }
  return null
}

/** Etiqueta en español + variante visual para badges (HU-44). */
export function getStockStatusMeta(row) {
  const level = getStockAlertLevel(row)
  if (level === 'critical') return { label: 'Crítico', variant: 'critical' }
  if (level === 'low') return { label: 'Bajo', variant: 'low' }
  return { label: 'Óptimo', variant: 'optimal' }
}
