import { useState, useEffect } from 'react'
import { getActiveCaja } from '../lib/salesApi'

/**
 * Resuelve la caja abierta del local (V2: lista /cajas + status=open).
 */
export function useCajaActiva(localId) {
  const [cajaId, setCajaId] = useState(null)
  const [caja, setCaja] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!localId) return
    let cancelled = false

    const fetchCaja = async () => {
      setLoading(true)
      try {
        const active = await getActiveCaja(localId)
        if (!cancelled && active?.id) {
          setCajaId(active.id)
          setCaja(active)
        }
      } catch {
        // sin caja abierta
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCaja()
    return () => { cancelled = true }
  }, [localId])

  return { cajaId, caja, loading }
}
