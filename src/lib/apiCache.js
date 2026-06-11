/**
 * Caché local genérico para respuestas GET + deduplicación de peticiones en vuelo.
 *
 * Objetivo (SCRUM-859): disminuir las peticiones repetitivas al servidor.
 * - TTL configurable por entrada (evita datos viejos).
 * - Deduplicación: si la misma clave se pide mientras hay una request en vuelo,
 *   se reutiliza la misma promesa en lugar de disparar otra al servidor.
 *
 * Uso:
 *   import { cachedRequest } from '@/lib/apiCache'
 *   const data = await cachedRequest(`products:${localId}`, () => apiRequest(`/products?local_id=${localId}`), 60000)
 */

/** @type {Map<string, { value: any, at: number, ttl: number }>} */
const store = new Map()
/** @type {Map<string, Promise<any>>} peticiones en vuelo por clave */
const inflight = new Map()

const DEFAULT_TTL_MS = 60 * 1000

/** Devuelve el valor cacheado si está vigente, o null. */
export function getCached(key) {
  const e = store.get(key)
  if (!e) return null
  if (Date.now() - e.at > e.ttl) {
    store.delete(key)
    return null
  }
  return e.value
}

/** Guarda un valor en caché con TTL. */
export function setCached(key, value, ttl = DEFAULT_TTL_MS) {
  store.set(key, { value, at: Date.now(), ttl })
}

/** Invalida una clave (o todas si se omite) — usar tras mutaciones (POST/PUT/DELETE). */
export function invalidate(key) {
  if (key == null) {
    store.clear()
    return
  }
  store.delete(key)
}

/** Invalida todas las claves que empiezan con un prefijo (p.ej. "products:"). */
export function invalidatePrefix(prefix) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

/**
 * Ejecuta `fetcher` solo si no hay valor en caché vigente ni una request en vuelo.
 * Cachea el resultado y deduplica llamadas concurrentes con la misma clave.
 */
export async function cachedRequest(key, fetcher, ttl = DEFAULT_TTL_MS) {
  const hit = getCached(key)
  if (hit !== null) return hit

  const pending = inflight.get(key)
  if (pending) return pending

  const promise = (async () => {
    try {
      const value = await fetcher()
      setCached(key, value, ttl)
      return value
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}
