import { useState, useEffect, useCallback } from 'react'
import { apiRequest, getOptionalAuthContext } from '../lib/apiClient'

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

      const { token, businessId } = await getOptionalAuthContext()

      if (!token) {
        setLocales([])
        return
      }

      // V2: RLS filtra; business_id es filtro opcional (SUPERADMIN ve todos).
      const url = businessId ? `/locals?business_id=${businessId}` : '/locals'

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
