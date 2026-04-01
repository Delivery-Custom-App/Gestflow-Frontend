import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBusinessIdFromToken } from '../utils/jwt'

/**
 * Hook para obtener locales del backend
 * @returns {object} { locales, loading, error, refetch }
 */
export function useLocals() {
  const [locales, setLocales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLocals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Obtener sesión y token
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setError('No hay sesión activa')
        setLocales([])
        return
      }

      const token = data.session.access_token

      // Obtener business_id de variables de entorno o del token
      const businessId = import.meta.env.VITE_BUSINESS_ID || getBusinessIdFromToken(token)
      
      // Construir URL - si no hay business_id, igualmente intentamos obtener los locales
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const url = businessId 
        ? `${apiUrl}/api/locals?business_id=${businessId}`
        : `${apiUrl}/api/locals`

      // Obtener locales del backend
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data_locales = await response.json()
      setLocales(data_locales)
    } catch (err) {
      console.error('Error obteniendo locales:', err)
      setError(err.message)
      setLocales([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLocals()
  }, [fetchLocals])

  return { locales, loading, error, refetch: fetchLocals }
}

