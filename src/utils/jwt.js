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
 * Extrae el role del JWT de Supabase
 * @param {string} token - Token JWT
 * @returns {string|null} role o null si no existe
 */
export function getRoleFromToken(token) {
  const claims = decodeJWT(token)
  console.log('Buscando role en claims:', claims)

  // Busca en user_metadata.role o app_metadata.role
  const role = 
    claims?.user_metadata?.role || 
    claims?.app_metadata?.role || 
    null
  
  console.log('role encontrado:', role)
  return role
}
