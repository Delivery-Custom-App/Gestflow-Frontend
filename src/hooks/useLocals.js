import { useState, useEffect, useCallback } from 'react'
import { apiRequest, getOptionalAuthContext } from '../lib/apiClient'
import { getUserRole } from '../utils/jwt'

/**
 * Hook para obtener locales del backend
 * @returns {object} { locales, loading, error, refetch }
 */
export function useLocals() {
  const [locales, setLocales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLocals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { token, businessId, user } = await getOptionalAuthContext()

      if (!token) {
        setLocales([])
        return
      }

      const role = getUserRole(user, token)
      const isSuperAdmin = role?.toUpperCase() === 'SUPERADMIN'

      const url = businessId
        ? `/locals?business_id=${businessId}`
        : isSuperAdmin
          ? '/locals'
          : null

      if (!url) {
        setLocales([])
        return
      }

      const dataLocales = await apiRequest(url, { token })
      setLocales(Array.isArray(dataLocales) ? dataLocales : [])
    } catch (err) {
      console.error('Error obteniendo locales:', err)
      setError(err.message)
      setLocales([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLocals()
  }, [fetchLocals])

  return { locales, loading, error, refetch: fetchLocals }
}

