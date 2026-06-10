import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocals } from './useLocals'

/**
 * Resuelve el local activo según router state y/o catálogo de locales.
 *
 * @param {string|undefined} localId — `:localId` de la ruta
 * @param {'state-then-placeholder' | 'state-then-locales' | 'locales-only'} [strategy]
 *   - state-then-placeholder: `location.state.local` o `{ id, name: 'Local …' }` (inventario)
 *   - state-then-locales: state, luego `useLocals().find`, o `null` (administrativo)
 *   - locales-only: solo catálogo, sin `location.state` (POS)
 */
export function useSelectedLocal(localId, strategy = 'state-then-placeholder') {
  const location = useLocation()
  const { locales } = useLocals()

  return useMemo(() => {
    // Solo usar el state si el objeto tiene nombre — evita mostrar el UUID como fallback
    if (strategy !== 'locales-only' && location.state?.local?.name) {
      return location.state.local
    }
    if (strategy === 'state-then-locales' || strategy === 'locales-only') {
      return locales.find((l) => String(l.id) === String(localId)) ?? null
    }
    // state-then-placeholder: busca en catálogo primero, si no hay usa placeholder
    const fromCatalog = locales.find((l) => String(l.id) === String(localId))
    return fromCatalog ?? { id: localId, name: `Local ${localId ?? ''}` }
  }, [location.state, localId, locales, strategy])
}
