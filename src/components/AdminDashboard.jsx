import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useLocals } from '../hooks/useLocals'
import { useAuth } from '../context/AuthContext'
import { isAdminNegocioRole, isSuperAdminRole } from '../auth/roleLabel'
import CreateLocalDrawer from './CreateLocalDrawer'
import LocalsGrid from './LocalsGrid'
import LoadingSpinner from './LoadingSpinner'
import { apiRequest, getOptionalAuthContext } from '../lib/apiClient'
import { REFRESCO_FLUJO_MS, cargarUmbral, esVenta, guardarUmbral, rangoDelPeriodo } from '../lib/umbralFlujo'

const ordenesEntre = (localId, desde, hasta, token) => apiRequest(
  `/orders?local_id=${localId}&date_from=${encodeURIComponent(desde.toISOString())}&date_to=${encodeURIComponent(hasta.toISOString())}`,
  { token },
)

function AdminDashboard() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { userRole } = useAuth()
  // El dueño ya no elimina franquicias desde Inicio: queda reservado al
  // superadmin (soporte de la empresa). El código de borrado se conserva.
  const puedeEliminarLocales = isSuperAdminRole(userRole)
  // /usuarios solo está montado en las rutas del dueño.
  const esDueno = isAdminNegocioRole(userRole)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [salesCounts, setSalesCounts]   = useState({})
  const [deltaCounts, setDeltaCounts]   = useState({})
  // Umbral de flujo: uno solo para todos los locales, guardado en este navegador (B-07).
  const [umbral, setUmbral]             = useState(cargarUmbral)
  const { locales, loading, error, refetch } = useLocals()

  /** Ventas (órdenes no canceladas) de cada local en el período del umbral. */
  const fetchSalesCounts = useCallback(async (locals, horas) => {
    if (!locals.length) return
    try {
      const { token } = await getOptionalAuthContext()
      if (!token) return
      const { desde, hasta } = rangoDelPeriodo(horas)
      const results = await Promise.all(
        locals.map((l) =>
          ordenesEntre(l.id, desde, hasta, token)
            .then((orders) => {
              if (!Array.isArray(orders)) return { id: l.id, count: 0 }
              const count = orders.filter((o) => {
                const d = new Date(o.created_at)
                return esVenta(o) && d >= desde && d <= hasta
              }).length
              return { id: l.id, count }
            })
            .catch(() => ({ id: l.id, count: 0 }))
        )
      )
      const counts = {}
      results.forEach(({ id, count }) => { counts[id] = count })
      setSalesCounts(counts)
    } catch {
      // silently ignore — indicators simply won't show
    }
  }, [])

  /** Para la flecha: ventas de la última hora y de la hora anterior. */
  const fetchDeltaCounts = useCallback(async (locals) => {
    if (!locals.length) return
    try {
      const { token } = await getOptionalAuthContext()
      if (!token) return
      const now   = new Date()
      const h1ago = new Date(now.getTime() - 60  * 60 * 1000)
      const h2ago = new Date(now.getTime() - 120 * 60 * 1000)
      const results = await Promise.all(
        locals.map((l) =>
          ordenesEntre(l.id, h2ago, now, token)
            .then((orders) => {
              if (!Array.isArray(orders)) return { id: l.id, current: 0, prev: 0 }
              const ventas  = orders.filter(esVenta)
              const current = ventas.filter((o) => new Date(o.created_at) >= h1ago).length
              const prev    = ventas.filter((o) => new Date(o.created_at) <  h1ago).length
              return { id: l.id, current, prev }
            })
            .catch(() => ({ id: l.id, current: 0, prev: 0 }))
        )
      )
      const deltas = {}
      results.forEach(({ id, current, prev }) => { deltas[id] = { current, prev, delta: current - prev } })
      setDeltaCounts(deltas)
    } catch {
      // silently ignore
    }
  }, [])

  // Cuenta al entrar, al cambiar el período, cada minuto y al volver a la pestaña.
  useEffect(() => {
    if (loading || !locales.length) return undefined
    const contar = () => {
      fetchSalesCounts(locales, umbral.horas)
      fetchDeltaCounts(locales)
    }
    contar()
    const intervalo = setInterval(contar, REFRESCO_FLUJO_MS)
    window.addEventListener('focus', contar)
    return () => { clearInterval(intervalo); window.removeEventListener('focus', contar) }
  }, [loading, locales, umbral.horas, fetchSalesCounts, fetchDeltaCounts])

  const handleGuardarUmbral = useCallback((nuevo) => {
    setUmbral(guardarUmbral(nuevo))
  }, [])

  useEffect(() => {
    if (loading) return
    const st  = location.state
    const fid = st?.focusLocalId
    const loc = st?.local
    if (!fid && !loc?.id) return
    if (!locales?.length) return

    let idx = -1
    if (loc?.id) {
      idx = locales.findIndex((l) => String(l.id) === String(loc.id))
    } else if (fid) {
      idx = locales.findIndex((l) => String(l.id) === String(fid))
    }

    const path = location.pathname === '/' ? '/admin' : location.pathname
    if (idx >= 0) {
      const local = locales[idx]
      navigate(`/local/${local.id}/dashboard`, { state: { local }, replace: true })
      return
    }
    navigate(path, { replace: true, state: {} })
  }, [loading, locales, location.state, location.pathname, navigate])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="Cargando franquicias..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
          Error: {error}
        </div>
      </div>
    )
  }

  const handleRefresh = () => {
    refetch()
    fetchSalesCounts(locales, umbral.horas)
    fetchDeltaCounts(locales)
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto no-scrollbar">
          <LocalsGrid
            locales={locales}
            onLocalSelect={(local) => navigate(`/local/${local.id}/dashboard`, { state: { local } })}
            onCreateLocal={() => setIsDrawerOpen(true)}
            onShowUsers={esDueno ? () => navigate('/usuarios') : undefined}
            salesCounts={salesCounts}
            deltaCounts={deltaCounts}
            umbral={umbral}
            onGuardarUmbral={handleGuardarUmbral}
            canDeleteLocals={puedeEliminarLocales}
            onRefresh={handleRefresh}
          />
      </div>
      <CreateLocalDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={handleRefresh}
      />
    </>
  )
}

export default AdminDashboard
