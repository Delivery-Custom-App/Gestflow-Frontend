import { useState, useEffect, useCallback } from 'react'
import {
  createMesa as createMesaV2,
  deleteMesa as deleteMesaV2,
  listMesas,
  updateMesa as updateMesaV2,
} from '../lib/salesApi'

/**
 * Mesas con estado (libre/ocupada). V2: status available|occupied mapeado a state.
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
      setMesas(await listMesas(localId))
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
    const data = await createMesaV2({ local_id: localId, name, capacidad, zona })
    await fetchMesas()
    return data
  }, [localId, fetchMesas])

  const updateMesa = useCallback(async ({ id, name, capacidad, zona, is_active }) => {
    void capacidad
    void zona
    void is_active
    const data = await updateMesaV2(id, { name })
    await fetchMesas()
    return data
  }, [fetchMesas])

  const deleteMesa = useCallback(async (id) => {
    void id
    await deleteMesaV2()
    await fetchMesas()
  }, [fetchMesas])

  return { mesas, loading, error, refresh: fetchMesas, createMesa, updateMesa, deleteMesa }
}
