/**
 * Gestión de usuarios (T-32): desactivar, reactivar, editar y restablecer la
 * clave. No hay borrado: se decidió solo desactivar (conserva el historial de
 * turnos y ventas; decisión 2 del documento de tareas).
 *
 * - `PATCH /users/{id}` con `is_active`, `first_name`, `last_name`, `role` y
 *   `local_id`. Un ADMIN o EMPLEADO siempre lleva local (400 sin él).
 * - `POST /users/{id}/regenerate-password` → `{ temporary_password, email_sent }`.
 */
import { apiRequest } from './apiClient'
import { isAdminNegocioRole, isSuperAdminRole, normalizeRoleKey } from '../auth/roleLabel'
import { rolConLocal } from './altaUsuario'

const ruta = (id) => `/users/${encodeURIComponent(String(id))}`

/** Pestañas de la lista: activos o inactivos (`is_active` false). */
export function separarPorEstado(users = []) {
  const activos = []
  const inactivos = []
  for (const u of users) (u.is_active === false ? inactivos : activos).push(u)
  return { activos, inactivos }
}

/**
 * ¿Quien mira puede gestionar a esta persona? Nunca a sí mismo ni a un
 * superadmin; el dueño gestiona a encargados y vendedores; el superadmin, a
 * todos menos otros superadmins.
 */
export function puedeGestionar(miRol, miId, usuario) {
  if (!usuario || String(miId || '') === String(usuario.id)) return false
  const mio = normalizeRoleKey(miRol)
  const suyo = normalizeRoleKey(usuario.role)
  if (suyo === 'SUPERADMIN') return false
  if (mio === 'SUPERADMIN') return true
  if (mio === 'ADMINNEGOCIO') return suyo === 'ADMIN' || suyo === 'EMPLEADO'
  return false
}

/** ¿Puede cambiar el rol y el local? (solo el dueño y el superadmin). */
export function puedeCambiarRolYLocal(miRol) {
  return isSuperAdminRole(miRol) || isAdminNegocioRole(miRol)
}

/** Formulario de edición desde un usuario de la lista. */
export function formularioDe(usuario) {
  return {
    nombre: usuario?.first_name || '',
    apellido: usuario?.last_name || '',
    role: String(usuario?.role || 'EMPLEADO').toUpperCase(),
    local_id: usuario?.local_id ? String(usuario.local_id) : '',
  }
}

/** Primer problema del formulario de edición, o null. */
export function validarEdicion(form) {
  if (!String(form.nombre || '').trim()) return 'Ingresa el nombre.'
  if (rolConLocal(form.role) && !form.local_id) return 'Selecciona el local: un encargado o un vendedor siempre tiene uno.'
  return null
}

/** Solo lo que cambió, con los nombres del backend. */
export function cambiosDeEdicion(usuario, form, { conRolYLocal = true } = {}) {
  const antes = formularioDe(usuario)
  const body = {}
  const nombre = String(form.nombre || '').trim()
  const apellido = String(form.apellido || '').trim()
  if (nombre !== antes.nombre) body.first_name = nombre
  if (apellido !== antes.apellido) body.last_name = apellido || null
  if (conRolYLocal) {
    if (form.role !== antes.role) body.role = form.role
    const local = rolConLocal(form.role) ? form.local_id || null : null
    if (String(local || '') !== antes.local_id || body.role) body.local_id = local
  }
  return body
}

export function actualizarUsuario(id, cambios) {
  return apiRequest(ruta(id), { method: 'PATCH', body: cambios })
}

export function cambiarEstadoUsuario(id, activo) {
  return apiRequest(ruta(id), { method: 'PATCH', body: { is_active: Boolean(activo) } })
}

/** Restablece la clave: `{ temporary_password, email_sent }` (se muestra una sola vez). */
export function restablecerClave(id) {
  return apiRequest(`${ruta(id)}/regenerate-password`, { method: 'POST' })
}

/** El texto del backend sin el código del frente ("400: …"). */
export function textoDeError(e, porDefecto = 'No se pudo completar la acción.') {
  return String(e?.detail || e?.message || porDefecto).replace(/^\d{3}:\s*/, '')
}
