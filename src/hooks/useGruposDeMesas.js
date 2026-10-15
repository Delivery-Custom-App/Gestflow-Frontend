import { useCallback, useEffect, useMemo, useState } from 'react'
import { crearGrupoDeMesas, deshacerGrupoDeMesas, indexarGruposPorMesa, listarGruposDeMesas } from '../lib/mesaGroupsApi'

/**
 * Grupos de mesas del local. Devuelve también el índice mesa → grupo, que es
 * como lo consume la grilla: cada tarjeta necesita saber si su mesa está en un
 * grupo y en cuál.
 */
export function useGruposDeMesas(localId) {
  const [grupos, setGrupos] = useState([])
  const [error, setError] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!localId) return undefined
    let ignore = false
    listarGruposDeMesas(localId)
      .then((filas) => { if (!ignore) { setGrupos(filas); setError(null) } })
      .catch((e) => {
        // Un local sin mesas (al paso) responde error: no es una falla que
        // deba romper la pantalla, simplemente no hay grupos que mostrar.
        if (ignore) return
        setGrupos([])
        setError(e?.message || 'No se pudieron cargar los grupos de mesas')
      })
    return () => { ignore = true }
  }, [localId, recarga])

  const refresh = useCallback(() => setRecarga((n) => n + 1), [])

  const crear = useCallback(async (mesaIds) => {
    const grupo = await crearGrupoDeMesas(localId, mesaIds)
    refresh()
    return grupo
  }, [localId, refresh])

  const deshacer = useCallback(async (grupoId) => {
    await deshacerGrupoDeMesas(grupoId)
    refresh()
  }, [refresh])

  const porMesa = useMemo(() => indexarGruposPorMesa(grupos), [grupos])

  return { grupos, porMesa, error, crear, deshacer, refresh }
}
