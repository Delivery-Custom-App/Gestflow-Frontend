/**
 * Supervisión del administrador sobre los turnos (T-42, sección 5b):
 * - Liberar una máquina: `POST /pos-machines/{id}/liberar` con `motivo` →
 *   `{ pos_machine_id, turnos_liberados }`. Cada empleado afectado recibe un
 *   aviso; su turno sigue abierto y debe elegir otra máquina para cobrar con
 *   tarjeta.
 * - Forzar el término de un turno: `POST /cajas/{id}/forzar-termino` con
 *   `motivo` y, si el turno tiene mesas abiertas, `reasignar_a_user_id`
 *   (409 sin destino). Acepta `cerrar_sesion` (T-54).
 * - Reasignar una mesa: `POST /orders/{id}/reasignar?created_at=` con
 *   `to_user_id` y `motivo`: la orden pasa al turno del nuevo empleado (y su
 *   dinero también). 409 si ya está cobrada o el destino no tiene turno hoy.
 * El motivo es siempre obligatorio (3 a 300 caracteres).
 */
import { apiRequest } from './apiClient'
import { nombreVisible } from './altaUsuario'

export const MOTIVO_MIN = 3
export const MOTIVO_MAX = 300

/** Motivo obligatorio de 3 a 300 caracteres; null si está bien. */
export function validarMotivo(motivo) {
  const texto = String(motivo || '').trim()
  if (texto.length < MOTIVO_MIN) return `Escribe el motivo (al menos ${MOTIVO_MIN} caracteres).`
  if (texto.length > MOTIVO_MAX) return `El motivo puede tener hasta ${MOTIVO_MAX} caracteres.`
  return null
}

export async function liberarMaquina(machineId, motivo) {
  return apiRequest(`/pos-machines/${encodeURIComponent(String(machineId))}/liberar`, {
    method: 'POST',
    body: { motivo: String(motivo || '').trim() },
  })
}

/**
 * Termina a la fuerza el turno de un empleado. `paraCerrarLaCaja` (#140) solo
 * se manda desde el cierre de la caja física: el turno termina aunque tenga
 * pedidos abiertos, sin reasignarlos (quedan «no cobrados» al cerrar la caja).
 * Durante el día no se usa: hay que reasignar.
 */
export async function forzarTermino(cajaId, { motivo, reasignarAUserId = null, cerrarSesion = false, paraCerrarLaCaja = false } = {}) {
  return apiRequest(`/cajas/${encodeURIComponent(String(cajaId))}/forzar-termino`, {
    method: 'POST',
    body: {
      motivo: String(motivo || '').trim(),
      ...(reasignarAUserId ? { reasignar_a_user_id: String(reasignarAUserId) } : {}),
      ...(cerrarSesion ? { cerrar_sesion: true } : {}),
      ...(paraCerrarLaCaja ? { para_cerrar_la_caja: true } : {}),
    },
  })
}

export async function reasignarOrden(orderId, createdAt, { toUserId, motivo }) {
  const qs = createdAt ? `?created_at=${encodeURIComponent(String(createdAt))}` : ''
  return apiRequest(`/orders/${encodeURIComponent(String(orderId))}/reasignar${qs}`, {
    method: 'POST',
    body: { to_user_id: String(toUserId), motivo: String(motivo || '').trim() },
  })
}

/**
 * Empleados que pueden recibir mesas: los vendedores del local con un turno
 * abierto hoy que no haya terminado (el backend responde 409 si el destino no
 * tiene turno). `excepto`: id a dejar fuera (quien entrega las mesas).
 */
export function empleadosConTurnoHoy(usuarios, cajas, { localId, hoy, excepto = null } = {}) {
  const conTurno = new Set(
    (Array.isArray(cajas) ? cajas : [])
      .filter((c) => String(c.status) === 'open' && (!hoy || c.business_date === hoy) && !c.turno_terminado_at
        && (!localId || String(c.local_id || localId) === String(localId)))
      .map((c) => String(c.cashier_user_id)),
  )
  return (Array.isArray(usuarios) ? usuarios : [])
    .filter((u) => String(u.role || '').toUpperCase() === 'EMPLEADO' && u.is_active !== false
      && conTurno.has(String(u.id)) && String(u.id) !== String(excepto || ''))
    .map((u) => ({ id: String(u.id), nombre: nombreVisible(u) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Texto del backend sin el código ("409: …"). */
export function mensajeSupervision(err, porDefecto = 'No se pudo completar la acción.') {
  return String(err?.detail || err?.message || porDefecto).replace(/^\d{3}:\s*/, '')
}

/** ¿El 409 de forzar término pide a quién reasignar las mesas? */
export function pideReasignar(err) {
  return Number(err?.status) === 409 && /reasignar_a_user_id|a qué empleado se reasignan/i.test(String(err?.detail || err?.message || ''))
}

export const MENSAJE_SOLO_QUIEN_ABRIO =
  'Esta mesa la abrió otra persona y solo ella puede cobrarla. Si no está, pide al administrador que te la reasigne.'

/** Al cobrar: el 403 «Solo quien abrió la mesa puede cobrarla» con la sugerencia. */
export function traducirErrorCobro(err) {
  if (Number(err?.status) === 403 && /Solo quien abrió la mesa/i.test(String(err?.detail || err?.message || ''))) {
    const e = new Error(MENSAJE_SOLO_QUIEN_ABRIO)
    e.status = 403
    e.detail = err.detail
    return e
  }
  return err
}
