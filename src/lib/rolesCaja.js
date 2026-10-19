/**
 * Quién hace qué con la caja (A-03, backend B-05 y R7, sección 3.5):
 * - Cerrar o modificar un turno: solo el administrador del local y el dueño
 *   (y el superadmin). El vendedor recibe 403: termina su turno (T-41) y el
 *   administrador lo cuenta y lo cierra.
 * - Abrir la caja con el fondo: el encargado y el dueño, como parte de la
 *   rutina del día. El trabajador no abre caja: entra a su turno.
 * - En un restaurante el encargado no vende (R7) y el dueño solo ve métricas:
 *   ninguno de los dos abre ni cobra pedidos. Sí cancelan y traspasan mesas.
 *   En un local al paso los dos venden.
 * - El backend todavía rechaza (403) que el encargado de un restaurante abra
 *   una caja a su nombre: mientras no cambie, esa apertura va detrás de la
 *   bandera `aperturaCajaEncargadoRestaurante`.
 */
import { normalizeRoleKey } from '../auth/roleLabel'
import { SALES_MODEL, normalizeSalesModel } from './salesModel'
import { isV2FeatureEnabled } from './v2Features'

const CIERRAN = new Set(['ADMIN', 'ADMINNEGOCIO', 'SUPERADMIN'])

/** ¿Puede cerrar o modificar un turno de caja? */
export function puedeCerrarCaja(userRole) {
  return CIERRAN.has(normalizeRoleKey(userRole))
}

/** ¿Es el administrador de un local restaurante? (no vende) */
export function esAdminDeRestaurante(userRole, salesModel) {
  return normalizeRoleKey(userRole) === 'ADMIN' && normalizeSalesModel(salesModel) === SALES_MODEL.RESTAURANT
}

/** ¿Es el dueño en un local restaurante? (solo ve métricas, no vende) */
export function esDuenoDeRestaurante(userRole, salesModel) {
  return normalizeRoleKey(userRole) === 'ADMINNEGOCIO' && normalizeSalesModel(salesModel) === SALES_MODEL.RESTAURANT
}

/** ¿Puede abrir o cobrar pedidos en este local? */
export function puedeVender(userRole, salesModel) {
  return !esAdminDeRestaurante(userRole, salesModel) && !esDuenoDeRestaurante(userRole, salesModel)
}

/** ¿Puede abrir la caja con el fondo del día en este local? (encargado y dueño) */
export function puedeAbrirCaja(userRole, salesModel) {
  if (!CIERRAN.has(normalizeRoleKey(userRole))) return false
  if (esAdminDeRestaurante(userRole, salesModel)) return isV2FeatureEnabled('aperturaCajaEncargadoRestaurante')
  return true
}

/** Texto para un 403 al cerrar la caja. */
export const MENSAJE_SOLO_ADMIN_CIERRA = 'Solo el administrador del local o el dueño cierran la caja. Termina tu turno y avísales.'
