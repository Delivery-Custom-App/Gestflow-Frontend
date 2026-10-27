/**
 * #171: el aviso de la ventana de Mercado Pago (`mp_oauth_success` /
 * `mp_oauth_error`) solo se acepta si viene de esa misma ventana y de un
 * origen conocido. La página que lo manda la sirve el backend
 * (`/mp-oauth/callback`), así que se acepta el origen de la API y el del front.
 * Antes se aceptaba de cualquier página abierta en el navegador.
 */

/** Los orígenes de los que se aceptan avisos: el de la API y el del front. */
export function origenesConfiables(apiBaseUrl = import.meta.env.VITE_API_URL || '', front = window.location.origin) {
  const origenes = new Set([front])
  try {
    origenes.add(new URL(apiBaseUrl || '/', front).origin)
  } catch {
    // Sin una URL de API válida queda solo el front.
  }
  return origenes
}

/** El tipo del aviso ('mp_oauth_success' | 'mp_oauth_error'), o null si no es confiable. */
export function avisoDeMercadoPago(evento, ventana, origenes = origenesConfiables()) {
  if (!evento || !ventana || evento.source !== ventana) return null
  if (!origenes.has(evento.origin)) return null
  const tipo = evento.data && typeof evento.data === 'object' ? evento.data.type : null
  return tipo === 'mp_oauth_success' || tipo === 'mp_oauth_error' ? tipo : null
}
