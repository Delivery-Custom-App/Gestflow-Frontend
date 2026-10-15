/**
 * Movimientos de stock con historial (T-58, B-22 sección 5f).
 *
 * `POST /inventory/{id}/movimientos` con `{ tipo, cantidad, motivo }` responde
 * 201 con el inventario ya actualizado; el cambio es atómico (dos ingresos a
 * la vez suman los dos). Tipos:
 * - `ingreso`: llegó mercadería, suma (motivo opcional).
 * - `merma`: se perdió o venció, resta (motivo obligatorio, 3 a 200).
 * - `ajuste`: el stock queda en el conteo real (motivo obligatorio, 3 a 200).
 * El stock nunca queda negativo: 409 y no se guarda nada.
 *
 * `GET /inventory/{id}/movimientos?limit=&offset=`: del más reciente al más
 * antiguo, total en `X-Total-Count`. Cada fila: tipo, cantidad, delta (con
 * signo), stock_anterior, stock_resultante, motivo, actor_email, created_at.
 */
import { apiRequest } from './apiClient'

export const MOTIVO_STOCK_MIN = 3
export const MOTIVO_STOCK_MAX = 200
export const MOVIMIENTOS_STOCK_POR_PAGINA = 20

export const ETIQUETA_MOVIMIENTO_STOCK = {
  ingreso: 'Ingreso',
  merma: 'Merma',
  ajuste: 'Ajuste de conteo',
  venta: 'Venta',
}

/** Primer problema del movimiento, o null. */
export function validarMovimientoStock({ tipo, cantidad, motivo }) {
  const n = Number(cantidad)
  if (tipo === 'ajuste') {
    if (cantidad === '' || cantidad == null || !Number.isFinite(n) || n < 0) return 'Indica cuántas unidades contaste.'
  } else if (!(n > 0)) {
    return tipo === 'merma' ? 'Indica cuántas unidades se perdieron.' : 'Indica cuántas unidades llegaron.'
  }
  const texto = String(motivo || '').trim()
  if ((tipo === 'merma' || tipo === 'ajuste') && texto.length < MOTIVO_STOCK_MIN) {
    return `Escribe el motivo (al menos ${MOTIVO_STOCK_MIN} caracteres).`
  }
  if (texto.length > MOTIVO_STOCK_MAX) return `El motivo puede tener hasta ${MOTIVO_STOCK_MAX} caracteres.`
  return null
}

export async function registrarMovimientoStock(inventoryId, { tipo, cantidad, motivo }) {
  const texto = String(motivo || '').trim()
  return apiRequest(`/inventory/${encodeURIComponent(String(inventoryId))}/movimientos`, {
    method: 'POST',
    body: { tipo, cantidad: String(cantidad), ...(texto ? { motivo: texto } : {}) },
  })
}

export async function listarMovimientosStock(inventoryId, { limit = MOVIMIENTOS_STOCK_POR_PAGINA, offset = 0 } = {}) {
  const { data, total } = await apiRequest(
    `/inventory/${encodeURIComponent(String(inventoryId))}/movimientos?limit=${limit}&offset=${offset}`,
    { withTotal: true },
  )
  const filas = Array.isArray(data) ? data : []
  return { movimientos: filas, total: total ?? filas.length }
}

/** Mensaje legible: el 409 de stock negativo y el resto sin el código. */
export function mensajeMovimientoStock(error) {
  const texto = String(error?.detail || error?.message || '').replace(/^\d{3}:\s*/, '')
  if (Number(error?.status) === 403) return 'No tienes permiso para mover el stock de este local.'
  return texto || 'No se pudo registrar el movimiento.'
}

/** «+5» o «-3» sin decimales de más. */
export function textoDelta(delta) {
  const n = Number(delta)
  if (!Number.isFinite(n)) return '—'
  const limpio = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)))
  return n > 0 ? `+${limpio}` : limpio
}
