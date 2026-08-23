import { useState, useCallback } from 'react'
import { fetchPosMenu } from '../lib/salesApi'

/**
 * Menú del local compuesto desde V2 (local-products + products + categories).
 * Solo carga cuando se llama a `fetch()`.
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
      const result = await fetchPosMenu(localId, {
        search: searchTerm != null && String(searchTerm).trim() ? String(searchTerm).trim() : undefined,
      })
      setData(result)
    } catch (err) {
      setError(err.message || 'Error al cargar el menú')
    } finally {
      setLoading(false)
    }
  }, [localId])

  return { data, loading, error, fetch }
}
