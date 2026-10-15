/**
 * Historial del turno (T-43, sección 5b): todo lo que pasó en un turno, en
 * orden y solo agregado. `GET /cajas/{id}/historial?limit=&offset=`, con el
 * total en `X-Total-Count`. Cada evento trae `tipo`, `created_at`,
 * `actor_email`, `order_id`, `mesa_id`, `monto`, `metodo`, `motivo` y `detalle`.
 */
import { apiRequest } from './apiClient'
import { monto as aMonto, textoDiferencia } from './arqueo'
import { formatCLPCurrency as formatMoney } from './formatCLP'

export const EVENTOS_POR_PAGINA = 20

export const ETIQUETA_EVENTO = {
  turno_abierto: 'Turno abierto',
  maquina_elegida: 'Máquina elegida',
  maquina_liberada: 'Máquina liberada',
  mesa_tomada: 'Mesa tomada',
  cobro: 'Cobro',
  mesa_reasignada: 'Mesa reasignada',
  turno_terminado: 'Turno terminado',
  turno_cerrado: 'Turno cerrado',
  mesa_no_cobrada: 'Mesa no cobrada',
  orden_vencida: 'Pedido vencido',
  movimiento_caja: 'Movimiento de caja',
}

const METODO = { cash: 'efectivo', debit: 'débito', credit: 'crédito', transfer: 'transferencia' }

/** Etiqueta en español; un tipo desconocido se muestra con su nombre crudo. */
export function etiquetaEvento(tipo) {
  return ETIQUETA_EVENTO[tipo] || String(tipo || 'evento')
}

/** Detalles legibles de un evento (lo que conviene mostrar además de la etiqueta). */
export function detallesEvento(evento) {
  const d = evento?.detalle && typeof evento.detalle === 'object' ? evento.detalle : {}
  const partes = []
  if (evento?.tipo === 'turno_cerrado') {
    if (d.efectivo_esperado != null) partes.push(`Esperado ${formatMoney(aMonto(d.efectivo_esperado))}`)
    if (d.efectivo_contado != null) partes.push(`Contado ${formatMoney(aMonto(d.efectivo_contado))}`)
    if (d.diferencia != null) partes.push(textoDiferencia(d.diferencia))
    if (!partes.length) partes.push('Sin arqueo')
  }
  if (evento?.tipo === 'maquina_elegida' || evento?.tipo === 'maquina_liberada') {
    if (d.maquina) partes.push(d.maquina + (d.compartida ? ' (compartida)' : ''))
  }
  if (evento?.tipo === 'mesa_tomada' && d.mesa) partes.push(d.mesa)
  if (evento?.tipo === 'movimiento_caja' && d.tipo) partes.push(d.tipo === 'egreso' ? 'Retiro o gasto' : 'Ingreso')
  if (evento?.tipo === 'turno_terminado' && d.forzado) partes.push('Lo terminó el administrador')
  return partes
}

/** Monto y método en palabras («$4.400 · efectivo»), o null. */
export function montoEvento(evento) {
  const m = aMonto(evento?.monto)
  if (m === null) return null
  const metodo = evento?.metodo ? METODO[evento.metodo] || evento.metodo : null
  return metodo ? `${formatMoney(m)} · ${metodo}` : formatMoney(m)
}

export async function listarHistorialTurno(cajaId, { limit = EVENTOS_POR_PAGINA, offset = 0 } = {}) {
  const { data, total } = await apiRequest(
    `/cajas/${encodeURIComponent(String(cajaId))}/historial?limit=${limit}&offset=${offset}`,
    { withTotal: true },
  )
  const eventos = Array.isArray(data) ? data : []
  return { eventos, total: total ?? eventos.length }
}
