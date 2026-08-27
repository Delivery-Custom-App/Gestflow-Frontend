import { useState, useEffect, useCallback } from 'react'
import { createEmployee, listEmployeesForLocal, listEmployees } from '../lib/hrApi'

export function useEmployees(localId, { allBusiness = false } = {}) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      if (allBusiness || !localId) {
        setEmployees(await listEmployees())
      } else {
        setEmployees(await listEmployeesForLocal(localId))
      }
    } catch (err) {
      setError(err.message || 'Error al cargar empleados')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }, [localId, allBusiness])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const addEmployee = useCallback(async (body) => {
    const row = await createEmployee(body)
    await fetchEmployees()
    return row
  }, [fetchEmployees])

  return { employees, loading, error, refetch: fetchEmployees, addEmployee }
}
