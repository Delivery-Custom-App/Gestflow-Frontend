/**
 * Perfil propio (Configuración): nombre y apellido reales, editables con
 * `PATCH /auth/me`, e iniciales en lugar de foto.
 */
import { apiRequest } from './apiClient'

const limpio = (v) => String(v || '').trim()

/** Si la persona ya cargó su nombre (los usuarios creados antes de T-06 no lo tienen). */
export function tieneNombre(user) {
  return Boolean(limpio(user?.first_name))
}

/**
 * Iniciales para el círculo del perfil: nombre y apellido; con solo el
 * nombre, su primera letra; sin nombre, la primera letra del correo.
 */
export function iniciales(user) {
  const nombre = limpio(user?.first_name)
  const apellido = limpio(user?.last_name)
  if (nombre) return (nombre[0] + (apellido[0] || '')).toUpperCase()
  const correo = limpio(user?.email)
  return correo ? correo[0].toUpperCase() : '?'
}

/** Misma regla que el alta de usuarios: el nombre es obligatorio, el apellido no. */
export function validarNombre({ nombre, apellido }) {
  if (!limpio(nombre)) return 'Ingresa tu nombre.'
  if (limpio(nombre).length > 100) return 'El nombre puede tener hasta 100 caracteres.'
  if (limpio(apellido).length > 100) return 'El apellido puede tener hasta 100 caracteres.'
  return null
}

/** Guarda el nombre y el apellido propios. */
export function guardarMiNombre({ nombre, apellido }) {
  return apiRequest('/auth/me', {
    method: 'PATCH',
    body: { first_name: limpio(nombre), last_name: limpio(apellido) || null },
  })
}
