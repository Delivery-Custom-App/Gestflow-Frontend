import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useOrderSummary(orderId) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orderId) {
      setError('Order ID is required')
      setLoading(false)
      return
    }

    const fetchSummary = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`${API_URL}/api/orders/${orderId}/summary`)

        if (!response.ok) {
          throw new Error(`Error fetching order summary: ${response.status}`)
        }

        const data = await response.json()
        setSummary(data)
      } catch (err) {
        console.error('Error in useOrderSummary:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [orderId])

  return { summary, loading, error }
}
