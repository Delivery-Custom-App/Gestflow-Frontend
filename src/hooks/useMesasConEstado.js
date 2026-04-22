import { useState, useEffect, useCallback } from 'react'
import { apiRequest } from '../lib/apiClient'

/**
 * Mesas con estado (libre/ocupada/en_cobro) consultando detalle por mesa activa.
 */
export function useMesasConEstado(localId) {
  const [mesas, setMesas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMesas = useCallback(async () => {
    if (!localId) return
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch base mesa list
      const baseMesas = await apiRequest(`/mesas?local_id=${localId}`)
      const mesas = baseMesas || []

      // 2. Fetch detail for each active mesa in parallel to get computed state
      const activeIds = mesas
        .filter((m) => m.is_active)
        .map((m) => m.id)

      const detailResults = await Promise.allSettled(
        activeIds.map((id) =>
          apiRequest(`/mesas/${id}/detail`).catch(() => null)
        )
      )

      // Build state map: mesa_id → state
      const stateMap = {}
      detailResults.forEach((result, idx) => {
        const detail = result.status === 'fulfilled' ? result.value : null
        if (detail?.mesa?.state) {
          stateMap[activeIds[idx]] = detail.mesa.state
        }
      })

      // 3. Merge state into each mesa
      const mesasWithState = mesas.map((mesa) => ({
        ...mesa,
        state: mesa.is_active ? (stateMap[mesa.id] || 'libre') : 'inactiva',
      }))

      setMesas(mesasWithState)
    } catch (err) {
      setError(err.message || 'Error al cargar mesas')
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => {
    fetchMesas()
  }, [fetchMesas])

  const createMesa = useCallback(async ({ name, capacidad, zona }) => {
    const data = await apiRequest('/mesas', {
      method: 'POST',
      body: {
        local_id: localId,
        name,
        capacidad: Number(capacidad),
        zona,
        is_delivery: false,
        is_active: true,
      },
    })
    await fetchMesas()
    return data
  }, [localId, fetchMesas])

  const updateMesa = useCallback(async ({ id, name, capacidad, zona, is_active }) => {
    const data = await apiRequest(`/mesas/${id}`, {
      method: 'PATCH',
      body: {
        name,
        capacidad: Number(capacidad),
        zona,
        is_active,
      },
    })
    await fetchMesas()
    return data
  }, [fetchMesas])

  const deleteMesa = useCallback(async (id) => {
    await apiRequest(`/mesas/${id}`, {
      method: 'DELETE',
    })
    await fetchMesas()
  }, [fetchMesas])

  return { mesas, loading, error, refresh: fetchMesas, createMesa, updateMesa, deleteMesa }
}
