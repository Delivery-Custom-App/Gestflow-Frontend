/**
 * Umbral de flujo de Inicio: cuántas ventas en el período marcan cada
 * franquicia en flujo bajo (verde), medio (amarillo) o alto (rojo).
 *
 * Es uno solo para todos los locales. Se guarda en este navegador: para que
 * sea el mismo en todos los equipos y para todas las personas hay que
 * guardarlo en el backend (B-07).
 */

export const UMBRAL_KEY = 'gestflow_flow_thresholds'

/** Período en horas (1 por defecto) y desde cuántas ventas es medio y alto. */
export const UMBRAL_POR_DEFECTO = { horas: 1, medium: 5, high: 15 }

/** Cada cuánto se vuelve a contar sin recargar la página. */
export const REFRESCO_FLUJO_MS = 60_000

const enteroPositivo = (v) => Number.isInteger(v) && v >= 1

/** El umbral guardado. Lo que no sirva (o el "período en días" de antes) vuelve al valor por defecto. */
export function cargarUmbral() {
  try {
    const guardado = JSON.parse(localStorage.getItem(UMBRAL_KEY) || 'null')
    // Los valores por defecto de antes (20 y 50) eran para 24 horas: con el
    // período en horas no sirven, así que se toman los nuevos.
    const eraElDeAntes = guardado && !('horas' in guardado) && guardado.medium === 20 && guardado.high === 50
    if (guardado && !eraElDeAntes && enteroPositivo(guardado.medium) && enteroPositivo(guardado.high) && guardado.medium < guardado.high) {
      return {
        horas: enteroPositivo(guardado.horas) ? guardado.horas : UMBRAL_POR_DEFECTO.horas,
        medium: guardado.medium,
        high: guardado.high,
      }
    }
  } catch { /* sin storage o dato roto: valores por defecto */ }
  return { ...UMBRAL_POR_DEFECTO }
}

export function guardarUmbral(umbral) {
  const limpio = { horas: umbral.horas, medium: umbral.medium, high: umbral.high }
  try { localStorage.setItem(UMBRAL_KEY, JSON.stringify(limpio)) } catch { /* sin storage: vale solo esta sesión */ }
  return limpio
}

/** Validación del formulario; devuelve el mensaje de error o null. */
export function errorDeUmbral({ horas, medium, high }) {
  if (!enteroPositivo(horas) || horas > 168) return 'El período debe ser de 1 a 168 horas (una semana).'
  if (!enteroPositivo(medium) || !enteroPositivo(high)) return 'Los umbrales deben ser números enteros mayores que 0.'
  if (medium >= high) return 'El umbral de flujo medio debe ser menor que el de flujo alto.'
  return null
}

/** Desde y hasta del período, terminando ahora. */
export function rangoDelPeriodo(horas, ahora = new Date()) {
  return { desde: new Date(ahora.getTime() - horas * 3_600_000), hasta: ahora }
}

/** "la última hora" / "las últimas 3 horas" */
export function textoDelPeriodo(horas) {
  return horas === 1 ? 'la última hora' : `las últimas ${horas} horas`
}

/** Una venta es una orden que no se canceló. */
export function esVenta(orden) {
  return String(orden?.status || '').toLowerCase() !== 'cancelled'
}

const TIER_ORDER = { Bajo: 0, Medio: 1, Alto: 2 }

export function getSalesFlow(count, umbral) {
  if (count === undefined || count === null) return null
  if (count >= umbral.high)
    return { label: 'Alto',  dotColor: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' }
  if (count >= umbral.medium)
    return { label: 'Medio', dotColor: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' }
  return   { label: 'Bajo',  dotColor: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' }
}

/**
 * Flecha de tendencia: compara el conteo del período con el mismo período
 * corrido una hora atrás (cambia la última hora por la anterior). 'up' si
 * subió de color, 'down' si bajó, null si no cambió.
 */
export function getFlowTrend(currentCount, delta, umbral) {
  if (!delta || currentCount == null) return null
  const prevCount = currentCount - delta.current + delta.prev
  const currFlow = getSalesFlow(currentCount, umbral)
  const prevFlow = getSalesFlow(prevCount, umbral)
  if (!currFlow || !prevFlow || currFlow.label === prevFlow.label) return null
  return TIER_ORDER[currFlow.label] > TIER_ORDER[prevFlow.label] ? 'up' : 'down'
}
