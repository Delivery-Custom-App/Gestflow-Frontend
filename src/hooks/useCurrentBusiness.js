import { useState, useEffect, useCallback } from 'react'
import { getBusiness, getOptionalAuthContext } from '../lib/apiClient'
import { useAuth } from '../context/AuthContext'
import { isAdminNegocioRole, isSuperAdminRole } from '../auth/roleLabel'

/**
 * Datos del negocio del usuario autenticado (nombre, plan).
 *
 * A-09 (B-14): `GET /auth/me` ya trae `business_name`, `business_plan`,
 * `local_name` y `local_sales_model`. El encargado y el vendedor los toman de
 * ahí y ya no llaman a `GET /businesses/{id}` (su RLS lo rechazaba y llenaba
 * la consola de errores, E6). El dueño sigue leyendo su negocio (guardado en
 * memoria, T-35), con /auth/me como respaldo.
 * @returns {object} { business, loading }
 */
export function negocioDesdePerfil(user) {
  if (!user?.business_name && !user?.business_plan) return null
  return { id: user.business_id || null, name: user.business_name || null, plan: user.business_plan || null }
}

export function useCurrentBusiness() {
  const { user, userRole } = useAuth()
  const leeNegocio = isAdminNegocioRole(userRole) || isSuperAdminRole(userRole)
  const delPerfil = negocioDesdePerfil(user)
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(leeNegocio)

  const fetchBusiness = useCallback(async () => {
    if (!leeNegocio) return
    try {
      setLoading(true)
      const { token, businessId } = await getOptionalAuthContext()
      if (!token || !businessId) {
        setBusiness(null)
        return
      }
      const row = await getBusiness(businessId)
      setBusiness(row || null)
    } catch {
      setBusiness(null)
    } finally {
      setLoading(false)
    }
  }, [leeNegocio])

  useEffect(() => {
    fetchBusiness()
  }, [fetchBusiness])

  return { business: (leeNegocio ? business : null) || delPerfil, loading: leeNegocio ? loading : false }
}
