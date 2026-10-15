/**
 * Mesas no cobradas y pedidos vencidos (T-45 y T-46, backend 5c).
 *
 * Al cerrar la caja, una mesa abierta queda cancelada sin cobrar («mesa no
 * cobrada») y un pedido de mostrador sin cambios por más de 15 minutos vence
 * («orden vencida»). El administrador también puede liberar una mesa (T-49).
 *
 * `GET /cajas/no-cobradas?local_id=&desde=&hasta=&limit=&offset=`: `desde` y
 * `hasta` son días contables (YYYY-MM-DD, por defecto hoy); `limit` hasta 500;
 * el total viene en `X-Total-Count`. Cada fila trae `tipo`, `mesa`, `hora`,
 * `mesero_id`, `total`, `consumo` [{producto, cantidad, precio, subtotal}],
 * `registrado_por_email` (quien cerró la caja) y `motivo`.
 */
import { apiRequest } from './apiClient'

export const NO_COBRADAS_POR_PAGINA = 20
const POR_CONSULTA = 500
const MAX_CONSULTAS = 10

export const TIPO_NO_COBRADA = {
  mesa_no_cobrada: 'Mesa no cobrada',
  orden_vencida: 'Pedido vencido',
}

/**
 * Textos de la pantalla según el tipo de local. Un local al paso no tiene
 * mesas: solo le quedan los pedidos de mostrador vencidos.
 */
export function textosNoCobradas(alPaso) {
  return alPaso
    ? { titulo: 'Pedidos no cobrados', subtitulo: 'Pedidos de mostrador que vencieron sin cobrar al cerrar la caja' }
    : { titulo: 'Mesas no cobradas', subtitulo: 'Mesas que quedaron sin cobrar al cerrar la caja y pedidos de mostrador vencidos' }
}

/** Todas las filas del rango (pide de a 500 hasta completar X-Total-Count). */
export async function listarNoCobradas(localId, { desde, hasta } = {}) {
  const filas = []
  for (let pagina = 0; pagina < MAX_CONSULTAS; pagina += 1) {
    const qs = new URLSearchParams({ local_id: String(localId), limit: String(POR_CONSULTA), offset: String(pagina * POR_CONSULTA) })
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    // Secuencial: cada página depende de cuántas trajo la anterior.
    // oxlint-disable-next-line react-doctor/async-await-in-loop
    const { data, total } = await apiRequest(`/cajas/no-cobradas?${qs.toString()}`, { withTotal: true })
    const lote = Array.isArray(data) ? data : []
    filas.push(...lote)
    if (lote.length < POR_CONSULTA || (total !== null && filas.length >= total)) break
  }
  return filas
}

/** Suma de lo no cobrado en las filas. */
export function totalNoCobrado(filas = []) {
  return filas.reduce((s, f) => s + (Number(f.total) || 0), 0)
}

/** Primer problema del rango de fechas, o null. */
export function validarRango({ desde, hasta }) {
  if (desde && hasta && desde > hasta) return '«Desde» no puede ser posterior a «Hasta».'
  return null
}
