/**
 * Lo que responde el backend al cerrar un turno, en palabras de quien lo
 * cierra. Desde la sección 5c las mesas abiertas ya no bloquean el cierre
 * (quedan «no cobradas»): `PATCH /cajas/{id}` responde 409 solo si queda un
 * pedido de mostrador reciente (menos de 15 minutos) o un cobro con tarjeta en
 * curso, y 400 si el turno ya estaba cerrado.
 */
export function mensajeCierreTurno(err) {
  const texto = String(err?.detail || err?.message || '')
  // A-03: el vendedor no cierra la caja (B-05).
  if (Number(err?.status) === 403) return 'Solo el administrador del local o el dueño cierran la caja.'
  if (/órdenes en curso|ordenes en curso/i.test(texto) || Number(err?.status) === 409) {
    return 'No se puede cerrar el turno todavía: queda un pedido de mostrador reciente o un cobro con tarjeta en curso. '
      + 'Cóbralo o espera a que termine el cobro, y vuelve a intentar en unos minutos.'
  }
  if (/ya está cerrada/i.test(texto)) return 'Este turno ya estaba cerrado.'
  return texto.replace(/^\d{3}:\s*/, '') || 'No se pudo cerrar el turno'
}

/**
 * El turno ya terminó (T-41): lo terminó el vendedor o el administrador
 * (`turno_terminado_at`). La caja sigue abierta hasta que el administrador la
 * cuenta y la cierra, pero ya no se vende en ese turno.
 */
export function turnoTerminado(turno) {
  return Boolean(turno?.turno_terminado_at)
}

/** Qué decirle al vendedor cuando su turno terminó. */
export function mensajeTurnoTerminado(turno) {
  if (turno?.turno_terminado_forzado) {
    return `El administrador terminó tu turno. Motivo: ${turno.turno_terminado_motivo || 'sin motivo'}`
  }
  return 'Terminaste tu turno. La caja la cuenta y la cierra el administrador.'
}

/** Mensaje del 409 o 403 al terminar el turno, sin el código. */
export function mensajeTerminarTurno(err) {
  const texto = String(err?.detail || err?.message || '').replace(/^\d{3}:\s*/, '')
  if (Number(err?.status) === 403) return 'Solo puedes terminar tu propio turno.'
  return texto || 'No se pudo terminar el turno'
}

const ACTIVAS = new Set(['PENDING', 'PREPARING', 'READY', 'open', 'preparing', 'ready'])

/**
 * Qué va a pasar con lo que sigue abierto al cerrar (T-45): las mesas quedan
 * como «no cobradas» (sin ingreso) y los pedidos de mostrador vencen si llevan
 * más de 15 minutos sin cambios; los recientes impiden cerrar (409).
 * `nombreMesa(id)` da el nombre de cada mesa.
 */
export function pendientesAlCerrar(ordenes = [], nombreMesa = () => null) {
  const abiertas = (Array.isArray(ordenes) ? ordenes : []).filter((o) => ACTIVAS.has(String(o.status)))
  const mesas = abiertas.filter((o) => o.mesa_id).map((o) => ({
    id: o.id, mesa: nombreMesa(o.mesa_id) || 'Mesa', total: Number(o.total) || 0,
  }))
  const mostrador = abiertas.filter((o) => !o.mesa_id).map((o) => ({ id: o.id, total: Number(o.total) || 0 }))
  return { mesas, mostrador, totalMesas: mesas.reduce((s, m) => s + m.total, 0) }
}
