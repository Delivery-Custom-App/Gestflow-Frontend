/**
 * Cierre de caja con conteo (T-55): lo que se muestra antes de confirmar y lo
 * que lleva el comprobante.
 *
 * - Una caja física se cierra contando billetes y monedas; una digital no
 *   tiene efectivo que contar y se cierra sin arqueo.
 * - El resumen mezcla lo que entrega `GET /cajas/{id}/resumen` (fondo, ingresos
 *   de caja, retiros, efectivo esperado) con las ventas por medio de pago, que
 *   salen de los movimientos: el resumen agrupa por método todos los ingresos,
 *   ventas y ingresos manuales juntos.
 * - Lo contado al cerrar es lo que queda en la caja: con eso se compara la
 *   apertura del día siguiente.
 */
import { diferenciaDe, monto } from './arqueo'

const EFECTIVO = new Set(['cash', 'efectivo'])
const TRANSFERENCIA = new Set(['transfer', 'transferencia'])
// Métodos que el backend guarda para lo que pasa por una máquina de tarjetas.
const TARJETA = new Set(['debit', 'credit', 'card', 'debito', 'credito', 'tarjeta'])
const TARJETA_DE_MAQUINA = /^(mercadopago_point|haulmer)/

/** Los tres medios del cierre; lo que no calza en ninguno va a `otros`. */
export function medioDePago(metodo) {
  const m = String(metodo ?? '').trim().toLowerCase()
  if (EFECTIVO.has(m)) return 'efectivo'
  if (TRANSFERENCIA.has(m)) return 'transferencia'
  if (TARJETA.has(m) || TARJETA_DE_MAQUINA.test(m)) return 'tarjeta'
  return 'otros'
}

/**
 * Ventas del turno por medio de pago. Una venta es un ingreso con orden: los
 * ingresos de caja (sin orden) y los retiros no cuentan.
 */
export function ventasPorMedio(movimientos) {
  const ventas = { efectivo: 0, tarjeta: 0, transferencia: 0, otros: 0 }
  for (const mov of Array.isArray(movimientos) ? movimientos : []) {
    if (mov.tipo === 'egreso' || !mov.order_id) continue
    ventas[medioDePago(mov.payment_method)] += Number(mov.monto) || 0
  }
  return ventas
}

/** ¿La caja física es digital? Se cierra sin contar efectivo. */
export function esCajaDigital(cajaFisica) {
  return String(cajaFisica?.tipo || '').toLowerCase() === 'digital'
}

/**
 * Lo que muestra el resumen del cierre. `resumen` es la respuesta de
 * `GET /cajas/{id}/resumen`; `movimientos`, los del turno (null si no se
 * pudieron leer: las ventas quedan en null y se muestran como «—»). `contado`
 * es null mientras no hay conteo, o siempre en una caja digital.
 */
export function armarResumenCierre({ resumen, movimientos = null, contado = null }) {
  const esperado = monto(resumen?.efectivo_esperado)
  return {
    fondo: monto(resumen?.monto_apertura),
    ventas: movimientos === null ? null : ventasPorMedio(movimientos),
    ingresosCaja: monto(resumen?.ingresos_manuales),
    retiros: monto(resumen?.total_egresos),
    esperado,
    contado,
    diferencia: diferenciaDe(contado, esperado),
  }
}

/**
 * Los turnos que siguen sin terminar en una caja física: quién sigue
 * trabajando. Cada uno se puede terminar a la fuerza (T-42) antes de cerrar.
 */
export function turnosSinTerminar(cajas, { cajaFisicaId, localId } = {}) {
  return (Array.isArray(cajas) ? cajas : [])
    .filter((c) => String(c.status) === 'open' && !c.turno_terminado_at
      && (!cajaFisicaId || String(c.caja_fisica_id) === String(cajaFisicaId))
      && (!localId || !c.local_id || String(c.local_id) === String(localId)))
    .sort((a, b) => String(a.opened_at || '').localeCompare(String(b.opened_at || '')))
}

/**
 * Lo que quedó en una caja física al cerrar su último turno, para compararlo al
 * abrir el siguiente. null si no hay turno cerrado o el último se cerró sin
 * contar el efectivo: un conteo más viejo ya no dice lo que hay en la caja.
 */
export function ultimoCierreDeCaja(cajas, cajaFisicaId) {
  const cerrados = (Array.isArray(cajas) ? cajas : [])
    .filter((c) => String(c.status) === 'closed' && String(c.caja_fisica_id) === String(cajaFisicaId))
    .sort((a, b) => String(b.closed_at || '').localeCompare(String(a.closed_at || '')))
  const ultimo = cerrados[0]
  const contado = monto(ultimo?.monto_cierre_declarado)
  return contado === null ? null : { contado, closedAt: ultimo.closed_at, businessDate: ultimo.business_date, closedBy: ultimo.closed_by_user_id || null }
}
