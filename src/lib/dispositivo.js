/**
 * Identidad del dispositivo para las sesiones (T-50, B-16).
 *
 * El backend guarda una sesión por dispositivo y por persona: volver a iniciar
 * sesión con el mismo `device_id` cierra la sesión anterior de ese equipo en
 * vez de dejarla colgada. Por eso el id se crea una sola vez y se guarda en
 * localStorage. Si localStorage no se puede usar (modo privado estricto,
 * bloqueado), se genera uno en memoria para esta carga y el login no se rompe.
 */

const NAVEGADORES = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]
const SISTEMAS = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iOS/, 'iPhone o iPad'],
  [/Mac OS X|Macintosh/, 'Mac'],
  [/Linux/, 'Linux'],
]

/** "Chrome en Windows" a partir del user agent; si no se reconoce, el texto recortado. */
export function resumirUserAgent(userAgent) {
  const ua = String(userAgent || '')
  if (!ua) return 'Dispositivo desconocido'
  const navegador = NAVEGADORES.find(([re]) => re.test(ua))?.[1]
  const sistema = SISTEMAS.find(([re]) => re.test(ua))?.[1]
  if (navegador && sistema) return `${navegador} en ${sistema}`
  if (navegador || sistema) return navegador || sistema
  return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua
}

export const DEVICE_ID_KEY = 'gestflow-device-id'

let idEnMemoria = null

function nuevoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Navegadores sin randomUUID: 16 bytes aleatorios en formato UUID v4.
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** El id de este navegador: el guardado o uno nuevo (que se guarda). */
export function obtenerDeviceId() {
  try {
    const guardado = window.localStorage.getItem(DEVICE_ID_KEY)
    if (guardado) return guardado
    const id = idEnMemoria || nuevoId()
    window.localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    if (!idEnMemoria) idEnMemoria = nuevoId()
    return idEnMemoria
  }
}

/** Nombre legible del equipo, por ejemplo «Chrome en Windows» (hasta 100 caracteres). */
export function nombreDelEquipo() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return resumirUserAgent(ua).slice(0, 100)
}

/** Solo para tests: olvida el id en memoria. */
export function _reiniciarDispositivo() {
  idEnMemoria = null
}
