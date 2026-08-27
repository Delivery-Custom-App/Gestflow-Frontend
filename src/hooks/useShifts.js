import { useState, useEffect, useCallback } from 'react'
import { createShift, listShifts } from '../lib/hrApi'

export function useShifts(localId, employeeId) {
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchShifts = useCallback(async () => {
    if (!localId && !employeeId) {
      setShifts([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      setShifts(await listShifts({ local_id: localId, employee_id: employeeId }))
    } catch (err) {
      setError(err.message || 'Error al cargar turnos')
      setShifts([])
    } finally {
      setLoading(false)
    }
  }, [localId, employeeId])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  const addShift = useCallback(async (body) => {
    const row = await createShift(body)
    await fetchShifts()
    return row
  }, [fetchShifts])

  return { shifts, loading, error, refetch: fetchShifts, addShift }
}
