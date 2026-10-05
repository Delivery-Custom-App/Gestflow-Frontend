/**
 * Fondo de emergencia del local (T-26): plata apartada con saldo, a la que se
 * le aporta dinero y de la que se registran usos con su motivo. Uno por local.
 * Lo crean y lo usan el dueño (sus locales) y el encargado (el suyo); el
 * vendedor no lo ve. No es parte del arqueo de los turnos de caja.
 *
 * Los endpoints son los propuestos en el ticket de backend B-09; todo esto
 * queda detrás de la bandera `fondoEmergencia` hasta que existan. Si el
 * backend los nombra distinto, se ajustan aquí.
 */
import { apiRequest } from './apiClient'
import { normalizeRoleKey } from '../auth/roleLabel'

const ROLES_DEL_FONDO = new Set(['ADMINNEGOCIO', 'ADMIN', 'SUPERADMIN'])

/** El dueño, el encargado (y el superadmin) manejan el fondo; el vendedor no. */
export function puedeManejarFondo(userRole) {
  return ROLES_DEL_FONDO.has(normalizeRoleKey(userRole))
}

/** "50.000" o "50000" → 50000; lo que no sea dígito se descarta. */
export function montoDesdeTexto(texto) {
  const limpio = String(texto ?? '').replace(/[^\d]/g, '')
  return limpio === '' ? null : Number(limpio)
}

export const MOTIVO_MAXIMO = 200

/** Crear: el monto inicial puede ser 0. */
export function validarCreacion({ montoInicial }) {
  if (montoInicial == null || montoInicial < 0) return 'Indica el monto inicial (puede ser 0).'
  return null
}

/**
 * Aporte o uso. El uso exige motivo y no puede dejar el saldo negativo.
 * @param {{ tipo: 'aporte'|'uso', monto: number|null, motivo: string, saldo: number }} mov
 */
export function validarMovimiento({ tipo, monto, motivo, saldo }) {
  if (!(monto > 0)) return 'Indica un monto mayor que 0.'
  const texto = String(motivo || '').trim()
  if (tipo === 'uso' && !texto) return 'Indica el motivo del uso.'
  if (texto.length > MOTIVO_MAXIMO) return `El motivo puede tener hasta ${MOTIVO_MAXIMO} caracteres.`
  if (tipo === 'uso' && monto > saldo) return 'No alcanza: el fondo no puede quedar en negativo.'
  return null
}

/** Mensaje para la persona a partir del error del backend. */
export function mensajeDeErrorDelFondo(error) {
  const texto = String(error?.message || '')
  if (/^404\b|not found/i.test(texto)) return 'El fondo de emergencia todavía no está disponible en el servidor.'
  if (/^409\b|saldo|insuficiente|negativ/i.test(texto)) return 'No alcanza: el fondo no puede quedar en negativo.'
  if (/^403\b|no autorizado/i.test(texto)) return 'No tienes permiso para manejar el fondo de este local.'
  return texto || 'No se pudo completar la operación.'
}

const enc = (v) => encodeURIComponent(String(v))

/** El fondo del local, o null si todavía no tiene. */
export async function getFondoDelLocal(localId) {
  const filas = await apiRequest(`/emergency-funds?local_id=${enc(localId)}`)
  const lista = Array.isArray(filas) ? filas : filas ? [filas] : []
  return lista.find((f) => String(f.local_id) === String(localId)) || null
}

export function crearFondo(localId, montoInicial) {
  return apiRequest('/emergency-funds', { method: 'POST', body: { local_id: localId, monto_inicial: montoInicial } })
}

export function registrarMovimiento(fondoId, { tipo, monto, motivo }) {
  const texto = String(motivo || '').trim()
  return apiRequest(`/emergency-funds/${enc(fondoId)}/movements`, {
    method: 'POST',
    body: { tipo, monto, motivo: texto || null },
  })
}

/** Historial, del más reciente al más antiguo. */
export async function listarMovimientos(fondoId, { limit = 100, offset = 0 } = {}) {
  const filas = await apiRequest(`/emergency-funds/${enc(fondoId)}/movements?limit=${limit}&offset=${offset}`)
  return Array.isArray(filas) ? filas : []
}
