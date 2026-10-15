/**
 * Locales y negocios guardados en memoria (T-35): la app los pedía en cada
 * pantalla. Se piden una vez y se reusan durante 5 minutos (y las pedidas a
 * la vez comparten la misma petición). Crear, editar o eliminar un local o un
 * negocio invalida el caché, y cerrar sesión lo limpia (ver authClient).
 */
import { cachedRequest, invalidatePrefix } from './apiCache'
import { apiRequest } from './apiClient'

export const TTL_LOCALES_MS = 5 * 60 * 1000

/** Lista de locales (`/locals` o `/locals?business_id=`). */
export function obtenerLocales(ruta = '/locals') {
  return cachedRequest(`locals:${ruta}`, () => apiRequest(ruta), TTL_LOCALES_MS)
}

/** Un local por id. */
export function obtenerLocal(localId) {
  return cachedRequest(`local:${localId}`, () => apiRequest(`/locals/${localId}`), TTL_LOCALES_MS)
}

/** Un negocio por id. */
export function obtenerNegocio(businessId) {
  return cachedRequest(`business:${businessId}`, () => apiRequest(`/businesses/${businessId}`), TTL_LOCALES_MS)
}

/** Tras crear, editar o eliminar un local. */
export function invalidarLocales() {
  invalidatePrefix('locals:')
  invalidatePrefix('local:')
}

/** Tras crear, editar o eliminar un negocio. */
export function invalidarNegocios() {
  invalidatePrefix('business')
  invalidarLocales()
}
