/**
 * Alta de una franquicia con sus datos iniciales (#134): el superadmin crea el
 * negocio y, en el mismo paso, su primer local y la cuenta del dueño
 * (ADMIN_NEGOCIO), que entra directo con la clave que se le define aquí.
 *
 * Son tres llamadas sin transacción (POST /businesses, /locals y /users): si
 * una falla después de crear el negocio, el negocio queda creado y se informa
 * qué faltó para completarlo desde su detalle.
 */
import { createBusiness, createBusinessLocal } from './superAdminApi'
import { createUser } from './apiClient'
import { datosDeAlta, validarAlta } from './altaUsuario'
import { SALES_MODEL } from './salesModel'

export const FRANQUICIA_VACIA = {
  name: '',
  rut: '',
  plan: 'starter',
  conLocal: true,
  localName: '',
  salesModel: SALES_MODEL.RESTAURANT,
  conDueno: true,
  dueno: { nombre: '', apellido: '', rut: '', email: '', password: '' },
}

/** El dueño se valida como cualquier alta, con rol de dueño (sin local). */
function duenoComoAlta(dueno) {
  return { ...dueno, role: 'ADMIN_NEGOCIO', local_id: '' }
}

/** Primer problema del formulario, o null si se puede enviar. */
export function validarAltaFranquicia(form) {
  if (!String(form.name || '').trim()) return 'El nombre de la franquicia es obligatorio.'
  if (!String(form.rut || '').trim()) return 'El RUT es obligatorio.'
  if (form.conLocal && !String(form.localName || '').trim()) return 'Ingresa el nombre del primer local.'
  if (form.conDueno) {
    const problema = validarAlta(duenoComoAlta(form.dueno || {}))
    if (problema) return `Dueño: ${problema}`
  }
  return null
}

/** Clave inicial al azar (sin caracteres que se confunden al dictarla). */
export function generarClave(largo = 12) {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const valores = new Uint32Array(largo)
  crypto.getRandomValues(valores)
  return Array.from(valores, (v) => alfabeto[v % alfabeto.length]).join('')
}

function textoDe(e) {
  return String(e?.detail || e?.message || 'error desconocido').replace(/^\d{3}:\s*/, '')
}

/**
 * Crea el negocio y, si se pidieron, el primer local y el dueño. Si falla el
 * negocio lanza el error; si falla un paso posterior devuelve el negocio con
 * `pendientes`, la lista de lo que no se pudo crear.
 */
export async function crearFranquicia(form, token) {
  const business = await createBusiness(
    { name: form.name.trim(), rut: form.rut.trim(), plan: form.plan || 'starter' },
    token,
  )
  const pendientes = []

  if (form.conLocal) {
    try {
      await createBusinessLocal(business.id, { name: form.localName.trim(), salesModel: form.salesModel }, token)
    } catch (e) {
      pendientes.push(`el local (${textoDe(e)})`)
    }
  }

  if (form.conDueno) {
    try {
      await createUser(datosDeAlta(duenoComoAlta(form.dueno), null, business.id))
    } catch (e) {
      pendientes.push(`la cuenta del dueño (${textoDe(e)})`)
    }
  }

  return { business, pendientes }
}
