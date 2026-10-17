/**
 * Efectivo contado por denominación (T-40): billetes y monedas del cajón. Se
 * cuenta siempre al cerrar el turno de una caja física (T-55); la apertura no
 * cuenta: su monto se escribe a mano como un solo total.
 */
import { formatCLP } from './formatCLP'

/** Billetes y monedas chilenos en uso, de mayor a menor. $1 y $5 casi no circulan. */
export const DENOMINACIONES = [
  { valor: 20000, tipo: 'billete' },
  { valor: 10000, tipo: 'billete' },
  { valor: 5000, tipo: 'billete' },
  { valor: 2000, tipo: 'billete' },
  { valor: 1000, tipo: 'billete' },
  { valor: 500, tipo: 'moneda' },
  { valor: 100, tipo: 'moneda' },
  { valor: 50, tipo: 'moneda' },
  { valor: 10, tipo: 'moneda' },
]

/** "$20.000" */
export function etiquetaDenominacion(valor) {
  return `$${formatCLP(valor)}`
}

/** Cantidad escrita a mano: solo dígitos, vacío es 0. "1.000" se lee 1000, "-3" se lee 3. */
export function cantidadDesdeTexto(texto) {
  const limpio = String(texto ?? '').replace(/[^\d]/g, '')
  return limpio === '' ? 0 : Number(limpio)
}

const cantidadDe = (cantidades, valor) => {
  const n = Number(cantidades?.[valor])
  return Number.isInteger(n) && n > 0 ? n : 0
}

/**
 * Filas con su subtotal y los totales de billetes, monedas y general.
 * @param {Record<number, number>} cantidades cantidad por valor de denominación
 */
export function totalesDelConteo(cantidades) {
  const filas = DENOMINACIONES.map((d) => {
    const cantidad = cantidadDe(cantidades, d.valor)
    return { ...d, cantidad, subtotal: cantidad * d.valor }
  })
  const totalBilletes = filas.filter((f) => f.tipo === 'billete').reduce((s, f) => s + f.subtotal, 0)
  const totalMonedas = filas.filter((f) => f.tipo === 'moneda').reduce((s, f) => s + f.subtotal, 0)
  return { filas, totalBilletes, totalMonedas, total: totalBilletes + totalMonedas }
}

/** Desglose que devuelve el backend (turnos abiertos con conteo) → filas para mostrar, de mayor a menor. */
export function filasDelDesglose(desglose) {
  return (Array.isArray(desglose) ? desglose : [])
    .map((d) => ({ valor: Number(d.denominacion), tipo: d.tipo, cantidad: Number(d.cantidad) || 0 }))
    .filter((d) => d.valor > 0 && d.cantidad > 0)
    .sort((a, b) => b.valor - a.valor)
    .map((d) => ({ ...d, subtotal: d.valor * d.cantidad }))
}
