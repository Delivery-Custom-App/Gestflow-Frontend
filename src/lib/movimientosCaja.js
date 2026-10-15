/**
 * Retiros, gastos e ingresos de caja (T-56, B-18 sección 5e): plata que sale o
 * entra del cajón durante el turno y que no es una venta.
 *
 * `POST /cajas/{id}/movimientos` con `tipo` (`egreso` | `ingreso`), `monto`,
 * `note` y `payment_method` (por defecto `cash`). Solo el administrador del
 * local y el dueño; solo en un turno abierto (400 si está cerrado). Es un
 * libro: no se edita ni se borra; un error se compensa con otro movimiento.
 * Solo el efectivo cambia lo que debería haber en el cajón.
 */
import { apiRequest } from './apiClient'

export const NOTA_MAXIMA = 200
export const NOTA_MINIMA_EGRESO = 3

export const TIPOS_MOVIMIENTO = [
  { valor: 'egreso', etiqueta: 'Retiro o gasto (sale plata)' },
  { valor: 'ingreso', etiqueta: 'Ingreso (entra plata que no es una venta)' },
]

export const METODOS_MOVIMIENTO = [
  { valor: 'cash', etiqueta: 'Efectivo' },
  { valor: 'debit', etiqueta: 'Débito' },
  { valor: 'credit', etiqueta: 'Crédito' },
  { valor: 'transfer', etiqueta: 'Transferencia' },
]

/** Primer problema del formulario, o null. */
export function validarMovimientoCaja({ tipo, monto, note }) {
  if (tipo !== 'egreso' && tipo !== 'ingreso') return 'Elige si sale o entra plata.'
  if (!(Number(monto) > 0)) return 'Indica un monto mayor que 0.'
  const texto = String(note || '').trim()
  if (tipo === 'egreso' && texto.length < NOTA_MINIMA_EGRESO) return 'Un retiro o gasto necesita una nota que diga para qué salió la plata.'
  if (texto.length > NOTA_MAXIMA) return `La nota puede tener hasta ${NOTA_MAXIMA} caracteres.`
  return null
}

export async function registrarMovimientoCaja(cajaId, { tipo, monto, note, payment_method = 'cash' }) {
  const texto = String(note || '').trim()
  return apiRequest(`/cajas/${encodeURIComponent(String(cajaId))}/movimientos`, {
    method: 'POST',
    body: {
      tipo,
      monto: Number(monto).toFixed(2),
      ...(texto ? { note: texto } : {}),
      payment_method: payment_method || 'cash',
    },
  })
}

/** Mensaje del backend legible ("400: La caja ya está cerrada" → "La caja ya está cerrada"). */
export function mensajeMovimientoCaja(error) {
  const texto = String(error?.detail || error?.message || '').replace(/^\d{3}:\s*/, '')
  if (Number(error?.status) === 403) return 'Solo el administrador del local o el dueño registran movimientos de caja.'
  return texto || 'No se pudo registrar el movimiento.'
}
