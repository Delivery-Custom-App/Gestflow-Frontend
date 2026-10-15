import { apiRequest } from './apiClient'
import { traducirErrorCobro } from './supervision'
import { isV2FeatureEnabled } from './v2Features'

/**
 * Cobro con tarjeta de una orden (T-76).
 *
 * Con la bandera `cobroTarjetaUnificado` encendida, la web cobra por el punto
 * único del backend (`/payments/card/orders/{id}/…`): el servidor decide, según
 * la máquina del turno, si el cobro sale por Mercado Pago o por Haulmer, y la
 * respuesta dice cuál (`provider`). Apagada (por defecto, mientras Haulmer
 * esté en pausa y el módulo `card_dispatcher` pueda estar apagado en
 * producción), sigue por Mercado Pago Point (`/payments/point/orders/{id}/…`).
 * Las respuestas de los dos caminos tienen la misma forma para Mercado Pago.
 *
 * Haulmer se cobra con un Intent de la app Android y su confirmación
 * (`POST /payments/haulmer/orders/{id}/confirm`) la manda la app: la web no
 * puede completarlo. Si el punto único responde que la máquina es Haulmer, se
 * cancela el cobro recién creado (para no dejar la terminal esperando) y se
 * avisa con un mensaje claro.
 */

/**
 * Errores del cobro con tarjeta en palabras de quien cobra (T-65). Marca
 * `reintentable` cuando la terminal está ocupada con otra venta.
 */
export function errorDeCobroTarjeta(err) {
  if (Number(err?.status) !== 409) return err
  const detalle = String(err?.detail || err?.message || '').replace(/^\d{3}:\s*/, '')
  if (/cobrando otra venta/i.test(detalle)) {
    const e = new Error('La máquina está cobrando otra venta: espera unos segundos y vuelve a intentar.')
    e.status = 409
    e.reintentable = true
    return e
  }
  const e = new Error(`${detalle || 'Hay un cobro anterior en la terminal'}. Cancélalo en el lector o espera a que venza y vuelve a intentar.`)
  e.status = 409
  return e
}

export const MENSAJE_HAULMER =
  'La máquina de tu turno cobra con Haulmer y la web todavía no puede cobrar con ella. Cobra desde la app o elige otra máquina.'

/** Ruta base del cobro con tarjeta según la bandera. */
export function rutaBaseCobroTarjeta() {
  return isV2FeatureEnabled('cobroTarjetaUnificado') ? '/payments/card' : '/payments/point'
}

const rutaOrden = (orderId) => `${rutaBaseCobroTarjeta()}/orders/${encodeURIComponent(String(orderId))}`

/**
 * Envía el cobro de una orden a la terminal (T-65).
 * - El monto lo decide el servidor (total del pedido más propina): `amount`
 *   ya no se manda aunque venga.
 * - Un doble toque devuelve el mismo cobro (mismo `charge_id`,
 *   `point_charge_active` y «El cobro ya está en la terminal»): la pantalla
 *   sigue el `charge_id` que recibe, no supone que es uno nuevo.
 * - 409: la máquina está cobrando otra venta (reintentar en unos segundos) o
 *   hay un cobro anterior vigente que no se pudo cancelar (cancelar en el
 *   lector o esperar).
 */
export async function createPointCharge(orderId, body = {}) {
  const { amount, ...resto } = body
  void amount
  // T-42: el 403 «Solo quien abrió la mesa puede cobrarla» con la sugerencia.
  const respuesta = await apiRequest(`${rutaOrden(orderId)}/charge`, { method: 'POST', body: resto })
    .catch((err) => { throw errorDeCobroTarjeta(traducirErrorCobro(err)) })
  if (String(respuesta?.provider || '').toLowerCase() === 'haulmer') {
    // La web no puede completar un cobro Haulmer: se suelta la terminal.
    await apiRequest(`${rutaOrden(orderId)}/charge`, { method: 'DELETE' }).catch(() => null)
    const error = new Error(MENSAJE_HAULMER)
    error.proveedor = 'haulmer'
    throw error
  }
  return respuesta
}

/**
 * Estado del cobro: consulta la base (actualizada por el aviso de Mercado
 * Pago). Devuelve { order_id, order_status, payment_status, payment_method, … }.
 */
export async function getPointOrderStatus(orderId) {
  return apiRequest(`${rutaOrden(orderId)}/status`)
}

/** Cancela el cobro pendiente en la terminal (libera la pantalla del dispositivo). */
export async function cancelPointCharge(orderId) {
  return apiRequest(`${rutaOrden(orderId)}/charge`, { method: 'DELETE' })
}
