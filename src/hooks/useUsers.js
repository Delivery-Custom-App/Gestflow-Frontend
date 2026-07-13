import { useState, useEffect, useCallback } from 'react'
import { apiRequest, getAuthContext } from '../lib/apiClient'

export function useUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { token, businessId } = await getAuthContext()
      const data = await apiRequest(`/users?business_id=${businessId}`, { token })
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return { users, loading, error, refetch: fetchUsers }
}
