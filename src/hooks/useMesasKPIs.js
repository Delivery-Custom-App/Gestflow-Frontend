import { useState, useEffect, useCallback } from 'react'
import { computeMesasKpis } from '../lib/salesApi'
import { refrescarDeFondo } from './useMesasConEstado'

export function useMesasKPIs(localId) {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchKpis = useCallback(async () => {
    if (!localId) return
    try {
      setKpis(await computeMesasKpis(localId))
      setError(null)
    } catch (err) {
      setError(err.message || 'Error al cargar KPIs de mesas')
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => {
    if (!localId) return
    setLoading(true)
    fetchKpis()
    // #157: al mismo ritmo que la grilla, y al volver a la pestaña.
    return refrescarDeFondo(fetchKpis)
  }, [localId, fetchKpis])

  return { kpis, loading, error, refresh: fetchKpis }
}
