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

      // Extraer business_id del token
      const businessId = getBusinessIdFromToken(token)
      if (!businessId) {
        setError('No se encontró business_id en el token')
        setLocales([])
        return
      }

      // Obtener locales del backend
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(
        `${apiUrl}/api/locals?business_id=${businessId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      )

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

