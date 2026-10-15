/**
 * Qué usuarios se muestran en /usuarios y /local/:localId/usuarios.
 *
 * El backend ya filtra por permisos en GET /users: al dueño le devuelve las
 * personas de su negocio y al encargado, solo las de su local. Aquí se acota
 * lo que se ve: dentro de una franquicia, las de ese local; en la vista de
 * todo el negocio, las del local elegido en el filtro (o todas).
 */

/** Valor del filtro para quienes no están asignados a ningún local (el dueño, por ejemplo). */
export const SIN_LOCAL = '__sin_local__'

function esDeLocal(user, localId) {
  if (localId === SIN_LOCAL) return !user.local_id
  return String(user.local_id || '') === String(localId)
}

export function usuariosVisibles(users, { localId, filtroLocal } = {}) {
  if (localId) return users.filter((u) => esDeLocal(u, localId))
  if (filtroLocal) return users.filter((u) => esDeLocal(u, filtroLocal))
  return users
}
