/**
 * Alta de usuarios: lo que comparten el cajón de /usuarios y la pantalla
 * /usuarios/crear — qué roles puede asignar cada quien, cómo se valida el
 * formulario y qué se le envía al backend.
 */
import { isSuperAdminRole, isAdminNegocioRole } from '../auth/roleLabel'
import { isV2FeatureEnabled } from './v2Features'
import { validateChileRutMessage, normalizeRutInput, formatRutForDisplay } from '../utils/chileRut'

/** Mínimo que exige el backend (`UserCreate.password`, min_length=8). */
export const LARGO_MINIMO_CONTRASENA = 8

/** Roles que Backend V2 guarda. "Cajero" no existe: se guardaba como vendedor. */
export const ROL_LABEL = {
  SUPERADMIN: 'Super Administrador',
  ADMIN_NEGOCIO: 'Dueño de negocio',
  ADMIN: 'Encargado de local',
  EMPLEADO: 'Vendedor',
}

/**
 * En el backend solo el superadmin y el dueño crean usuarios: al encargado
 * `POST /users` le responde 403, así que no se le ofrece el alta.
 */
export function puedeCrearUsuarios(userRole) {
  return isSuperAdminRole(userRole) || isAdminNegocioRole(userRole)
}

/** Roles que puede asignar quien crea, del más alto al más bajo. */
export function rolesAsignables(userRole) {
  if (isSuperAdminRole(userRole)) return ['SUPERADMIN', 'ADMIN_NEGOCIO', 'ADMIN', 'EMPLEADO']
  if (isAdminNegocioRole(userRole)) return ['ADMIN', 'EMPLEADO']
  return []
}

/** ¿Este rol trabaja en un local? (el dueño y el superadmin no se atan a uno). */
export function rolConLocal(role) {
  return role !== 'SUPERADMIN' && role !== 'ADMIN_NEGOCIO'
}

export function pideRut() {
  return isV2FeatureEnabled('userRut')
}

/** Lo que se escribe en el campo RUT, normalizado y con puntos y guion. */
export function formatearRut(valor) {
  return formatRutForDisplay(normalizeRutInput(valor))
}

/**
 * Devuelve el primer problema del formulario, o null si se puede enviar.
 * @param {{ nombre, apellido, rut, email, password, role, local_id }} form
 */
export function validarAlta(form) {
  if (!String(form.nombre || '').trim()) return 'Ingresa el nombre.'
  if (pideRut()) {
    if (!String(form.rut || '').trim()) return 'Ingresa el RUT.'
    const errorRut = validateChileRutMessage(form.rut)
    if (errorRut) return errorRut
  }
  if (!String(form.email || '').trim()) return 'Ingresa el correo.'
  if (String(form.password || '').length < LARGO_MINIMO_CONTRASENA) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`
  }
  if (rolConLocal(form.role) && !form.local_id) return 'Selecciona el local al que pertenece este usuario.'
  return null
}

/** Cuerpo para `createUser`: el nombre viaja como first_name/last_name; el RUT, solo si el backend lo guarda. */
export function datosDeAlta(form, local) {
  const apellido = String(form.apellido || '').trim()
  return {
    first_name: String(form.nombre).trim(),
    last_name: apellido || null,
    ...(pideRut() ? { rut: normalizeRutInput(form.rut) } : {}),
    email: String(form.email).trim(),
    password: form.password,
    role: form.role,
    local_id: rolConLocal(form.role) ? form.local_id || null : null,
    business_id: local?.business_id || null,
  }
}

/** Aviso para quien crea un vendedor: así lo hace el backend al crearlo. */
export const AVISO_VENDEDOR =
  'En su primer ingreso deberá cambiar la contraseña, y le llegará un correo con sus datos de acceso.'

/**
 * Nombre de una persona para mostrar: nombre y apellido; si no los tiene
 * (usuarios creados antes de que el alta los guardara), el mismo nombre que
 * `displayNameFromEmail` arma con el correo.
 */
export function nombreVisible(user) {
  const completo = [user?.first_name, user?.last_name].map((s) => String(s || '').trim()).filter(Boolean).join(' ')
  if (completo) return completo
  const email = String(user?.email || '')
  if (!email) return '—'
  const local = email.split('@')[0] || ''
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim() || email
}
