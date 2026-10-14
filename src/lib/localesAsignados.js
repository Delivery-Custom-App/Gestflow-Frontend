import { apiRequest } from './apiClient'

/**
 * Locales asignados a una persona (T-72 · backend #78).
 *
 * Un administrador de local o un empleado puede trabajar en más de un local
 * con la misma cuenta. El local con que entra es su `local_id` (el principal);
 * los demás son asignaciones (`user_locals`):
 *
 * - `GET    /users/{id}/locals` → `[{ id, user_id, local_id, is_primary, assigned_at }]`
 * - `POST   /users/{id}/locals` con `{ local_id, is_primary }` → 201 con la asignación.
 *   400 si el usuario no es ADMIN/EMPLEADO, si el local es de otro negocio o si
 *   ya está asignado; 404 si el local no existe; 403 si quien asigna no es el
 *   dueño ni el superadmin.
 * - `DELETE /users/{id}/locals/{assignment_id}` → 204 (404 si no existe).
 *
 * Para cambiar de local (`POST /auth/switch-local`, T-73) el backend exige una
 * asignación también para el local de destino; por eso, al agregar el primer
 * local extra, también se asigna el principal (marcado `is_primary`) para que
 * la persona pueda volver a él.
 */

const ruta = (userId) => `/users/${encodeURIComponent(String(userId))}/locals`

export async function listarLocalesAsignados(userId) {
  if (!userId) return []
  const filas = await apiRequest(ruta(userId))
  return Array.isArray(filas) ? filas : []
}

export async function asignarLocal(userId, localId, { principal = false } = {}) {
  if (!userId || !localId) throw new Error('Falta indicar a quién y qué local asignar')
  return apiRequest(ruta(userId), {
    method: 'POST',
    body: { local_id: String(localId), is_primary: Boolean(principal) },
  })
}

export async function quitarLocal(userId, assignmentId) {
  if (!userId || !assignmentId) throw new Error('Falta indicar qué asignación quitar')
  await apiRequest(`${ruta(userId)}/${encodeURIComponent(String(assignmentId))}`, { method: 'DELETE' })
}

/**
 * Agrega un local. Si la persona todavía no tiene asignado su local principal,
 * lo asigna primero (marcado como principal): sin eso no podría volver a él al
 * cambiar de local.
 */
export async function agregarLocal(userId, localId, { localPrincipalId, asignaciones = [] } = {}) {
  const tienePrincipal = asignaciones.some((a) => String(a.local_id) === String(localPrincipalId))
  if (localPrincipalId && !tienePrincipal && String(localPrincipalId) !== String(localId)) {
    await asignarLocal(userId, localPrincipalId, { principal: true })
  }
  return asignarLocal(userId, localId)
}

/**
 * Filas para mostrar: el principal primero (aunque no tenga asignación) y
 * después los demás por nombre. Cada fila: `{ localId, nombre, principal,
 * asignacionId }` (`asignacionId` null si el principal no está asignado).
 */
export function filasDeLocales(asignaciones, { localPrincipalId, nombreDe = (id) => String(id) } = {}) {
  const filas = []
  const principal = localPrincipalId ? String(localPrincipalId) : null
  if (principal) {
    const suya = (asignaciones || []).find((a) => String(a.local_id) === principal)
    filas.push({ localId: principal, nombre: nombreDe(principal), principal: true, asignacionId: suya?.id || null })
  }
  const otras = (asignaciones || [])
    .filter((a) => String(a.local_id) !== principal)
    .map((a) => ({ localId: String(a.local_id), nombre: nombreDe(a.local_id), principal: false, asignacionId: a.id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  return [...filas, ...otras]
}

/** Los locales del negocio que todavía no tiene (ni el principal ni los asignados). */
export function localesParaAgregar(locales, asignaciones, { localPrincipalId } = {}) {
  const tiene = new Set((asignaciones || []).map((a) => String(a.local_id)))
  if (localPrincipalId) tiene.add(String(localPrincipalId))
  return (locales || [])
    .filter((l) => !tiene.has(String(l.id)))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
}

/** Solo el administrador de local y el empleado pueden tener varios locales. */
export function puedeTenerVariosLocales(role) {
  const r = String(role || '').toUpperCase()
  return r === 'ADMIN' || r === 'EMPLEADO'
}
