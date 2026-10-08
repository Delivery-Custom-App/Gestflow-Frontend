/**
 * Registro de turnos por vendedor: "Mis turnos" del vendedor y la tabla de
 * turnos del encargado y del dueño (Caja y turnos).
 *
 * `GET /cajas?local_id=` no filtra por persona ni por fecha: el filtro se hace
 * aquí. Al vendedor el backend ya le entrega solo sus turnos (RLS); igual se
 * filtra por `cashier_user_id` para no depender de eso.
 *
 * La máquina usada en cada turno no se muestra: el turno no la guarda (B-03).
 */
import { useEffect, useState } from 'react'
import { getCajaResumen, getMovimientosCaja } from './salesApi'
import { nombreVisible } from './altaUsuario'

/** Turnos que se muestran por página: cada uno pide su total vendido al backend. */
export const TURNOS_POR_PAGINA = 20

/** Los turnos de una persona. */
export function turnosDe(turnos, userId) {
  if (!userId) return []
  return (Array.isArray(turnos) ? turnos : []).filter((t) => String(t.cashier_user_id) === String(userId))
}

/** Filtra por vendedor (id) y por fecha del turno (YYYY-MM-DD). Vacío = todos. */
export function filtrarTurnos(turnos, { vendedorId = '', fecha = '' } = {}) {
  return (Array.isArray(turnos) ? turnos : []).filter((t) =>
    (!vendedorId || String(t.cashier_user_id) === String(vendedorId))
    && (!fecha || t.business_date === fecha))
}

/** Nombre de quien abrió el turno; si no se conoce, uno corto que lo distingue. */
export function nombreDeVendedor(usuariosPorId, userId) {
  const usuario = usuariosPorId?.get(String(userId))
  return usuario ? nombreVisible(usuario) : `Usuario ${String(userId || '').slice(0, 8)}`
}

/** Las personas que tienen turnos en la lista, para el filtro "Vendedor", por nombre. */
export function opcionesDeVendedor(turnos, usuariosPorId) {
  const ids = [...new Set((Array.isArray(turnos) ? turnos : []).map((t) => String(t.cashier_user_id)))]
  return ids
    .map((id) => ({ id, nombre: nombreDeVendedor(usuariosPorId, id) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Hora (HH:MM) de un instante del backend; null si no hay. */
export function horaDe(fecha) {
  const d = fecha ? new Date(fecha) : null
  if (!d || Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Ventas, ingresos y egresos de un turno a partir de sus movimientos. El
 * resumen del backend no trae egresos ni cuántas ventas hubo. Una venta es una
 * orden cobrada: si se pagó en dos partes, cuenta una vez.
 */
export function totalesDelTurno(movimientos) {
  let ingresos = 0
  let egresos = 0
  const ordenes = new Set()
  let sinOrden = 0
  for (const mov of Array.isArray(movimientos) ? movimientos : []) {
    const monto = Number(mov.monto) || 0
    if (mov.tipo === 'egreso') { egresos += monto; continue }
    ingresos += monto
    if (mov.order_id) ordenes.add(String(mov.order_id))
    else sinOrden += 1
  }
  return { ventas: ordenes.size + sinOrden, ingresos, egresos }
}

const MOVIMIENTOS_POR_CONSULTA = 500
const MAX_CONSULTAS = 20

/** Todos los movimientos del turno (el backend entrega como máximo 500 por consulta). */
export async function movimientosDelTurno(cajaId) {
  const todos = []
  for (let pagina = 0; pagina < MAX_CONSULTAS; pagina += 1) {
    const filas = await getMovimientosCaja(cajaId, { limit: MOVIMIENTOS_POR_CONSULTA, offset: pagina * MOVIMIENTOS_POR_CONSULTA })
    todos.push(...filas)
    if (filas.length < MOVIMIENTOS_POR_CONSULTA) break
  }
  return todos
}

/**
 * Total vendido de cada turno de la lista (`total_ingresos` de su resumen).
 * Devuelve un Map id → número; `false` si no se pudo consultar, y sin entrada
 * mientras carga.
 */
export function useTotalesVendidos(turnos) {
  const [totales, setTotales] = useState(() => new Map())
  const clave = (Array.isArray(turnos) ? turnos : []).map((t) => t.id).join(',')

  useEffect(() => {
    let ignore = false
    const ids = clave ? clave.split(',') : []
    for (const id of ids) {
      getCajaResumen(id)
        .then((r) => { if (!ignore) setTotales((prev) => new Map(prev).set(id, Number(r?.total_ingresos) || 0)) })
        .catch(() => { if (!ignore) setTotales((prev) => new Map(prev).set(id, false)) })
    }
    return () => { ignore = true }
  }, [clave])

  return totales
}
