import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useAvailableLocals(businessId) {
  const [locals, setLocals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!businessId) {
      setError('Business ID is required')
      setLoading(false)
      return
    }

    const fetchLocals = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `${API_URL}/api/locals/by-business/${businessId}/available`
        )

        if (!response.ok) {
          throw new Error(`Error fetching locals: ${response.status}`)
        }

        const data = await response.json()
        setLocals(data || [])
      } catch (err) {
        console.error('Error in useAvailableLocals:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchLocals()
  }, [businessId])

  return { locals, loading, error }
}
