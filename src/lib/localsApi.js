import { apiRequest } from './apiClient'

/**
 * Borrado de un local en Backend V2.
 *
 * No existe `/locals/{id}/deletion-summary` ni `/locals/{id}/cascade`: el
 * borrado en cascada ES el `DELETE /locals/{id}`, y el backend exige dos pasos
 * porque es permanente — primero desactivar el local, después eliminarlo.
 * Además rechaza el borrado si quedan turnos de caja abiertos hoy.
 */

/** Lo que el backend se lleva al borrar, según su propia documentación. */
export const SE_ELIMINA = [
  'El inventario y el stock del local',
  'Las cajas físicas y sus turnos, con sus movimientos',
  'Las mesas',
  'El historial de pedidos y sus ítems',
]

/** Lo que sobrevive al borrado. */
export const SE_CONSERVA = [
  'Los usuarios asignados al local: no se borran, solo pierden la asignación',
]

const contar = (v) => (Array.isArray(v) ? v.length : 0)

/**
 * Resumen previo al borrado, armado con lo que el backend sí expone.
 *
 * Mesas y cajas físicas se cuentan de verdad porque sus listados filtran por
 * local. El resto se describe sin número: `/inventory` y `/local-products`
 * ignoran el filtro de local, así que cualquier conteo sería falso.
 */
export async function getResumenBorradoLocal(localId) {
  const id = encodeURIComponent(String(localId))
  const [mesas, cajasFisicas, cajas] = await Promise.all([
    apiRequest(`/mesas?local_id=${id}`).catch(() => null),
    apiRequest(`/cajas-fisicas?local_id=${id}`).catch(() => null),
    apiRequest(`/cajas?local_id=${id}`).catch(() => null),
  ])

  return {
    conteos: {
      mesas: mesas === null ? null : contar(mesas),
      cajas_fisicas: cajasFisicas === null ? null : contar(cajasFisicas),
    },
    // El backend rechaza el borrado si hay turnos abiertos: mejor avisarlo antes.
    turnosAbiertos: Array.isArray(cajas)
      ? cajas.filter((c) => String(c.status) === 'open').length
      : 0,
    se_elimina: SE_ELIMINA,
    se_conserva: SE_CONSERVA,
  }
}

/**
 * Elimina el local. Desactiva primero porque el backend lo exige, y solo
 * cuando ya se comprobó que no quedan turnos abiertos: así un rechazo no deja
 * el local desactivado a medio camino.
 */
export async function eliminarLocal(localId) {
  const id = encodeURIComponent(String(localId))
  await apiRequest(`/locals/${id}`, { method: 'PATCH', body: { is_active: false } })
  await apiRequest(`/locals/${id}`, { method: 'DELETE' })
}

/**
 * El backend guarda la ubicación en campos separados (`street_name`,
 * `city_name`, `state_name`, `latitude`, `longitude`), mientras que la
 * interfaz muestra una dirección y un punto en el mapa. Sin esta traducción,
 * un local con dirección guardada se seguiría viendo "sin dirección" y no
 * aparecería en el mapa de franquicias.
 */
export function mapLocalOut(local) {
  if (!local || typeof local !== 'object') return local
  const direccion = [local.street_name, local.city_name].filter(Boolean).join(', ')
  return {
    ...local,
    address: local.address ?? (direccion || null),
    lat: local.latitude ?? null,
    lng: local.longitude ?? null,
  }
}
