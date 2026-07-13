import { useState, useEffect } from 'react'
import { apiRequest } from '../lib/apiClient'

/**
 * Resuelve la caja activa del usuario actual.
 * Consulta user_cajas → devuelve la primera caja activa asignada.
 */
export function useCajaActiva(localId) {
  const [cajaId, setCajaId] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!localId) return
    let cancelled = false

    const fetch = async () => {
      setLoading(true)
      try {
        const data = await apiRequest(`/cajas/activa?local_id=${localId}`)
        if (!cancelled && data?.caja_id) setCajaId(data.caja_id)
      } catch {
        // sin caja asignada — continúa sin caja_id
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [localId])

  return { cajaId, loading }
}
