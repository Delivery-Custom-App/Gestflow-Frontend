/** Zona horaria del negocio (Chile). */
export const CHILE_TZ = 'America/Santiago'

/**
 * Parsea fechas de la API. Si vienen sin zona (ej. "2026-06-19T00:18:48"),
 * se interpretan como UTC — Postgres/Supabase guarda timestamptz en UTC.
 */
export function parseApiDate(iso) {
  if (iso == null || iso === '') return null
  const s = String(iso).trim()
  if (!s) return null
  const hasTz = /[zZ]$|[+-]\d{2}:\d{2}$/.test(s)
  const normalized = hasTz ? s : (s.includes('T') ? `${s}Z` : s)
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Hora en Chile (ej. 8:18 p.m.) a partir de ISO UTC de la API. */
export function formatChileTime(iso) {
  const d = parseApiDate(iso)
  if (!d) return '—'
  return d.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: CHILE_TZ,
    hour12: true,
  })
}

/** Hora entera en Chile (0–23) desde ISO UTC. */
export function chileHourFromIso(iso) {
  const d = parseApiDate(iso)
  if (!d) return null
  return Number(
    d.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: CHILE_TZ }),
  )
}

/** Etiqueta de hora entera (0–23) en formato 12 h chileno. */
export function formatChileHour(hour24) {
  if (hour24 == null || hour24 === undefined) return '—'
  const h12 = hour24 % 12 || 12
  const period = hour24 < 12 ? 'a.m.' : 'p.m.'
  return `${h12}:00 ${period}`
}

/** Porcentaje visible: no redondea 0.1% a 0%. */
export function formatPaymentPct(pct) {
  if (!pct || pct <= 0) return '0%'
  if (pct < 1) return `${pct.toFixed(1)}%`
  return `${Math.round(pct)}%`
}

/** Etiquetas legibles de método de pago en dashboard / POS. */
export function paymentMethodLabel(method) {
  const key = String(method || '').trim().toLowerCase()
  const MAP = {
    cash: 'Efectivo',
    efectivo: 'Efectivo',
    card: 'Tarjeta',
    debit: 'Débito',
    debito: 'Débito',
    credit: 'Crédito',
    credito: 'Crédito',
    transfer: 'Transferencia',
    transferencia: 'Transferencia',
    mercadopago: 'MercadoPago',
    mercadopago_point: 'MercadoPago Point',
    mercadopago_point_debit: 'MP Débito',
    mercadopago_point_credit: 'MP Crédito',
    other: 'Otro',
  }
  return MAP[key] || (key ? key : '—')
}
