import { useState, useCallback } from 'react'
import { apiRequest } from '../lib/apiClient'

/**
 * HU-65 SCRUM-469: Hook para obtener el menú completo del local.
 * HU-46 / SCRUM-429: búsqueda opcional (`search` → `?search=`) contra `/dashboard/menu`.
 * Lazy — solo carga cuando se llama a `fetch()`.
 */
export function useMenuPOS(localId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async ({ search: searchTerm } = {}) => {
    if (!localId) return
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ local_id: String(localId) })
      if (searchTerm != null && String(searchTerm).trim()) {
        params.set('search', String(searchTerm).trim())
      }
      const result = await apiRequest(`/dashboard/menu?${params}`)
      setData(result)
    } catch (err) {
      setError(err.message || 'Error al cargar el menú')
    } finally {
      setLoading(false)
    }
  }, [localId])

  return { data, loading, error, fetch }
}
