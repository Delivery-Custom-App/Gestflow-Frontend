import { useState, useEffect, useCallback } from 'react'
import { getAuthContext } from '../lib/apiClient'

/** Detalle de mesa y órdenes activas vía GET /mesas/:id/detail. */
export function useMesaDetail(mesaId) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMesaDetail = useCallback(async () => {
    if (!mesaId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { token } = await getAuthContext()
      const baseUrl = 'http://localhost:8000/api'
      const response = await fetch(`${baseUrl}/mesas/${mesaId}/detail`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setDetail(data)
    } catch (err) {
      setError(err.message || 'Error obteniendo detalle de mesa')
      console.error('Error fetching mesa detail:', err)
    } finally {
      setLoading(false)
    }
  }, [mesaId])

  useEffect(() => {
    fetchMesaDetail()
  }, [fetchMesaDetail])

  return { detail, loading, error, refresh: fetchMesaDetail }
}
