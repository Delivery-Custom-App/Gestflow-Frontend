/**
 * Quién hace qué con la caja (A-03, backend B-05 y R7, sección 3.5):
 * - Cerrar o modificar un turno: solo el administrador del local y el dueño
 *   (y el superadmin). El vendedor recibe 403: termina su turno (T-41) y el
 *   administrador lo cuenta y lo cierra.
 * - En un local restaurante, el administrador no tiene caja propia: no abre
 *   turno ni abre o cobra pedidos (403). Sí cancela y traspasa mesas.
 * - El dueño mantiene todas las acciones.
 */
import { normalizeRoleKey } from '../auth/roleLabel'
import { SALES_MODEL, normalizeSalesModel } from './salesModel'

const CIERRAN = new Set(['ADMIN', 'ADMINNEGOCIO', 'SUPERADMIN'])

/** ¿Puede cerrar o modificar un turno de caja? */
export function puedeCerrarCaja(userRole) {
  return CIERRAN.has(normalizeRoleKey(userRole))
}

/** ¿Es el administrador de un local restaurante? (no vende) */
export function esAdminDeRestaurante(userRole, salesModel) {
  return normalizeRoleKey(userRole) === 'ADMIN' && normalizeSalesModel(salesModel) === SALES_MODEL.RESTAURANT
}

/** ¿Puede abrir su propio turno de caja y abrir o cobrar pedidos en este local? */
export function puedeVender(userRole, salesModel) {
  return !esAdminDeRestaurante(userRole, salesModel)
}

/** Texto para un 403 al cerrar la caja. */
export const MENSAJE_SOLO_ADMIN_CIERRA = 'Solo el administrador del local o el dueño cierran la caja. Termina tu turno y avísales.'
