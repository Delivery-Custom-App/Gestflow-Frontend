/**
 * Formatea un valor numérico como Peso Chileno (CLP).
 * CLP no usa decimales — los valores siempre son enteros.
 *
 * @param {number|string} value - Monto a formatear
 * @returns {string} Ej: 43000 → "43.000"
 *
 * Usar en JSX como: <span>${formatCLP(price)}</span>
 */
const CLP_NUMBER = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const CLP_CURRENCY = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

export function formatCLP(value) {
  return CLP_NUMBER.format(Math.round(Number(value) || 0))
}

/** null/NaN → "—"; si no, dígitos agrupados sin símbolo. */
export function formatCLPOrDash(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return formatCLP(value)
}

/** null/NaN → "—"; si no, "$43.000". */
export function formatCLPDisplay(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `$${formatCLP(value)}`
}

/** KPIs admin: inválido → $0; estilo moneda es-CL. */
export function formatCLPCurrency(value) {
  const n = Number(value)
  const amount = Number.isFinite(n) ? Math.round(n) : 0
  return CLP_CURRENCY.format(amount)
}
