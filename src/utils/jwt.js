/**
 * Decodifica un JWT y extrae sus claims
 * @param {string} token - Token JWT
 * @returns {object} Claims del token
 */
export function decodeJWT(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Token inválido')
    }

    const payload = parts[1]
    const decoded = JSON.parse(atob(payload))
    return decoded
  } catch (error) {
    console.error('Error decodificando JWT:', error)
    return null
  }
}

/**
 * Extrae el business_id del JWT de Supabase
 * @param {string} token - Token JWT
 * @returns {string|null} business_id o null si no existe
 */
export function getBusinessIdFromToken(token) {
  const claims = decodeJWT(token)
  console.log('JWT Claims completo:', claims)
  console.log('user_metadata:', claims?.user_metadata)
  console.log('app_metadata:', claims?.app_metadata)

  // Busca en user_metadata (lo más común en Supabase)
  const businessId = claims?.user_metadata?.business_id || claims?.app_metadata?.business_id || null
  console.log('business_id encontrado:', businessId)

  return businessId
}

/**
 * Extrae el rol del usuario desde user metadata, app metadata o claims del token.
 * @param {object|null} user - Usuario de Supabase
 * @param {string|null} token - JWT de acceso
 * @returns {string|null} rol detectado
 */
export function getUserRole(user, token) {
  const claims = token ? decodeJWT(token) : null

  const role =
    user?.user_metadata?.role ||
    user?.user_metadata?.user_role ||
    user?.app_metadata?.role ||
    user?.app_metadata?.user_role ||
    claims?.user_metadata?.role ||
    claims?.user_metadata?.user_role ||
    claims?.app_metadata?.role ||
    claims?.app_metadata?.user_role ||
    claims?.role ||
    null

  return role
}
