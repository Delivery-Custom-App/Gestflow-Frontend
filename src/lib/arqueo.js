/**
 * Arqueo de caja (B-18, sección 5e): lo que se contó al cerrar contra lo que
 * debería haber en el cajón.
 *
 * - `efectivo_esperado` = apertura + lo cobrado en efectivo + ingresos de caja
 *   en efectivo − lo que salió en efectivo. Lo cobrado con tarjeta no está.
 * - `diferencia` = contado − esperado: negativa si falta plata.
 */
import { formatCLPCurrency as formatMoney } from './formatCLP'

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

/** Número o null (los montos del backend vienen como texto). */
export function monto(v) {
  const n = num(v)
  return Number.isFinite(n) ? n : null
}

/** «Faltan $300», «Sobran $200» o «Cuadra». null si no hay dato. */
export function textoDiferencia(diferencia) {
  const d = monto(diferencia)
  if (d === null) return null
  if (d === 0) return 'Cuadra'
  return d < 0 ? `Faltan ${formatMoney(Math.abs(d))}` : `Sobran ${formatMoney(d)}`
}

/** Diferencia calculada en pantalla: contado − esperado (null si falta uno). */
export function diferenciaDe(contado, esperado) {
  const c = monto(contado)
  const e = monto(esperado)
  if (c === null || e === null) return null
  return Math.round((c - e) * 100) / 100
}

/** ¿La caja cerrada tiene arqueo? (las cerradas antes de B-18 traen todo en null). */
export function tieneArqueo(caja) {
  return monto(caja?.monto_cierre_declarado) !== null
}
