import { useState, useEffect, useCallback } from 'react'
import { createMesa as createMesaV2, listMesas } from '../lib/salesApi'

export function useMesas(localId) {
  const [mesas, setMesas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMesas = useCallback(async () => {
    if (!localId) return
    try {
      const data = await listMesas(localId)
      setMesas(data || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Error al cargar mesas')
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => {
    setLoading(true)
    fetchMesas()
  }, [fetchMesas])

  const createMesa = useCallback(async ({ name, capacidad, zona }) => {
    const data = await createMesaV2({
      local_id: localId,
      name,
      capacidad,
      zona,
    })
    setMesas((prev) => [...prev, data])
    return data
  }, [localId])

  return { mesas, loading, error, refresh: fetchMesas, createMesa }
}
