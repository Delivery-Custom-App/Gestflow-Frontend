import { useState, useEffect, useCallback } from 'react'
import { createLeaveRequest, listLeaveRequests, resolveLeaveRequest } from '../lib/hrApi'

export function useLeaveRequests(employeeId) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setRequests(await listLeaveRequests(employeeId))
    } catch (err) {
      setError(err.message || 'Error al cargar permisos')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const submitRequest = useCallback(async (body) => {
    const row = await createLeaveRequest(body)
    await fetchRequests()
    return row
  }, [fetchRequests])

  const decideRequest = useCallback(async (requestId, status, note) => {
    const row = await resolveLeaveRequest(requestId, { status, note })
    await fetchRequests()
    return row
  }, [fetchRequests])

  return { requests, loading, error, refetch: fetchRequests, submitRequest, decideRequest }
}
