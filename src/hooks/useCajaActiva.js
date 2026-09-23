import { useState, useEffect } from 'react'
import { getActiveCaja } from '../lib/salesApi'

/**
 * Resuelve la caja abierta del local (V2: lista /cajas + status=open).
 */
export function useCajaActiva(localId) {
  const [caja, setCaja] = useState(null)
  const [resolvedFor, setResolvedFor] = useState(null) // localId ya consultado

  useEffect(() => {
    if (!localId) return
    let cancelled = false
    getActiveCaja(localId)
      .catch(() => null) // sin caja abierta
      .then((active) => {
        if (cancelled) return
        // Si el local no tiene caja abierta se limpia (antes quedaba la del local anterior).
        setCaja(active?.id ? active : null)
        setResolvedFor(localId)
      })
    return () => { cancelled = true }
  }, [localId])

  return { cajaId: caja?.id ?? null, caja, loading: Boolean(localId) && resolvedFor !== localId }
}
