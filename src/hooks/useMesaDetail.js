import { useState, useEffect, useCallback } from 'react'
import { getMesaDetail } from '../lib/salesApi'

/** Detalle de mesa y órdenes activas (compuesto en FE contra V2). */
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
      setDetail(await getMesaDetail(mesaId))
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
